"""Lee los TICKETS DE VENTA (orders) de Salonized enlazados a las citas.

El índice /orders está cerrado (301 a la UI), pero cada ticket individual
GET /orders/{id} responde. Las citas del staging traen order_ids: se leen
todos los tickets únicos y se guardan en el staging (fuera de git).

Uso:
    python scripts/salonized/leer-ordenes.py <dir_staging>

Salida: orders.json + resumen de totales por año (céntimos → €) para VALIDAR
contra la contabilidad conocida ANTES de volcar nada al OS. Solo lecturas.
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "leer_salonized", Path(__file__).with_name("leer-salonized.py")
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

API = "https://api.salonized.com"


def main() -> None:
    base = Path(sys.argv[1])
    apps = json.load(open(base / "appointments.json", encoding="utf-8"))
    ids = sorted({oid for a in apps for oid in a.get("order_ids") or []})
    print(f"tickets únicos enlazados a citas: {len(ids)}")

    opener = _mod.abrir_sesion()
    ordenes: list[dict] = []
    errores = 0
    for i, oid in enumerate(ids):
        try:
            req = urllib.request.Request(f"{API}/orders/{oid}", headers=_mod.CABECERAS)
            with opener.open(req, timeout=60) as r:
                d = json.loads(r.read().decode())
            o = d.get("order", d)
            if isinstance(o, dict) and set(o.keys()) == {"order"}:
                o = o["order"]
            ordenes.append(o)
        except Exception:  # noqa: BLE001 — un ticket borrado no rompe el lote
            errores += 1
        if (i + 1) % 250 == 0:
            print(f"  … {i + 1}/{len(ids)}")
            time.sleep(0.5)

    with open(base / "orders.json", "w", encoding="utf-8") as f:
        json.dump(ordenes, f, ensure_ascii=False, indent=1)
    print(f"guardados {len(ordenes)} tickets ({errores} errores) en {base / 'orders.json'}")

    # Resumen por año (fecha = created_on; total en céntimos; sin borradores ni anulados)
    por_anio: dict[str, list[float]] = {}
    for o in ordenes:
        if o.get("draft") or o.get("voided_at") or o.get("deleted_at"):
            continue
        anio = str(o.get("created_on", ""))[:4]
        por_anio.setdefault(anio, []).append((o.get("total") or 0) / 100)
    print(f"{'AÑO':6}{'TICKETS':>9}{'TOTAL €':>12}")
    for anio in sorted(por_anio):
        vals = por_anio[anio]
        print(f"{anio:6}{len(vals):>9}{round(sum(vals)):>12}")


if __name__ == "__main__":
    main()
