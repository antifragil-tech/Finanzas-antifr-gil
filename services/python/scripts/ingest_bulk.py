"""Fase 4 — Ingesta bulk recursiva de una carpeta de Google Drive.

Uso:
    python scripts/ingest_bulk.py <url-o-id-carpeta> [--dry-run] [--force]

Flags:
    --dry-run   Lista archivos y estadísticas sin procesar nada.
    --force     Re-ingesta archivos aunque ya existan en Supabase.

Por defecto, archivos ya presentes en la BD (por source_id) se saltan — así
puedes reanudar una bulk interrumpida sin volver a pagar por OCR/clasificación.
"""

from __future__ import annotations

import sys
import time
from collections import Counter

import click

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from alsari.db.supabase import get_client
from alsari.extract.drive import SUPPORTED_MIMES, DriveFileInfo, list_folder_recursive
from alsari.pipeline.ingest import ingest_drive_file


def _get_ingested_ids() -> set[str]:
    """Devuelve los source_id ya presentes en la BD."""
    client = get_client()
    ids: set[str] = set()
    offset = 0
    while True:
        res = client.table("alsari_knowledge").select("source_id").range(offset, offset + 999).execute()
        for row in res.data:
            if row.get("source_id"):
                ids.add(row["source_id"])
        if len(res.data) < 1000:
            break
        offset += 1000
    return ids


def _fmt_size(size: int | None) -> str:
    if size is None:
        return "—"
    if size < 1024:
        return f"{size}B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f}KB"
    return f"{size / (1024 * 1024):.1f}MB"


def _mime_short(mime: str) -> str:
    return {
        "application/pdf": "PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
        "application/vnd.google-apps.document": "GDoc",
        "application/vnd.google-apps.spreadsheet": "GSheet",
    }.get(mime, mime.split("/")[-1][:12])


def _print_dry_run(files: list[DriveFileInfo], already: set[str]) -> None:
    supported: list[DriveFileInfo] = []
    unsupported: list[DriveFileInfo] = []
    for f in files:
        (supported if f.mime_type in SUPPORTED_MIMES else unsupported).append(f)

    by_type = Counter(_mime_short(f.mime_type) for f in supported)
    already_in_db = sum(1 for f in supported if f.file_id in already)
    new_to_ingest = len(supported) - already_in_db

    click.secho("\n=== DRY-RUN ===", bold=True)
    click.echo(f"Total archivos encontrados: {len(files)}")
    click.echo(f"Soportados:   {len(supported)}")
    click.echo(f"  Por tipo:   {dict(by_type)}")
    click.echo(f"  Ya en BD:   {already_in_db}")
    click.secho(f"  Pendientes: {new_to_ingest}", fg="green", bold=True)
    click.echo(f"No soportados: {len(unsupported)}")

    if unsupported:
        click.secho("\nArchivos NO soportados (se saltarán):", fg="yellow")
        for f in unsupported[:20]:
            click.echo(f"  - [{_mime_short(f.mime_type)}] {f.path}")
        if len(unsupported) > 20:
            click.echo(f"  ... y {len(unsupported) - 20} más")

    click.secho("\nArchivos a ingestar (primeros 30):", fg="cyan")
    pending = [f for f in supported if f.file_id not in already]
    for f in pending[:30]:
        click.echo(f"  [{_mime_short(f.mime_type):6}] {_fmt_size(f.size_bytes):>7}  {f.path}")
    if len(pending) > 30:
        click.echo(f"  ... y {len(pending) - 30} más")


def _run_bulk(files: list[DriveFileInfo], already: set[str], force: bool) -> None:
    supported = [f for f in files if f.mime_type in SUPPORTED_MIMES]
    to_process = [f for f in supported if force or f.file_id not in already]

    click.secho(f"\n=== INGESTA BULK ({len(to_process)} archivos) ===", bold=True)
    ok = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for i, f in enumerate(to_process, 1):
        prefix = f"[{i:>3}/{len(to_process)}]"
        click.echo(f"{prefix} {_mime_short(f.mime_type):6} {f.path}")
        t0 = time.time()
        try:
            result = ingest_drive_file(f.file_id)
            elapsed = time.time() - t0
            click.secho(
                f"      OK {result.chunks_written} chunks  "
                f"[{result.tipo_documento or '-'}]  {elapsed:.1f}s",
                fg="green",
            )
            ok += 1
        except Exception as exc:
            elapsed = time.time() - t0
            msg = str(exc)[:150]
            click.secho(f"      FAIL ({elapsed:.1f}s): {msg}", fg="red", err=True)
            failed.append((f.path, msg))

    skipped = len(supported) - len(to_process)
    click.secho("\n=== RESUMEN ===", bold=True)
    click.secho(f"  OK:       {ok}", fg="green")
    click.secho(f"  Saltados: {skipped} (ya en BD)", fg="yellow")
    click.secho(f"  Fallidos: {len(failed)}", fg="red" if failed else None)
    if failed:
        click.secho("\nErrores:", fg="red", bold=True)
        for path, msg in failed:
            click.echo(f"  - {path}")
            click.echo(f"      {msg}")


@click.command()
@click.argument("folder_url_or_id")
@click.option("--dry-run", is_flag=True, help="Solo lista, no procesa.")
@click.option("--force", is_flag=True, help="Re-ingesta aunque exista en BD.")
def main(folder_url_or_id: str, dry_run: bool, force: bool) -> None:
    click.echo(f"Listando carpeta: {folder_url_or_id}")
    files = list_folder_recursive(folder_url_or_id)
    click.echo(f"Archivos encontrados: {len(files)}")

    already = _get_ingested_ids()
    click.echo(f"Ya ingestados en BD: {len(already)} archivos únicos")

    if dry_run:
        _print_dry_run(files, already)
        sys.exit(0)

    _run_bulk(files, already, force)


if __name__ == "__main__":
    main()
