"""Router de Google Drive: autenticación, descarga por ID/URL, detección de MIME."""

from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from alsari.config import get_settings
from alsari.extract import docx as docx_extract
from alsari.extract import gdocs as gdocs_extract
from alsari.extract import pdf as pdf_extract
from alsari.extract import xlsx as xlsx_extract

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
]

MIME_PDF = "application/pdf"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_GDOC = "application/vnd.google-apps.document"
MIME_GSHEET = "application/vnd.google-apps.spreadsheet"
MIME_FOLDER = "application/vnd.google-apps.folder"

SUPPORTED_MIMES = {MIME_PDF, MIME_DOCX, MIME_XLSX, MIME_GDOC, MIME_GSHEET}


@dataclass
class DriveFile:
    """Resultado de la descarga: texto extraído + metadatos para ingesta."""

    file_id: str
    title: str
    mime_type: str
    source_type: str
    source_url: str
    text: str


@dataclass
class DriveFileInfo:
    """Metadatos mínimos de un archivo (sin descargar contenido). Para listados."""

    file_id: str
    name: str
    mime_type: str
    path: str
    web_view_link: str
    size_bytes: int | None


def get_drive_service():
    """Autenticación OAuth. La primera vez abre navegador; luego usa token cacheado."""
    s = get_settings()
    creds: Credentials | None = None
    token_path: Path = s.google_token_path
    creds_path: Path = s.google_credentials_path

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                raise FileNotFoundError(
                    f"Falta credentials.json en {creds_path}. "
                    "Descárgalo desde Google Cloud Console (OAuth client ID desktop)."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return build("drive", "v3", credentials=creds, cache_discovery=False)


def extract_file_id(url_or_id: str) -> str:
    """Acepta un ID directo o URL de Drive (/file/d/ID/, /folders/ID, ?id=ID)."""
    s = url_or_id.strip()
    m = (
        re.search(r"/folders/([a-zA-Z0-9_-]+)", s)
        or re.search(r"/d/([a-zA-Z0-9_-]+)", s)
        or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", s)
    )
    return m.group(1) if m else s


def download_and_extract(url_or_id: str) -> DriveFile:
    """Descarga el archivo de Drive y devuelve texto extraído + metadatos."""
    service = get_drive_service()
    file_id = extract_file_id(url_or_id)

    meta = (
        service.files()
        .get(fileId=file_id, fields="id, name, mimeType, webViewLink")
        .execute()
    )
    mime = meta["mimeType"]
    title = meta["name"]
    url = meta.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")

    text, source_type = _download_by_mime(service, file_id, mime)

    return DriveFile(
        file_id=file_id,
        title=title,
        mime_type=mime,
        source_type=source_type,
        source_url=url,
        text=text,
    )


def list_folder_recursive(folder_url_or_id: str) -> list[DriveFileInfo]:
    """Lista recursivamente todos los archivos de una carpeta y sub-carpetas.

    No incluye las carpetas como entradas — solo archivos. Devuelve la ruta
    relativa (tipo "Subcarpeta/Doc.pdf") para legibilidad.
    """
    service = get_drive_service()
    folder_id = extract_file_id(folder_url_or_id)
    results: list[DriveFileInfo] = []
    _walk(service, folder_id, "", results)
    return results


def _walk(service, folder_id: str, prefix: str, out: list[DriveFileInfo]) -> None:
    page_token: str | None = None
    while True:
        resp = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, mimeType, webViewLink, size)",
                pageSize=1000,
                pageToken=page_token,
            )
            .execute()
        )
        for f in resp.get("files", []):
            path = f"{prefix}/{f['name']}" if prefix else f["name"]
            if f["mimeType"] == MIME_FOLDER:
                _walk(service, f["id"], path, out)
            else:
                size = int(f["size"]) if f.get("size") else None
                out.append(
                    DriveFileInfo(
                        file_id=f["id"],
                        name=f["name"],
                        mime_type=f["mimeType"],
                        path=path,
                        web_view_link=f.get("webViewLink", ""),
                        size_bytes=size,
                    )
                )
        page_token = resp.get("nextPageToken")
        if not page_token:
            break


def _download_by_mime(service, file_id: str, mime: str) -> tuple[str, str]:
    if mime == MIME_PDF:
        return pdf_extract.extract_text(_download_binary(service, file_id)), "drive_pdf"
    if mime == MIME_DOCX:
        return docx_extract.extract_text(_download_binary(service, file_id)), "drive_docx"
    if mime == MIME_XLSX:
        return xlsx_extract.extract_text(_download_binary(service, file_id)), "drive_xlsx"
    if mime == MIME_GDOC:
        exported = _export(service, file_id, "text/plain")
        return gdocs_extract.extract_text(exported), "drive_gdoc"
    if mime == MIME_GSHEET:
        exported = _export(service, file_id, "text/csv")
        return xlsx_extract.extract_from_csv(exported), "drive_gsheet"
    raise ValueError(f"MIME no soportado: {mime}")


def _download_binary(service, file_id: str) -> bytes:
    request = service.files().get_media(fileId=file_id)
    buffer = BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue()


def _export(service, file_id: str, mime_type: str) -> bytes:
    request = service.files().export_media(fileId=file_id, mimeType=mime_type)
    buffer = BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue()


# Mapeo de Google-native a formato exportable como adjunto
_GOOGLE_EXPORT_MAP = {
    MIME_GDOC:   ("application/pdf", ".pdf"),
    MIME_GSHEET: ("application/pdf", ".pdf"),
    "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
}


def download_file_for_attachment(file_id: str) -> tuple[bytes, str, str]:
    """Descarga un fichero de Drive en bytes para adjuntar a un email.

    - PDFs/DOCX/XLSX: bytes nativos, mime y nombre originales.
    - Google Docs/Sheets/Slides: exporta a PDF, mime application/pdf, nombre con .pdf añadido.

    Devuelve (bytes, mime_type, filename).
    """
    service = get_drive_service()
    meta = (
        service.files()
        .get(fileId=file_id, fields="id, name, mimeType")
        .execute()
    )
    name = meta["name"]
    mime = meta["mimeType"]

    if mime in _GOOGLE_EXPORT_MAP:
        export_mime, suffix = _GOOGLE_EXPORT_MAP[mime]
        data = _export(service, file_id, export_mime)
        if not name.lower().endswith(suffix):
            name = f"{name}{suffix}"
        return data, export_mime, name

    # Nativo: descarga binaria directa
    return _download_binary(service, file_id), mime, name
