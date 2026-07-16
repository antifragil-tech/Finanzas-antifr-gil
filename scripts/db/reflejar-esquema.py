"""Refleja el esquema real de un proyecto Supabase y genera su DDL versionable.

Uso:
    set SUPABASE_ACCESS_TOKEN=sbp_...   (token de Management API; NUNCA commitearlo)
    python scripts/db/reflejar-esquema.py <project_ref> <salida.sql>

Solo LECTURAS (SELECT sobre information_schema/pg_catalog vía Management API).
Genera un único .sql ordenado: enums → funciones propias → tablas → constraints
→ índices → vistas (orden por dependencias) → triggers → RLS → comentarios.
Falla en alto ante cualquier tipo/objeto que no sepa mapear: nada se genera a ojo.

Origen: services/supabase/esquema-real/ (reflejo del 2026-07-16). Al cambiar el
esquema vivo, regenerar el reflejo y commitearlo en el mismo PR que el cambio.
"""

import datetime as dt
import json
import os
import re
import sys
import urllib.request

QUERIES = {
    "tablas": """
        select t.schemaname, t.tablename, t.rowsecurity,
               obj_description(format('%I.%I', t.schemaname, t.tablename)::regclass) as comentario
        from pg_tables t where t.schemaname = 'public' order by t.tablename""",
    "columnas": """
        select table_name, ordinal_position, column_name, data_type, udt_name,
               is_nullable, column_default, character_maximum_length,
               numeric_precision, numeric_scale
        from information_schema.columns
        where table_schema = 'public' order by table_name, ordinal_position""",
    "constraints": """
        select conrelid::regclass::text as tabla, conname, contype,
               pg_get_constraintdef(oid) as definicion
        from pg_constraint
        where connamespace = 'public'::regnamespace order by 1, 2""",
    "indices": """
        select tablename, indexname, indexdef from pg_indexes
        where schemaname = 'public' order by tablename, indexname""",
    "vistas": """
        select viewname, pg_get_viewdef(format('%I.%I','public',viewname)::regclass, true) as definicion
        from pg_views where schemaname = 'public' order by viewname""",
    "funciones_propias": """
        select p.proname, pg_get_functiondef(p.oid) as definicion
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
        order by p.proname""",
    "triggers_ddl": """
        select c.relname as tabla, t.tgname, pg_get_triggerdef(t.oid) as definicion
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
        order by c.relname, t.tgname""",
    "policies": """
        select schemaname, tablename, policyname, permissive, roles::text, cmd,
               qual, with_check
        from pg_policies where schemaname = 'public' order by tablename, policyname""",
    "enums": """
        select t.typname, array_agg(e.enumlabel order by e.enumsortorder)::text as valores
        from pg_type t join pg_enum e on e.enumtypid = t.oid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' group by t.typname order by t.typname""",
    "comentarios_columna": """
        select c.relname as tabla, a.attname as columna,
               col_description(c.oid, a.attnum) as comentario
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        where n.nspname = 'public' and c.relkind = 'r'
          and col_description(c.oid, a.attnum) is not null
        order by c.relname, a.attnum""",
    "extensiones": """
        select extname, extversion from pg_extension order by extname""",
}


def consulta(ref: str, token: str, sql: str):
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # El WAF de api.supabase.com rechaza el User-Agent de urllib.
            "User-Agent": "curl/8.9.1",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def tipo_columna(c, nombres_enum):
    dt_, udt = c["data_type"], c["udt_name"]
    if dt_ == "USER-DEFINED":
        if udt in nombres_enum:
            return f"public.{udt}"
        raise SystemExit(f"tipo USER-DEFINED desconocido: {udt} en {c['table_name']}.{c['column_name']}")
    if dt_ == "ARRAY":
        return f"{udt.lstrip('_')}[]"
    if dt_ == "numeric":
        p, s = c.get("numeric_precision"), c.get("numeric_scale")
        return f"numeric({p},{s})" if p is not None and s is not None else "numeric"
    if dt_ == "character varying":
        n = c.get("character_maximum_length")
        return f"varchar({n})" if n else "varchar"
    if dt_ == "character":
        n = c.get("character_maximum_length")
        return f"char({n})" if n else "char"
    simples = {
        "text": "text", "uuid": "uuid", "boolean": "boolean", "date": "date",
        "integer": "integer", "bigint": "bigint", "smallint": "smallint",
        "real": "real", "double precision": "double precision", "jsonb": "jsonb",
        "json": "json", "bytea": "bytea", "inet": "inet",
        "timestamp with time zone": "timestamptz",
        "timestamp without time zone": "timestamp",
        "time without time zone": "time", "interval": "interval",
    }
    if dt_ in simples:
        return simples[dt_]
    raise SystemExit(f"tipo sin mapear: {dt_}/{udt} en {c['table_name']}.{c['column_name']}")


def genera_ddl(d: dict) -> str:
    tablas = d["tablas"]
    enums = d["enums"]
    funciones = d["funciones_propias"]
    vistas = d["vistas"]
    triggers = d["triggers_ddl"]
    policies = d["policies"]
    constraints = d["constraints"]
    nombres_enum = {e["typname"] for e in enums}
    nombres_tabla = {t["tablename"] for t in tablas}
    nombres_constraint = {c["conname"] for c in constraints}

    cols_por_tabla: dict[str, list] = {}
    for c in d["columnas"]:
        cols_por_tabla.setdefault(c["table_name"], []).append(c)
    cons_por_tabla: dict[str, list] = {}
    for con in constraints:
        t = con["tabla"].replace("public.", "").strip('"')
        cons_por_tabla.setdefault(t, []).append(con)

    hoy = dt.date.today().isoformat()
    out: list[str] = []
    w = out.append
    barra = "-- " + "═" * 75

    w(barra)
    w(f"-- ANTIFRÁGIL OS — REFLEJO DEL ESQUEMA REAL (generado {hoy})")
    w(barra)
    w("-- Generado por scripts/db/reflejar-esquema.py (solo lecturas de catálogo).")
    w("-- ES LA FOTO del esquema aplicado en la base real; NO aplicar sobre ella.")
    w(f"-- Contenido: {len(tablas)} tablas · {len(enums)} enums · {len(funciones)} funciones · "
      f"{len(vistas)} vistas · {len(triggers)} triggers · {len(policies)} políticas RLS")
    w(barra)
    w("")
    w("-- Extensiones presentes en la base (informativo):")
    for e in d["extensiones"]:
        w(f"--   · {e['extname']} {e['extversion']}")
    w("")

    w(barra)
    w(f"-- §1. ENUMS ({len(enums)})")
    w(barra)
    for e in enums:
        valores = e["valores"].strip("{}").split(",")
        lista = ", ".join("'" + v.strip().strip('"') + "'" for v in valores)
        w(f"create type public.{e['typname']} as enum ({lista});")
    w("")

    w(barra)
    w(f"-- §2. FUNCIONES PROPIAS ({len(funciones)})")
    w(barra)
    for f in funciones:
        w(f["definicion"].rstrip() + ";")
        w("")

    w(barra)
    w(f"-- §3. TABLAS ({len(tablas)}) — columnas; constraints en §4")
    w(barra)
    for t in sorted(cols_por_tabla):
        if t not in nombres_tabla:
            continue  # columnas de vistas
        w(f"create table public.{t} (")
        lineas = []
        for c in cols_por_tabla[t]:
            linea = f"  {c['column_name']:32} {tipo_columna(c, nombres_enum)}"
            if c["is_nullable"] == "NO":
                linea += " not null"
            if c["column_default"] is not None:
                linea += f" default {c['column_default']}"
            lineas.append(linea)
        w(",\n".join(lineas))
        w(");")
        w("")

    tipos = {c["contype"] for c in constraints}
    if not tipos.issubset({"p", "u", "c", "x", "f"}):
        raise SystemExit(f"contype sin manejar: {tipos - {'p', 'u', 'c', 'x', 'f'}}")
    w(barra)
    w(f"-- §4. CONSTRAINTS ({len(constraints)}) — pk → unique → check → exclusion → fk")
    w(barra)
    for tipo in ["p", "u", "c", "x", "f"]:
        for t in sorted(cons_por_tabla):
            for con in sorted(cons_por_tabla[t], key=lambda x: x["conname"]):
                if con["contype"] == tipo:
                    w(f"alter table public.{t} add constraint {con['conname']} {con['definicion']};")
    w("")

    idx_libres = [i for i in d["indices"] if i["indexname"] not in nombres_constraint]
    w(barra)
    w(f"-- §5. ÍNDICES ({len(idx_libres)} no asociados a constraints)")
    w(barra)
    for i in sorted(idx_libres, key=lambda x: (x["tablename"], x["indexname"])):
        w(i["indexdef"] + ";")
    w("")

    nombres_vista = {v["viewname"] for v in vistas}
    pendientes = {v["viewname"]: v for v in vistas}
    ordenadas: list = []
    while pendientes:
        avanzo = False
        for nombre in sorted(pendientes):
            deps = {
                otra for otra in nombres_vista
                if otra != nombre
                and re.search(rf"\b{re.escape(otra)}\b", pendientes[nombre]["definicion"])
            }
            if deps.issubset({v["viewname"] for v in ordenadas}):
                ordenadas.append(pendientes.pop(nombre))
                avanzo = True
        if not avanzo:
            raise SystemExit(f"ciclo de dependencias entre vistas: {sorted(pendientes)}")
    w(barra)
    w(f"-- §6. VISTAS ({len(vistas)}) — orden por dependencias")
    w(barra)
    for v in ordenadas:
        w(f"create or replace view public.{v['viewname']} as")
        w(v["definicion"].rstrip().rstrip(";") + ";")
        w("")

    w(barra)
    w(f"-- §7. TRIGGERS ({len(triggers)})")
    w(barra)
    for t in triggers:
        w(t["definicion"] + ";")
    w("")

    w(barra)
    w(f"-- §8. ROW LEVEL SECURITY ({len(tablas)} tablas · {len(policies)} políticas)")
    w(barra)
    for t in tablas:
        w(f"alter table public.{t['tablename']} enable row level security;")
    w("")
    for p in policies:
        roles = p["roles"].strip("{}").replace('"', "")
        partes = [f"create policy \"{p['policyname']}\" on public.{p['tablename']}"]
        if p["permissive"] != "PERMISSIVE":
            partes.append("  as restrictive")
        partes.append(f"  for {p['cmd'].lower()}")
        partes.append(f"  to {roles}")
        if p["qual"]:
            partes.append(f"  using ({p['qual']})")
        if p["with_check"]:
            partes.append(f"  with check ({p['with_check']})")
        w("\n".join(partes) + ";")
        w("")

    com_tablas = [(t["tablename"], t["comentario"]) for t in tablas if t.get("comentario")]
    com_cols = d["comentarios_columna"]
    w(barra)
    w(f"-- §9. COMENTARIOS ({len(com_tablas)} de tabla · {len(com_cols)} de columna)")
    w(barra)
    for t, c in sorted(com_tablas):
        w(f"comment on table public.{t} is '" + c.replace("'", "''") + "';")
    for cc in com_cols:
        w(
            f"comment on column public.{cc['tabla']}.{cc['columna']} is '"
            + cc["comentario"].replace("'", "''") + "';"
        )
    w("")
    return "\n".join(out)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    ref, destino = sys.argv[1], sys.argv[2]
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise SystemExit("falta SUPABASE_ACCESS_TOKEN en el entorno")
    datos = {}
    for nombre, sql in QUERIES.items():
        datos[nombre] = consulta(ref, token, sql)
        print(f"  · {nombre}: {len(datos[nombre])}")
    ddl = genera_ddl(datos)
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        f.write(ddl)
    print(f"generado: {destino} ({ddl.count(chr(10)) + 1} líneas)")


if __name__ == "__main__":
    main()
