"""Importa las citas de Salonized (staging local) a clinica_citas, por mes.

Uso:
    set SUPABASE_ACCESS_TOKEN=sbp_...   (Management API; para el INSERT con
                                         ON CONFLICT DO NOTHING que la
                                         constraint anti-solapes exige)
    python scripts/salonized/importar-citas.py <dir_staging> <YYYY-MM>

Mapeos:
  · cliente     → clinica_clientes.salonized_id (sincronizado antes)
  · servicio    → clinica_servicios.salonized_id (parts[0].service_id);
                  precio_snapshot = precio_base del servicio
  · profesional → por NOMBRE normalizado (resources de Salonized pueden estar
                  duplicados: dos ids para la misma persona)
  · estado      → cancelada→cancelada_a_tiempo · no_show→no_show ·
                  activa pasada→realizada · activa futura→reservada

Idempotente por clinica_citas.salonized_id; los solapes que rechace la
constraint de exclusión quedan FUERA y se listan (no rompen la importación).
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
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def norma(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def q(v) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    base = Path(sys.argv[1])
    mes = sys.argv[2]

    apps = json.load(open(base / "appointments.json", encoding="utf-8"))
    recursos = json.load(open(base / "resources.json", encoding="utf-8"))
    del_mes = [a for a in apps if str(a.get("start_at", "")).startswith(mes)]
    print(f"citas de {mes} en staging: {len(del_mes)}")

    clientes = {
        c["salonized_id"]: c["id"]
        for c in consulta("select id, salonized_id from clinica_clientes where salonized_id is not null")
    }
    servicios = {
        s["salonized_id"]: s
        for s in consulta(
            "select id, salonized_id, precio_base from clinica_servicios where salonized_id is not null"
        )
    }
    profesionales = consulta("select id, nombre from clinica_profesionales")
    prof_por_nombre = {norma(p["nombre"]): p["id"] for p in profesionales}
    # resource de Salonized → profesional del OS (por nombre; también primer nombre)
    recurso_a_prof: dict[int, str] = {}
    sin_match = []
    for r in recursos:
        n = norma(r.get("name", ""))
        pid = prof_por_nombre.get(n) or prof_por_nombre.get(n.split(" ")[0])
        if not pid:
            pid = next((v for k, v in prof_por_nombre.items() if n and (n in k or k in n)), None)
        if pid:
            recurso_a_prof[r["id"]] = pid
        else:
            sin_match.append(r.get("name"))
    if sin_match:
        print("recursos SIN profesional en el OS (sus citas se omiten):", sin_match)

    ahora = dt.datetime.now(dt.timezone.utc).isoformat()
    valores = []
    omitidas = {"sin_cliente": 0, "sin_servicio": 0, "sin_profesional": 0}
    for a in del_mes:
        parte = (a.get("parts") or [{}])[0]
        cli = clientes.get(str(a.get("customer_id")))
        srv = servicios.get(str(parte.get("service_id")))
        prof = recurso_a_prof.get(parte.get("resource_id") or parte.get("employee_id") or a.get("selected_resource_id"))
        if not cli:
            omitidas["sin_cliente"] += 1
            continue
        if not srv:
            omitidas["sin_servicio"] += 1
            continue
        if not prof:
            omitidas["sin_profesional"] += 1
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
        print("nada que importar", omitidas)
        return

    sql = (
        "insert into public.clinica_citas "
        "(cliente_id, profesional_id, servicio_id, inicio, fin, estado, "
        "precio_snapshot, salonized_id, registrado_por_email) values\n"
        + ",\n".join(valores)
        + "\non conflict do nothing returning id"
    )
    insertadas = consulta(sql)
    print(f"insertadas: {len(insertadas)} de {len(valores)} candidatas")
    print(f"omitidas por mapeo: {omitidas}")
    ya_o_solape = len(valores) - len(insertadas)
    if ya_o_solape:
        print(f"descartadas por duplicado/solape (on conflict): {ya_o_solape}")


if __name__ == "__main__":
    main()
