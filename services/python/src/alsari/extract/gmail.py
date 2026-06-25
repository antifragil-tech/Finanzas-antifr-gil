"""Extractor de Gmail: lista hilos y extrae texto de mensajes.

Usa el mismo token OAuth que Drive (gmail.readonly ya incluido en los scopes).
Cada hilo se trata como un documento: todos sus mensajes concatenados.
"""

from __future__ import annotations

import base64
import email
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from alsari.extract.drive import get_drive_service


def get_gmail_service():
    """Reutiliza el token OAuth de Drive (mismo archivo google_token.json)."""
    from googleapiclient.discovery import build
    from alsari.extract.drive import get_drive_service as _auth

    # Forzamos autenticación para obtener las credenciales
    drive_svc = _auth()
    creds = drive_svc._http.credentials  # type: ignore[attr-defined]
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


@dataclass
class GmailThread:
    thread_id: str
    subject: str
    participants: list[str]
    date_first: datetime | None
    date_last: datetime | None
    message_count: int
    text: str
    source_url: str


def list_threads_since(after_date: str, max_results: int = 500) -> list[str]:
    """Lista IDs de hilos desde una fecha (formato YYYY/MM/DD).

    Filtra solo correos relevantes (excluye newsletters, notificaciones automáticas).
    """
    service = get_gmail_service()
    query = f"after:{after_date} -label:spam -label:trash"
    thread_ids: list[str] = []
    page_token = None

    while len(thread_ids) < max_results:
        kwargs: dict = {"userId": "me", "q": query, "maxResults": min(500, max_results - len(thread_ids))}
        if page_token:
            kwargs["pageToken"] = page_token
        resp = service.users().threads().list(**kwargs).execute()
        for t in resp.get("threads", []):
            thread_ids.append(t["id"])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return thread_ids


def fetch_thread(thread_id: str) -> GmailThread:
    """Descarga un hilo completo y extrae texto de todos sus mensajes."""
    service = get_gmail_service()
    data = service.users().threads().get(
        userId="me", id=thread_id, format="full"
    ).execute()

    messages = data.get("messages", [])
    subject = ""
    participants: set[str] = set()
    texts: list[str] = []
    dates: list[datetime] = []

    for msg in messages:
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}

        if not subject:
            subject = headers.get("subject", "(sin asunto)")

        for field in ("from", "to", "cc"):
            val = headers.get(field, "")
            for addr in re.findall(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]+", val):
                participants.add(addr)

        ts = msg.get("internalDate")
        if ts:
            dates.append(datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc))

        body = _extract_body(msg.get("payload", {}))
        if body.strip():
            date_str = headers.get("date", "")
            sender = headers.get("from", "")
            texts.append(f"[{date_str}] De: {sender}\n{body.strip()}")

    full_text = "\n\n---\n\n".join(texts)
    date_first = min(dates) if dates else None
    date_last = max(dates) if dates else None

    return GmailThread(
        thread_id=thread_id,
        subject=subject,
        participants=sorted(participants),
        date_first=date_first,
        date_last=date_last,
        message_count=len(messages),
        text=full_text,
        source_url=f"https://mail.google.com/mail/u/0/#all/{thread_id}",
    )


def _extract_body(payload: dict) -> str:
    """Extrae texto plano de un mensaje (recursivo para multipart)."""
    mime = payload.get("mimeType", "")

    if mime == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
        return ""

    if mime.startswith("multipart/"):
        parts = payload.get("parts", [])
        # Prefiere text/plain; ignora text/html si hay plain
        plain_parts = [p for p in parts if p.get("mimeType") == "text/plain"]
        if plain_parts:
            return _extract_body(plain_parts[0])
        # Recurse into multipart parts
        for part in parts:
            text = _extract_body(part)
            if text.strip():
                return text

    return ""
