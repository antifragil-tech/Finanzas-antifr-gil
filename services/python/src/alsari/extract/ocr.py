"""OCR de PDFs escaneados vía Gemini.

Renderiza cada página con pypdfium2 (PNG en memoria) y la envía a Gemini
pidiendo transcripción literal. Evita alucinaciones con un prompt explícito
que obliga a marcar fragmentos ilegibles como [ILEGIBLE].

Solo se invoca cuando pypdf devuelve texto vacío — los PDFs digitales no pasan
por aquí, así que no pagamos tokens innecesarios.
"""

from __future__ import annotations

from io import BytesIO

import pypdfium2 as pdfium
from google import genai
from google.genai import types

from alsari.config import get_settings

_OCR_PROMPT = """Transcribe literalmente el texto de esta página de documento.

Reglas ESTRICTAS:
- NO parafrasees, resumas ni añadas comentarios propios.
- NO inventes texto. Si un fragmento es ilegible o está cortado, escribe [ILEGIBLE].
- Preserva la estructura: si hay tablas, reprodúcelas en formato Markdown.
- Preserva saltos de párrafo y listas numeradas.
- Devuelve SOLO el texto transcrito. Nada de introducciones, explicaciones, ni frases tipo "Aquí está la transcripción".
""".strip()


def ocr_pdf(data: bytes) -> str:
    """OCR del PDF completo. Devuelve texto concatenado con separador de página."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY no configurada en .env — necesaria para OCR")

    client = genai.Client(api_key=settings.gemini_api_key)
    pdf = pdfium.PdfDocument(data)
    scale = settings.ocr_render_dpi / 72.0

    pages_text: list[str] = []
    for i, page in enumerate(pdf, start=1):
        png_bytes = _render_page_png(page, scale)
        text = _ocr_image(client, settings.gemini_model, png_bytes)
        if text.strip():
            pages_text.append(text.strip())

    return "\n\n".join(pages_text)


def _render_page_png(page: pdfium.PdfPage, scale: float) -> bytes:
    bitmap = page.render(scale=scale)
    pil_image = bitmap.to_pil()
    buf = BytesIO()
    pil_image.save(buf, format="PNG")
    return buf.getvalue()


def _ocr_image(client: genai.Client, model: str, png_bytes: bytes) -> str:
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=png_bytes, mime_type="image/png"),
            _OCR_PROMPT,
        ],
    )
    return response.text or ""
