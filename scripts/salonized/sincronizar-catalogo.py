"""Sincroniza el CATÁLOGO de Salonized (staging local) hacia la base del OS.

Solo catálogos: servicios (con tarifa) y clientes. El histórico transaccional
(citas, ventas) se importa en la fase de datos, con cuadre. Upserts
idempotentes por `salonized_id` (índice único): re-ejecutar no duplica.

Uso:
    set SUPABASE_URL=...            (https://<ref>.supabase.co)
    set SUPABASE_SERVICE_ROLE_KEY=...
    python scripts/salonized/sincronizar-catalogo.py <dir_staging>

Jamás escribe en Salonized; jamás borra en el OS (solo insert/update).
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

CATEGORIAS = {"Fisioterapia": "fisioterapia", "Nutrición": "nutricion", "Entrenamiento": "entrenamiento_personal"}


def upsert(tabla: str, filas: list[dict]) -> None:
    if not filas:
        return
    req = urllib.request.Request(
        f"{URL}/rest/v1/{tabla}?on_conflict=salonized_id",
        data=json.dumps(filas).encode(),
        method="POST",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        if r.status not in (200, 201, 204):
            raise SystemExit(f"{tabla}: HTTP {r.status}")


def main() -> None:
    base = Path(sys.argv[1])
    servicios = json.load(open(base / "services.json", encoding="utf-8"))
    categorias = {
        c["id"]: CATEGORIAS.get(c["name"], "fisioterapia")
        for c in json.load(open(base / "service_categories.json", encoding="utf-8"))
    }
    clientes = json.load(open(base / "customers.json", encoding="utf-8"))

    filas_serv = []
    for s in servicios:
        if s.get("state") == "deleted":
            continue
        filas_serv.append(
            {
                "salonized_id": str(s["id"]),
                "nombre": s["name"].strip(),
                "categoria": categorias.get(s.get("category_id"), "fisioterapia"),
                "duracion_minutos": s.get("duration") or 45,
                "precio_base": (s.get("price") or 0) / 100,
                "activo": s.get("state") != "deleted" and not s.get("deleted", False),
            }
        )
    # En lotes por si el payload crece
    for i in range(0, len(filas_serv), 200):
        upsert("clinica_servicios", filas_serv[i : i + 200])
    print(f"servicios sincronizados: {len(filas_serv)}")

    filas_cli = []
    for c in clientes:
        nombre = (c.get("first_name") or "").strip()
        if not nombre:
            continue
        telefono = (c.get("mobile_phone") or c.get("phone") or "").strip() or None
        filas_cli.append(
            {
                "salonized_id": str(c["id"]),
                "nombre": nombre,
                "apellidos": (c.get("last_name") or "").strip() or None,
                "email": (c.get("email") or "").strip() or None,
                "telefono": telefono,
                "procedencia": "salonized",
            }
        )
    for i in range(0, len(filas_cli), 500):
        upsert("clinica_clientes", filas_cli[i : i + 500])
    print(f"clientes sincronizados: {len(filas_cli)}")


if __name__ == "__main__":
    main()
