"""Estadísticas — visión general de la base de conocimiento."""

from __future__ import annotations

from datetime import datetime, timezone

import plotly.graph_objects as go
import streamlit as st

from alsari.db.supabase import get_client

st.markdown("""
<div class="page-h">Estadísticas</div>
<div class="page-s">Visión general del conocimiento indexado</div>
""", unsafe_allow_html=True)

CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#22d3ee", "#a78bfa"]
PLOTLY_BASE  = dict(
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Inter", color="#71717a", size=11),
    margin=dict(t=10, b=10, l=0, r=0),
    showlegend=True,
    legend=dict(font=dict(color="#a1a1aa", size=11), bgcolor="rgba(0,0,0,0)"),
)


@st.cache_data(ttl=120)
def _load():
    client = get_client()
    total  = client.table("alsari_knowledge").select("id", count="exact").limit(1).execute()

    ids: set = set()
    tipos: dict[str, int] = {}
    stypes: dict[str, int] = {}
    offset = 0
    while True:
        batch = (
            client.table("alsari_knowledge")
            .select("source_id,tipo_documento,source_type")
            .range(offset, offset + 999).execute()
        )
        for r in batch.data:
            if r.get("source_id"):    ids.add(r["source_id"])
            t = r.get("tipo_documento") or "sin clasificar"
            s = r.get("source_type")    or "—"
            tipos[t]  = tipos.get(t, 0)  + 1
            stypes[s] = stypes.get(s, 0) + 1
        if len(batch.data) < 1000: break
        offset += 1000

    recent = (
        client.table("alsari_knowledge")
        .select("source_title,source_type,fecha_ingesta,source_url")
        .order("fecha_ingesta", desc=True).limit(60).execute().data
    )
    seen, dedup = set(), []
    for r in recent:
        k = r.get("source_title", "")
        if k not in seen:
            seen.add(k); dedup.append(r)
        if len(dedup) >= 12: break

    sync = client.table("alsari_sync_state").select("*").execute().data or []
    return {"chunks": total.count or 0, "docs": len(ids),
            "tipos": tipos, "stypes": stypes, "recent": dedup, "sync": sync}


def _ago(iso):
    if not iso: return "—"
    try:
        secs = int((datetime.now(timezone.utc) -
                    datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds())
        if secs < 60:    return f"hace {secs}s"
        if secs < 3600:  return f"hace {secs//60} min"
        if secs < 86400: return f"hace {secs//3600}h"
        return f"hace {secs//86400}d"
    except Exception: return "—"


with st.spinner(""):
    d = _load()

# ── KPIs ──────────────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4)
for col, label, value, color, icon in [
    (c1, "Documentos únicos",  f"{d['docs']:,}",          "blue",  "description"),
    (c2, "Chunks indexados",   f"{d['chunks']:,}",         "blue",  "data_object"),
    (c3, "Tipos documentales", str(len(d["tipos"])),       "green", "category"),
    (c4, "Fuentes activas",    str(len(d["stypes"])),      "amber", "hub"),
]:
    col.markdown(f"""
    <div class="kpi-card {color}">
        <div class="icon"><span class="material-icons-round">{icon}</span></div>
        <div class="label">{label}</div>
        <div class="value">{value}</div>
    </div>""", unsafe_allow_html=True)

# ── Gráficos ──────────────────────────────────────────────────────────────────
st.markdown('<div class="section-label">Distribución del conocimiento</div>', unsafe_allow_html=True)
gl, gr = st.columns([3, 2])

with gl:
    if d["tipos"]:
        items = sorted(d["tipos"].items(), key=lambda x: x[1], reverse=True)
        labels, values = zip(*items)
        fig = go.Figure(go.Bar(
            x=list(labels), y=list(values),
            marker=dict(color=CHART_COLORS[:len(labels)], opacity=0.8,
                        line=dict(width=0)),
            text=list(values), textposition="outside",
            textfont=dict(color="#71717a", size=10),
        ))
        fig.update_layout(**PLOTLY_BASE, height=260,
                          xaxis=dict(tickfont=dict(size=10), gridcolor="rgba(255,255,255,0.04)"),
                          yaxis=dict(gridcolor="rgba(255,255,255,0.04)"))
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

with gr:
    if d["stypes"]:
        lmap = {"drive_pdf":"PDF","drive_docx":"Word","drive_gdoc":"Docs",
                "drive_xlsx":"Excel","drive_gsheet":"Sheets","gmail":"Gmail","manual":"Manual"}
        mapped = {lmap.get(k, k): v for k, v in d["stypes"].items()}
        fig2 = go.Figure(go.Pie(
            labels=list(mapped.keys()), values=list(mapped.values()),
            hole=0.65, marker=dict(colors=CHART_COLORS),
            textinfo="percent+label",
            textfont=dict(size=10, color="#a1a1aa"),
            insidetextorientation="radial",
        ))
        fig2.update_layout(**PLOTLY_BASE, height=260)
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

# ── Últimas ingestas ──────────────────────────────────────────────────────────
st.markdown('<div class="section-label">Últimas ingestas</div>', unsafe_allow_html=True)
ICONS = {"drive_pdf":"📄","drive_docx":"📝","drive_gdoc":"📝",
         "drive_xlsx":"📊","drive_gsheet":"📊","gmail":"✉️","manual":"📌"}
ca, cb = st.columns(2)
for i, r in enumerate(d["recent"]):
    title = r.get("source_title") or "Sin título"
    url   = r.get("source_url", "")
    icon  = ICONS.get(r.get("source_type",""), "📁")
    link  = f'<a href="{url}" target="_blank" style="color:#e4e4e7;text-decoration:none;">{title}</a>' if url else title
    [ca, cb][i % 2].markdown(f"""
    <div class="card" style="padding:14px 18px;">
        <div style="font-size:0.84rem;font-weight:600;color:#e4e4e7;">{icon}&nbsp;{link}</div>
        <div style="font-size:0.72rem;color:#71717a;margin-top:4px;">{_ago(r.get('fecha_ingesta'))}</div>
    </div>""", unsafe_allow_html=True)

# ── Sync ──────────────────────────────────────────────────────────────────────
if d["sync"]:
    st.markdown('<div class="section-label">Sincronización</div>', unsafe_allow_html=True)
    cols = st.columns(max(len(d["sync"]), 1))
    for col, row in zip(cols, d["sync"]):
        col.markdown(f"""
        <div class="kpi-card blue" style="padding:18px 22px;">
            <div class="label">{row.get('source','—').upper()}</div>
            <div style="font-size:0.9rem;font-weight:700;color:#e4e4e7;margin-top:6px;">Última sync</div>
            <div style="font-size:0.78rem;color:#71717a;margin-top:2px;">{_ago(row.get('updated_at'))}</div>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)
if st.button("↻  Actualizar", type="secondary"):
    st.cache_data.clear()
    st.rerun()
