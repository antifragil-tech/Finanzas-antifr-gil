"""Fase 5 — Sincronización incremental diaria: Drive + Gmail.

Uso:
    python scripts/daily_sync.py            # sync normal
    python scripts/daily_sync.py --init     # inicializa tokens (primera vez)
    python scripts/daily_sync.py --dry-run  # muestra cambios sin procesar

Diseño:
  - Drive:  changes.list con startPageToken persistido en alsari_sync_state
  - Gmail:  history.list con historyId persistido en alsari_sync_state
  - Idempotente: upsert en (source_id, chunk_index)
  - Re-ingesta limpia: delete_by_source antes de re-ingestar docs modificados
"""

from __future__ import annotations

import sys
import time
from datetime import datetime, timezone

import click

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from alsari.db.supabase import delete_by_source, get_client
from alsari.extract.drive import SUPPORTED_MIMES, get_drive_service
from alsari.extract.gmail import get_gmail_service, list_threads_since
from alsari.pipeline.ingest import ingest_drive_file, ingest_gmail_thread

STATE_TABLE = "alsari_sync_state"
KEY_DRIVE = "drive_page_token"
KEY_GMAIL = "gmail_history_id"


# ── Estado ────────────────────────────────────────────────────────────────────

def _get_state(key: str) -> str | None:
    r = get_client().table(STATE_TABLE).select("value").eq("key", key).execute()
    return r.data[0]["value"] if r.data else None


def _set_state(key: str, value: str) -> None:
    get_client().table(STATE_TABLE).upsert(
        {"key": key, "value": value, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).execute()


# ── Drive ─────────────────────────────────────────────────────────────────────

def _drive_get_start_token() -> str:
    svc = get_drive_service()
    return svc.changes().getStartPageToken().execute()["startPageToken"]


def _sync_drive(dry_run: bool) -> tuple[int, int, int]:
    """Devuelve (ok, skipped, failed)."""
    token = _get_state(KEY_DRIVE)
    if not token:
        click.secho("  Drive: no hay token — ejecuta --init primero", fg="yellow")
        return 0, 0, 0

    svc = get_drive_service()
    changed: list[dict] = []
    page_token = token

    while True:
        resp = svc.changes().list(
            pageToken=page_token,
            fields="nextPageToken,newStartPageToken,changes(fileId,removed,file(name,mimeType,webViewLink))",
            includeRemoved=True,
            spaces="drive",
        ).execute()
        changed.extend(resp.get("changes", []))
        page_token = resp.get("nextPageToken")
        new_token = resp.get("newStartPageToken")
        if not page_token:
            if new_token and not dry_run:
                _set_state(KEY_DRIVE, new_token)
            break

    if not changed:
        click.echo("  Drive: sin cambios.")
        return 0, 0, 0

    click.echo(f"  Drive: {len(changed)} cambios detectados")
    ok = skipped = failed = 0

    for ch in changed:
        file_id = ch["fileId"]
        removed = ch.get("removed", False)
        f = ch.get("file") or {}
        mime = f.get("mimeType", "")
        name = f.get("name", file_id)

        if removed:
            if not dry_run:
                delete_by_source(file_id)
            click.echo(f"    DEL  {name}")
            skipped += 1
            continue

        if mime not in SUPPORTED_MIMES:
            skipped += 1
            continue

        click.echo(f"    SYNC [{mime.split('/')[-1][:8]}] {name[:60]}")
        if dry_run:
            skipped += 1
            continue

        t0 = time.time()
        try:
            delete_by_source(file_id)
            result = ingest_drive_file(file_id)
            click.secho(f"         OK {result.chunks_written} chunks  {time.time()-t0:.1f}s", fg="green")
            ok += 1
        except Exception as exc:
            click.secho(f"         FAIL: {str(exc)[:120]}", fg="red")
            failed += 1

    return ok, skipped, failed


# ── Gmail ─────────────────────────────────────────────────────────────────────

def _gmail_get_history_id() -> str:
    svc = get_gmail_service()
    profile = svc.users().getProfile(userId="me").execute()
    return str(profile["historyId"])


def _sync_gmail(dry_run: bool) -> tuple[int, int, int]:
    """Devuelve (ok, skipped, failed)."""
    history_id = _get_state(KEY_GMAIL)
    if not history_id:
        click.secho("  Gmail: no hay historyId — ejecuta --init primero", fg="yellow")
        return 0, 0, 0

    svc = get_gmail_service()
    thread_ids: set[str] = set()
    page_token = None

    try:
        while True:
            kwargs: dict = {
                "userId": "me",
                "startHistoryId": history_id,
                "historyTypes": ["messageAdded"],
            }
            if page_token:
                kwargs["pageToken"] = page_token
            resp = svc.users().history().list(**kwargs).execute()

            for entry in resp.get("history", []):
                for msg in entry.get("messagesAdded", []):
                    thread_ids.add(msg["message"]["threadId"])

            page_token = resp.get("nextPageToken")
            new_history_id = resp.get("historyId")
            if not page_token:
                if new_history_id and not dry_run:
                    _set_state(KEY_GMAIL, str(new_history_id))
                break

    except Exception as exc:
        if "Invalid startHistoryId" in str(exc):
            click.secho("  Gmail: historyId expirado — re-ejecuta --init", fg="yellow")
        else:
            raise

    if not thread_ids:
        click.echo("  Gmail: sin mensajes nuevos.")
        return 0, 0, 0

    click.echo(f"  Gmail: {len(thread_ids)} hilos con actividad nueva")
    ok = skipped = failed = 0

    for tid in thread_ids:
        if dry_run:
            click.echo(f"    SYNC thread/{tid}")
            skipped += 1
            continue
        t0 = time.time()
        try:
            delete_by_source(tid)
            result = ingest_gmail_thread(tid)
            click.secho(f"    OK {result.chunks_written} chunks  {time.time()-t0:.1f}s  {result.title[:55]}", fg="green")
            ok += 1
        except ValueError:
            skipped += 1
        except Exception as exc:
            click.secho(f"    FAIL: {str(exc)[:120]}", fg="red")
            failed += 1

    return ok, skipped, failed


# ── CLI ───────────────────────────────────────────────────────────────────────

@click.command()
@click.option("--init", is_flag=True, help="Guarda tokens actuales (no sincroniza). Usar la primera vez.")
@click.option("--dry-run", is_flag=True, help="Muestra cambios sin procesar nada.")
def main(init: bool, dry_run: bool) -> None:
    if init:
        drive_token = _drive_get_start_token()
        gmail_id = _gmail_get_history_id()
        _set_state(KEY_DRIVE, drive_token)
        _set_state(KEY_GMAIL, gmail_id)
        click.secho("Tokens guardados:", bold=True)
        click.echo(f"  Drive pageToken : {drive_token}")
        click.echo(f"  Gmail historyId : {gmail_id}")
        click.echo("A partir de ahora, daily_sync.py detectará solo los cambios nuevos.")
        return

    label = "[DRY-RUN] " if dry_run else ""
    click.secho(f"\n{label}=== Alsari Daily Sync — {datetime.now().strftime('%Y-%m-%d %H:%M')} ===", bold=True)

    click.echo("\n--- Drive ---")
    d_ok, d_skip, d_fail = _sync_drive(dry_run)

    click.echo("\n--- Gmail ---")
    g_ok, g_skip, g_fail = _sync_gmail(dry_run)

    click.secho("\n=== RESUMEN ===", bold=True)
    click.secho(f"  Drive  — OK: {d_ok}  Saltados: {d_skip}  Fallidos: {d_fail}", fg="green" if not d_fail else "yellow")
    click.secho(f"  Gmail  — OK: {g_ok}  Saltados: {g_skip}  Fallidos: {g_fail}", fg="green" if not g_fail else "yellow")


if __name__ == "__main__":
    main()
