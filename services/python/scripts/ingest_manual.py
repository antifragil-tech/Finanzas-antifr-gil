"""Fase 3b — CLI para ingestar un único documento de Google Drive.

Uso:
    python scripts/ingest_manual.py <url-o-id-de-drive>

Ejemplos:
    python scripts/ingest_manual.py https://drive.google.com/file/d/1A2B3C.../view
    python scripts/ingest_manual.py 1A2B3C...
"""

from __future__ import annotations

import sys

import click

from alsari.pipeline.ingest import ingest_drive_file


@click.command()
@click.argument("url_or_id")
def main(url_or_id: str) -> None:
    click.echo(f"Ingestando: {url_or_id}\n")
    try:
        result = ingest_drive_file(url_or_id)
    except Exception as exc:
        click.secho(f"ERROR: {exc}", fg="red", err=True)
        sys.exit(1)

    click.secho("Completado", fg="green", bold=True)
    click.echo(f"  Archivo:         {result.title}")
    click.echo(f"  File ID:         {result.file_id}")
    click.echo(f"  Chunks escritos: {result.chunks_written}")
    click.echo(f"  Tipo documento:  {result.tipo_documento or '-'}")
    click.echo(f"  Sociedades:      {', '.join(result.sociedades) or '-'}")
    click.echo(f"  Proyectos:       {', '.join(result.proyectos) or '-'}")


if __name__ == "__main__":
    main()
