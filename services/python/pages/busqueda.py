"""Búsqueda semántica en la base de conocimiento."""

from __future__ import annotations

import streamlit as st

from alsari.config import AREAS, SOCIEDADES, TIPOS_DOCUMENTO
from alsari.db.supabase import get_client
from alsari.pipeline.embedder import embed_query

st.markdown("""
<div class="page-h">Búsqueda</div>
<div class="page-s">Consulta semántica sobre toda la documentación de Alsari</div>
""", unsafe_allow_html=True)

with st.form("sf"):
    query = st.text_input("", placeholder="Ej: préstamo Perisur, vencimiento seguro Campanillas…",
                          label_visibility="collapsed")
    fa, fb, fc, fd = st.columns([2, 2, 2, 1])
    sociedad = fa.selectbox("Sociedad", ["Todas"] + SOCIEDADES)
    area     = fb.selectbox("Área",     ["Todas"] + AREAS)
    tipo     = fc.selectbox("Tipo",     ["Todos"] + TIPOS_DOCUMENTO)
    n        = fd.slider("Resultados", 3, 20, 8)
    ok = st.form_submit_button("Buscar →", use_container_width=True, type="primary")

if ok and query.strip():
    with st.spinner("Buscando…"):
        emb     = embed_query(query.strip())
        results = (
            get_client()
            .rpc("search_alsari", {"query_embedding": emb, "match_count": n})
            .execute().data or []
        )

    if sociedad != "Todas": results = [r for r in results if sociedad in (r.get("sociedades") or [])]
    if area     != "Todas": results = [r for r in results if r.get("area") == area]
    if tipo     != "Todos": results = [r for r in results if r.get("tipo_documento") == tipo]

    if not results:
        st.markdown("""
        <div class="card" style="text-align:center;padding:48px 24px;">
            <div style="font-size:2rem;margin-bottom:12px;">🔍</div>
            <div style="color:#e4e4e7;font-weight:600;margin-bottom:6px;">Sin resultados</div>
            <div style="color:#71717a;font-size:0.85rem;">Prueba con otra consulta o amplía los filtros</div>
        </div>""", unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="section-label">{len(results)} resultado(s) — "{query}"</div>',
                    unsafe_allow_html=True)

        for i, r in enumerate(results, 1):
            title   = r.get("source_title") or "Sin título"
            url     = r.get("source_url", "")
            tipo_d  = r.get("tipo_documento") or "—"
            fecha   = r.get("fecha_documento") or "—"
            socs    = ", ".join(r.get("sociedades") or []) or "—"
            content = r.get("content", "")
            sim     = r.get("similarity", 0)

            if sim > 0.75:   rel_color, rel_label = "#34d399", "Alta"
            elif sim > 0.60: rel_color, rel_label = "#fbbf24", "Media"
            else:            rel_color, rel_label = "#f87171", "Baja"

            with st.expander(f"{title}", expanded=(i <= 2)):
                # Metadatos
                st.markdown(f"""
                <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px;">
                    <span style="font-size:0.78rem;color:#a1a1aa;">
                        📋 <span style="color:#e4e4e7;font-weight:600;">{tipo_d}</span>
                    </span>
                    <span style="font-size:0.78rem;color:#a1a1aa;">
                        📅 <span style="color:#e4e4e7;font-weight:600;">{fecha}</span>
                    </span>
                    <span style="font-size:0.78rem;color:#a1a1aa;">
                        🏢 <span style="color:#e4e4e7;font-weight:600;">{socs}</span>
                    </span>
                    <span style="font-size:0.75rem;font-weight:700;
                                 background:rgba(255,255,255,0.05);
                                 padding:2px 10px;border-radius:99px;
                                 color:{rel_color};">
                        {sim:.0%} · {rel_label}
                    </span>
                </div>
                """, unsafe_allow_html=True)

                # Extracto
                st.markdown(f"""
                <div style="background:#0d0d0f;border:1px solid rgba(255,255,255,0.06);
                            border-radius:12px;padding:16px 20px;
                            font-size:0.85rem;line-height:1.7;color:#a1a1aa;">
                    {content[:700]}{"…" if len(content) > 700 else ""}
                </div>
                """, unsafe_allow_html=True)

                if url:
                    st.markdown(f"""
                    <div style="margin-top:12px;">
                        <a href="{url}" target="_blank"
                           style="font-size:0.8rem;color:#60a5fa;text-decoration:none;font-weight:600;">
                            ↗ Abrir documento original
                        </a>
                    </div>""", unsafe_allow_html=True)

elif ok:
    st.warning("Introduce una consulta para buscar.")
