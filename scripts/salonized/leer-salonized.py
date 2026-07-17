"""Conector Salonized de SOLO LECTURA — vuelca los datos a staging local.

Salonized no tiene API oficial: se usa la API interna del frontend
(api.salonized.com) con sesión por cookie, igual que hace la propia web
(patrón documentado en gatsby-source-salonized). Este script hace
EXCLUSIVAMENTE GETs: jamás escribe nada en Salonized.

Uso:
    python scripts/salonized/leer-salonized.py [dir_salida]

Credenciales: archivo local FUERA del repo (jamás commitear), por defecto
`~/.antifragil/salonized.env` con SALONIZED_EMAIL y SALONIZED_PASSWORD.
Salida: un JSON por recurso en dir_salida (por defecto
`~/.antifragil/salonized-staging/<fecha>/`). Los datos volcados contienen
información personal de clientes: el staging NUNCA entra en git.
"""

import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

API = "https://api.salonized.com"
CABECERAS = {
    "Origin": "https://app.salonized.com",
    "Referer": "https://app.salonized.com/",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (AntifragilOS conector lectura)",
}

# Recursos a volcar. Los paginados usan ?page=N hasta meta.next_page == null.
RECURSOS = [
    "services",
    "service_categories",
    "customers",
    "appointments",
    "invoices",
    "locations",
    "resources",
    "vat_rates",
    "companies",
    "prepaid_cards",
]


def cargar_credenciales() -> tuple[str, str]:
    ruta = Path(os.environ.get("SALONIZED_ENV", Path.home() / ".antifragil" / "salonized.env"))
    valores: dict[str, str] = {}
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.lstrip().startswith("#"):
            k, v = linea.split("=", 1)
            valores[k.strip()] = v.strip()
    return valores["SALONIZED_EMAIL"], valores["SALONIZED_PASSWORD"]


def abrir_sesion() -> urllib.request.OpenerDirector:
    email, password = cargar_credenciales()
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    cuerpo = urllib.parse.urlencode({"user[email]": email, "user[password]": password}).encode()
    req = urllib.request.Request(
        f"{API}/sessions",
        data=cuerpo,
        method="POST",
        headers={**CABECERAS, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
    )
    with opener.open(req, timeout=60) as r:
        if r.status not in (200, 201):
            raise SystemExit(f"login fallido: HTTP {r.status}")
    return opener


def leer_recurso(opener, recurso: str) -> list[dict]:
    filas: list[dict] = []
    pagina = 1
    while True:
        req = urllib.request.Request(f"{API}/{recurso}?page={pagina}", headers=CABECERAS)
        try:
            with opener.open(req, timeout=120) as r:
                datos = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:  # recurso no disponible en este plan
            print(f"  · {recurso}: HTTP {e.code} — omitido")
            return filas
        clave = recurso.split("/")[-1]
        lote = datos.get(clave, []) if isinstance(datos, dict) else datos
        filas.extend(lote)
        meta = datos.get("meta", {}) if isinstance(datos, dict) else {}
        if not meta.get("next_page"):
            return filas
        pagina = meta["next_page"]


def main() -> None:
    destino = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else Path.home() / ".antifragil" / "salonized-staging" / dt.date.today().isoformat()
    )
    destino.mkdir(parents=True, exist_ok=True)
    opener = abrir_sesion()
    resumen = {}
    for recurso in RECURSOS:
        filas = leer_recurso(opener, recurso)
        nombre = recurso.replace("/", "_")
        with open(destino / f"{nombre}.json", "w", encoding="utf-8") as f:
            json.dump(filas, f, ensure_ascii=False, indent=1)
        resumen[nombre] = len(filas)
        print(f"  · {nombre}: {len(filas)}")
    with open(destino / "_resumen.json", "w", encoding="utf-8") as f:
        json.dump({"fecha": dt.datetime.now().isoformat(), "conteos": resumen}, f, indent=1)
    print(f"staging: {destino}")


if __name__ == "__main__":
    main()
