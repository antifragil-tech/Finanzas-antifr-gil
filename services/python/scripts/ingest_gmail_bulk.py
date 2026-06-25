"""Ingesta bulk de Gmail — todos los hilos desde una fecha.

Uso:
    python scripts/ingest_gmail_bulk.py --after 2025/10/01
    python scripts/ingest_gmail_bulk.py --after 2025/10/01 --dry-run
    python scripts/ingest_gmail_bulk.py --after 2025/10/01 --force

Flags:
    --after     Fecha desde (formato YYYY/MM/DD). Obligatorio.
    --dry-run   Lista hilos sin procesar.
    --force     Re-ingesta aunque ya existan en BD.
"""

from __future__ import annotations

import sys
import time

import click

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from alsari.db.supabase import get_client
from alsari.extract.gmail import list_threads_since
from alsari.pipeline.ingest import ingest_gmail_thread


def _get_ingested_gmail_ids() -> set[str]:
    client = get_client()
    ids: set[str] = set()
    offset = 0
    while True:
        res = (
            client.table("alsari_knowledge")
            .select("source_id")
            .eq("source_type", "gmail")
            .range(offset, offset + 999)
            .execute()
        )
        for row in res.data:
            if row.get("source_id"):
                ids.add(row["source_id"])
        if len(res.data) < 1000:
            break
        offset += 1000
    return ids


@click.command()
@click.option("--after", required=True, help="Fecha desde (YYYY/MM/DD), ej: 2025/10/01")
@click.option("--dry-run", is_flag=True, help="Solo lista, no procesa.")
@click.option("--force", is_flag=True, help="Re-ingesta aunque exista en BD.")
@click.option("--max", "max_threads", default=2000, help="Máximo de hilos a listar.")
def main(after: str, dry_run: bool, force: bool, max_threads: int) -> None:
    click.echo(f"Listando hilos de Gmail desde {after}...")
    thread_ids = list_threads_since(after, max_results=max_threads)
    click.echo(f"Hilos encontrados: {len(thread_ids)}")

    already = _get_ingested_gmail_ids()
    click.echo(f"Ya ingestados en BD: {len(already)} hilos")

    to_process = [tid for tid in thread_ids if force or tid not in already]

    if dry_run:
        click.secho(f"\n=== DRY-RUN ===", bold=True)
        click.echo(f"Total hilos: {len(thread_ids)}")
        click.echo(f"Ya en BD:    {len(already)}")
        click.secho(f"Pendientes:  {len(to_process)}", fg="green", bold=True)
        sys.exit(0)

    click.secho(f"\n=== INGESTA GMAIL BULK ({len(to_process)} hilos) ===", bold=True)
    ok = 0
    failed: list[tuple[str, str]] = []

    for i, tid in enumerate(to_process, 1):
        prefix = f"[{i:>4}/{len(to_process)}]"
        t0 = time.time()
        try:
            result = ingest_gmail_thread(tid)
            elapsed = time.time() - t0
            click.secho(
                f"{prefix} OK {result.chunks_written} chunks  "
                f"[{result.tipo_documento or '-'}]  {elapsed:.1f}s  {result.title[:60]}",
                fg="green",
            )
            ok += 1
        except ValueError as exc:
            # Hilos vacíos — saltamos silenciosamente
            click.echo(f"{prefix} SKIP: {str(exc)[:80]}")
        except Exception as exc:
            elapsed = time.time() - t0
            msg = str(exc)[:150]
            click.secho(f"{prefix} FAIL ({elapsed:.1f}s): {msg}", fg="red", err=True)
            failed.append((tid, msg))

    skipped = len(thread_ids) - len(to_process)
    click.secho("\n=== RESUMEN ===", bold=True)
    click.secho(f"  OK:       {ok}", fg="green")
    click.secho(f"  Saltados: {skipped} (ya en BD)", fg="yellow")
    click.secho(f"  Fallidos: {len(failed)}", fg="red" if failed else None)
    if failed:
        click.secho("\nErrores:", fg="red", bold=True)
        for tid, msg in failed:
            click.echo(f"  - {tid}: {msg}")


if __name__ == "__main__":
    main()
