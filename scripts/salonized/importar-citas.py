"""Importa citas de Salonized (staging local) a clinica_citas — un mes o todo.

Uso:
    set SUPABASE_ACCESS_TOKEN=sbp_...   (Management API; el INSERT usa
                                         ON CONFLICT DO NOTHING por la
                                         constraint anti-solapes)
    python scripts/salonized/importar-citas.py <dir_staging> <YYYY-MM | todo>

Mapeos:
  · cliente     → clinica_clientes.salonized_id; si la cita no tiene ficha,
                  cae al cliente genérico "(Sin ficha histórica)" (se crea
                  una sola vez) para no perder volumen de análisis.
  · servicio    → clinica_servicios.salonized_id (parts[0].service_id).
                  Servicios BORRADOS en Salonized (histórico) se recrean como
                  servicios INACTIVOS usando el nombre que viaja en la propia
                  cita (service_names) — así el análisis conserva el detalle.
  · profesional → por NOMBRE normalizado; recursos con citas y sin equivalente
                  se crean como profesionales INACTIVOS (p. ej. personal que
                  ya no está).
  · estado      → cancelada→cancelada_a_tiempo · no_show→no_show ·
                  activa pasada→realizada · activa futura→reservada
                  (los programas recurrentes generan citas futuras: entran
                  como reservadas).

Idempotente por clinica_citas.salonized_id; los solapes que rechace la
constraint de exclusión quedan fuera y se contabilizan (no rompen el lote).
"""

import datetime as dt
import json
import os
import sys
import unicodedata
import urllib.request
from pathlib import Path

REF = "fuvmywztsqkckfkmqavs"
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]


def consulta(sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.9.1",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def norma(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def q(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def categoria_por_nombre(nombre: str) -> str:
    n = norma(nombre)
    if "entren" in n:
        return "entrenamiento_personal"
    if "nutri" in n:
        return "nutricion"
    return "fisioterapia"


def main() -> None:
    base = Path(sys.argv[1])
    objetivo = sys.argv[2]

    apps = json.load(open(base / "appointments.json", encoding="utf-8"))
    recursos = json.load(open(base / "resources.json", encoding="utf-8"))
    if objetivo == "todo":
        meses = sorted({str(a.get("start_at", ""))[:7] for a in apps if a.get("start_at")})
    else:
        meses = [objetivo]

    clientes = {
        c["salonized_id"]: c["id"]
        for c in consulta(
            "select id, salonized_id from clinica_clientes where salonized_id is not null"
        )
    }
    servicios = {
        s["salonized_id"]: s
        for s in consulta(
            "select id, salonized_id, precio_base from clinica_servicios where salonized_id is not null"
        )
    }

    # ── Profesionales: match por nombre; los que tengan citas y no existan → inactivos
    profesionales = consulta("select id, nombre from clinica_profesionales")
    prof_por_nombre = {norma(p["nombre"]): p["id"] for p in profesionales}

    def resolver_prof(nombre_recurso: str):
        n = norma(nombre_recurso)
        return (
            prof_por_nombre.get(n)
            or prof_por_nombre.get(n.split(" ")[0])
            or next((v for k, v in prof_por_nombre.items() if n and (n in k or k in n)), None)
        )

    usados = {
        (a.get("parts") or [{}])[0].get("resource_id")
        or (a.get("parts") or [{}])[0].get("employee_id")
        or a.get("selected_resource_id")
        for a in apps
    }
    recurso_a_prof: dict[int, str] = {}
    for r in recursos:
        pid = resolver_prof(r.get("name", ""))
        if not pid and r["id"] in usados and r.get("resource_type", "employee") == "employee":
            fila = consulta(
                "insert into clinica_profesionales (nombre, activo) values "
                f"({q(r['name'])}, false) returning id"
            )[0]
            pid = fila["id"]
            prof_por_nombre[norma(r["name"])] = pid
            print(f"  + profesional histórico creado (inactivo): {r['name']}")
        if pid:
            recurso_a_prof[r["id"]] = pid

    # ── Cliente genérico para citas sin ficha
    generico = consulta(
        "insert into clinica_clientes (nombre, procedencia, salonized_id) values "
        "('(Sin ficha histórica)', 'salonized', 'sin-ficha-historica') "
        "on conflict (salonized_id) do update set nombre = excluded.nombre returning id"
    )[0]["id"]

    # ── Servicios borrados en Salonized → recrear inactivos con el nombre de la cita
    nombres_servicio_por_id: dict[str, str] = {}
    for a in apps:
        sid = str((a.get("parts") or [{}])[0].get("service_id"))
        if sid not in servicios and sid not in nombres_servicio_por_id:
            nombres = a.get("service_names")
            nombre = (
                nombres[0]
                if isinstance(nombres, list) and nombres
                else str(nombres or "Servicio histórico Salonized")
            )
            nombres_servicio_por_id[sid] = nombre
    for sid, nombre in nombres_servicio_por_id.items():
        if sid == "None":
            continue
        fila = consulta(
            "insert into clinica_servicios (nombre, categoria, duracion_minutos, activo, salonized_id) "
            f"values ({q(nombre)}, {q(categoria_por_nombre(nombre))}, 45, false, {q(sid)}) "
            "on conflict (salonized_id) do update set nombre = excluded.nombre returning id, salonized_id"
        )[0]
        servicios[fila["salonized_id"]] = {"id": fila["id"], "precio_base": None}
        print(f"  + servicio histórico creado (inactivo): {nombre}")

    ahora = dt.datetime.now(dt.timezone.utc).isoformat()
    total = {"candidatas": 0, "insertadas": 0, "conflicto": 0, "sin_mapeo": 0}
    for mes in meses:
        del_mes = [a for a in apps if str(a.get("start_at", "")).startswith(mes)]
        valores = []
        for a in del_mes:
            parte = (a.get("parts") or [{}])[0]
            cli = clientes.get(str(a.get("customer_id"))) or generico
            srv = servicios.get(str(parte.get("service_id")))
            prof = recurso_a_prof.get(
                parte.get("resource_id")
                or parte.get("employee_id")
                or a.get("selected_resource_id")
            )
            if not srv or not prof:
                total["sin_mapeo"] += 1
                continue
            if str(a.get("state")) in ("cancelled", "canceled"):
                estado = "cancelada_a_tiempo"
            elif a.get("no_show"):
                estado = "no_show"
            elif str(a.get("end_at", "")) < ahora:
                estado = "realizada"
            else:
                estado = "reservada"
            valores.append(
                f"({q(cli)}::uuid, {q(prof)}::uuid, {q(srv['id'])}::uuid, "
                f"{q(a['start_at'])}::timestamptz, {q(a['end_at'])}::timestamptz, "
                f"{q(estado)}::estado_cita, {srv.get('precio_base') or 'null'}, "
                f"{q(str(a['id']))}, 'importacion-salonized')"
            )
        if not valores:
            continue
        sql = (
            "insert into public.clinica_citas "
            "(cliente_id, profesional_id, servicio_id, inicio, fin, estado, "
            "precio_snapshot, salonized_id, registrado_por_email) values\n"
            + ",\n".join(valores)
            + "\non conflict do nothing returning id"
        )
        insertadas = len(consulta(sql))
        total["candidatas"] += len(valores)
        total["insertadas"] += insertadas
        total["conflicto"] += len(valores) - insertadas
        print(f"  {mes}: {insertadas}/{len(valores)}")

    print(json.dumps(total, indent=1))


if __name__ == "__main__":
    main()
