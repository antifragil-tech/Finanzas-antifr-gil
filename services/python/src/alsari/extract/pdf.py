"""Extracción de texto de PDFs con fallback a OCR vía Gemini.

Estrategia:
1. Intenta `pypdf` primero — rápido y gratuito para PDFs digitales.
2. Si el texto extraído es vacío (PDF escaneado, solo imágenes), cae
   automáticamente a `ocr.ocr_pdf` que usa Gemini para reconocer texto.
"""

from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_text(data: bytes) -> str:
    """Extrae texto plano de un PDF. Usa OCR si pypdf no encuentra texto."""
    text = _extract_with_pypdf(data)
    if text.strip():
        return text

    from alsari.extract.ocr import ocr_pdf
    return ocr_pdf(data)


def _extract_with_pypdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text.strip())
    return "\n\n".join(pages)
