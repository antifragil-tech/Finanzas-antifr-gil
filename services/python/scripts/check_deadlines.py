"""Fase 6 — Comprobación diaria de vencimientos y envío de alertas por email.

Uso:
    python scripts/check_deadlines.py
    python scripts/check_deadlines.py --dry-run   # muestra alertas sin enviar email
    python scripts/check_deadlines.py --test       # fuerza envío aunque no haya alertas hoy
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

import click

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from alsari.alerts.deadlines import check_and_alert
from alsari.db.supabase import get_client

TO_EMAIL = "guillermovila@alsari.net"


@click.command()
@click.option("--dry-run", is_flag=True, help="Muestra alertas sin enviar email.")
@click.option("--test", is_flag=True, help="Envía email de prueba con todos los hitos activos.")
def main(dry_run: bool, test: bool) -> None:
    if test:
        _send_test()
        return

    alertas = check_and_alert(TO_EMAIL, dry_run=dry_run)

    if not alertas:
        click.echo(f"[{date.today()}] Sin vencimientos que alertar hoy.")
        return

    label = "[DRY-RUN] " if dry_run else ""
    click.secho(f"\n{label}=== {len(alertas)} alerta(s) ===", bold=True)
    for a in sorted(alertas, key=lambda x: x["dias_restantes"]):
        importe = f"  EUR {a['importe']:,.0f}" if a["importe"] else ""
        click.secho(
            f"  {a['dias_restantes']:>4} dias  {a['fecha']}  {a['descripcion']}{importe}",
            fg="red" if a["dias_restantes"] <= 7 else "yellow" if a["dias_restantes"] <= 30 else "green",
        )

    if not dry_run:
        click.secho(f"\nEmail enviado a {TO_EMAIL}", fg="green")


def _send_test() -> None:
    """Envía email con todos los hitos activos como prueba."""
    from alsari.alerts.deadlines import _send_email, get_gmail_send_service
    client = get_client()
    rows = client.table("alsari_hitos").select("*").eq("activo", True).order("fecha").execute().data

    alertas = [
        {
            "descripcion": h["descripcion"],
            "fecha": date.fromisoformat(h["fecha"]),
            "dias_restantes": (date.fromisoformat(h["fecha"]) - date.today()).days,
            "importe": h.get("importe"),
            "sociedad": h.get("sociedad", ""),
            "notas": h.get("notas", ""),
        }
        for h in rows
        if (date.fromisoformat(h["fecha"]) - date.today()).days >= 0
    ]

    if not alertas:
        click.echo("No hay hitos activos futuros.")
        return

    _send_email(get_gmail_send_service(), TO_EMAIL, alertas, date.today())
    click.secho(f"Email de prueba enviado a {TO_EMAIL} con {len(alertas)} hitos.", fg="green")


if __name__ == "__main__":
    main()
