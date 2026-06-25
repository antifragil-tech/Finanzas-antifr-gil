"""Alertas de vencimientos: escanea alsari_hitos y envía email vía Gmail API."""

from __future__ import annotations

import base64
from datetime import date, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from alsari.db.supabase import get_client
from alsari.extract.drive import get_drive_service


def get_gmail_send_service():
    svc = get_drive_service()
    from googleapiclient.discovery import build
    creds = svc._http.credentials  # type: ignore[attr-defined]
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def check_and_alert(to_email: str, dry_run: bool = False) -> list[dict]:
    """Comprueba hitos próximos y envía email si hay alertas. Devuelve lista de alertas."""
    today = date.today()
    client = get_client()

    rows = (
        client.table("alsari_hitos")
        .select("*")
        .eq("activo", True)
        .execute()
        .data
    )

    alertas: list[dict] = []
    for h in rows:
        fecha = date.fromisoformat(h["fecha"])
        dias_restantes = (fecha - today).days
        if dias_restantes < 0:
            continue  # ya vencido

        umbrales = h.get("alerta_dias") or [30, 7, 1]
        if dias_restantes in umbrales:
            alertas.append({
                "descripcion": h["descripcion"],
                "fecha": fecha,
                "dias_restantes": dias_restantes,
                "importe": h.get("importe"),
                "sociedad": h.get("sociedad", ""),
                "notas": h.get("notas", ""),
            })

    if not alertas:
        return []

    if not dry_run:
        _send_email(get_gmail_send_service(), to_email, alertas, today)

    return alertas


def _send_email(service, to_email: str, alertas: list[dict], today: date) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Alsari — {len(alertas)} vencimiento(s) próximo(s)"
    msg["From"] = to_email
    msg["To"] = to_email

    lines_text = [f"Alsari — Alertas de vencimiento ({today})\n"]
    lines_html = [
        "<html><body>",
        f"<h2>Alsari — Alertas de vencimiento ({today})</h2>",
        "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse'>",
        "<tr><th>Días</th><th>Fecha</th><th>Descripción</th><th>Sociedad</th><th>Importe</th><th>Notas</th></tr>",
    ]

    for a in sorted(alertas, key=lambda x: x["dias_restantes"]):
        importe_str = f"{a['importe']:,.0f} €" if a["importe"] else "—"
        urgencia = "🔴" if a["dias_restantes"] <= 7 else "🟡" if a["dias_restantes"] <= 30 else "🟢"
        lines_text.append(
            f"{urgencia} {a['dias_restantes']} días — {a['fecha']}  {a['descripcion']}\n"
            f"   Sociedad: {a['sociedad']}  |  Importe: {importe_str}\n"
            f"   {a['notas']}\n"
        )
        color = "#ffcccc" if a["dias_restantes"] <= 7 else "#fff3cd" if a["dias_restantes"] <= 30 else "#d4edda"
        lines_html.append(
            f"<tr style='background:{color}'>"
            f"<td><b>{a['dias_restantes']}d</b></td>"
            f"<td>{a['fecha']}</td>"
            f"<td>{a['descripcion']}</td>"
            f"<td>{a['sociedad']}</td>"
            f"<td>{importe_str}</td>"
            f"<td>{a['notas']}</td>"
            f"</tr>"
        )

    lines_html += ["</table></body></html>"]

    msg.attach(MIMEText("\n".join(lines_text), "plain", "utf-8"))
    msg.attach(MIMEText("".join(lines_html), "html", "utf-8"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
