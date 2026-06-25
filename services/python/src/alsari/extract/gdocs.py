"""Extracción de Google Docs: se exporta directamente desde la API a texto plano."""

from __future__ import annotations


def extract_text(exported_bytes: bytes) -> str:
    """Los bytes ya vienen exportados como text/plain desde la Drive API."""
    return exported_bytes.decode("utf-8", errors="replace")
