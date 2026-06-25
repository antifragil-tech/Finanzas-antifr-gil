"""Genera borradores de respuesta automáticos para emails sin responder.

Uso:
    python scripts/generate_drafts.py              # genera borradores
    python scripts/generate_drafts.py --dry-run    # muestra emails sin crear borradores
    python scripts/generate_drafts.py --max 5      # limita a 5 borradores
"""

from __future__ import annotations

import sys
import time

import click

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from alsari.alerts.draft_replies import (
    MAX_DRAFTS_PER_RUN,
    find_unreplied_threads,
    generate_draft,
    save_draft,
)


@click.command()
@click.option("--dry-run", is_flag=True, help="Muestra emails sin crear borradores.")
@click.option("--max", "max_drafts", default=MAX_DRAFTS_PER_RUN, help="Máximo de borradores a generar.")
def main(dry_run: bool, max_drafts: int) -> None:
    click.echo("Buscando emails sin responder...")
    emails = find_unreplied_threads(max_results=max_drafts)

    if not emails:
        click.echo("No hay emails pendientes de respuesta.")
        return

    label = "[DRY-RUN] " if dry_run else ""
    click.secho(f"\n{label}=== {len(emails)} email(s) sin responder ===\n", bold=True)

    for i, email in enumerate(emails, 1):
        click.echo(f"[{i}/{len(emails)}] {email.sender[:40]}  |  {email.subject[:55]}")

        if dry_run:
            continue

        t0 = time.time()
        try:
            result = generate_draft(email)
            draft_id = save_draft(email, result.text, result.attachment_ids)
            atts = f" + {len(result.attachment_ids)} adjunto(s)" if result.attachment_ids else ""
            click.secho(f"         Borrador guardado{atts} ({time.time()-t0:.1f}s)", fg="green")
        except Exception as exc:
            click.secho(f"         FAIL: {str(exc)[:120]}", fg="red")

    if not dry_run:
        click.secho(f"\nBorradores guardados en Gmail. Revisalos antes de enviar.", fg="cyan")


if __name__ == "__main__":
    main()
