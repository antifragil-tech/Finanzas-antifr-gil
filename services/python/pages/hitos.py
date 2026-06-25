"""Hitos y vencimientos."""

from __future__ import annotations

from datetime import date, timedelta

import streamlit as st

from alsari.config import SOCIEDADES
from alsari.db.supabase import get_client

st.markdown("""
<div class="page-h">Hitos y vencimientos</div>
<div class="page-s">Seguimiento de fechas críticas del grupo</div>
""", unsafe_allow_html=True)

client = get_client()
today  = date.today()


@st.cache_data(ttl=60)
def _load() -> list[dict]:
    return client.table("alsari_hitos").select("*").order("fecha").execute().data or []


def _badge(days: int) -> tuple[str, str, str]:
    if days < 0:   return "#374151", "#9ca3af", "Vencido"
    if days == 0:  return "rgba(244,63,94,.2)",  "#fca5a5", "HOY"
    if days <= 7:  return "rgba(244,63,94,.15)", "#fca5a5", f"{days}d"
    if days <= 30: return "rgba(245,158,11,.15)","#fde68a", f"{days}d"
    if days <= 90: return "rgba(59,130,246,.12)","#93c5fd", f"{days}d"
    return "rgba(16,185,129,.12)", "#6ee7b7", f"{days}d"


# ── Filtros ───────────────────────────────────────────────────────────────────
fa, fb, fc = st.columns([2, 2, 1])
filtro_soc = fa.selectbox("Sociedad", ["Todas"] + SOCIEDADES)
filtro_est = fb.selectbox("Estado", ["Solo activos", "Todos", "Vencidos"])
filtro_hor = fc.selectbox("Horizonte", ["90d", "180d", "1 año", "Todo"])
horizon    = {"90d": 90, "180d": 180, "1 año": 365, "Todo": 99999}[filtro_hor]

hitos    = _load()
filtered = []
for h in hitos:
    d    = date.fromisoformat(h["fecha"])
    days = (d - today).days
    if filtro_soc != "Todas" and h.get("sociedad") != filtro_soc: continue
    if filtro_est == "Solo activos" and not h.get("activo"):       continue
    if filtro_est == "Vencidos"     and days >= 0:                 continue
    if days > horizon:                                             continue
    filtered.append({**h, "_days": days})
filtered.sort(key=lambda x: x["_days"])

# ── KPIs ──────────────────────────────────────────────────────────────────────
k1, k2, k3, k4 = st.columns(4)
urgentes = sum(1 for h in filtered if 0 <= h["_days"] <= 30)
proximos = sum(1 for h in filtered if 30 < h["_days"] <= 90)
vencidos = sum(1 for h in filtered if h["_days"] < 0)

for col, label, val, color, icon in [
    (k1, "Total hitos",    len(filtered), "blue",  "event_note"),
    (k2, "Urgentes ≤30d", urgentes,      "rose",  "warning"),
    (k3, "Próximos ≤90d", proximos,      "blue",  "schedule"),
    (k4, "Vencidos",      vencidos,      "amber", "event_busy"),
]:
    col.markdown(f"""
    <div class="kpi-card {color}">
        <div class="icon"><span class="material-icons-round">{icon}</span></div>
        <div class="label">{label}</div>
        <div class="value">{val}</div>
    </div>""", unsafe_allow_html=True)

# ── Lista ─────────────────────────────────────────────────────────────────────
st.markdown('<div class="section-label">Calendario</div>', unsafe_allow_html=True)

if not filtered:
    st.markdown("""
    <div class="card" style="text-align:center;padding:48px 24px;">
        <div style="font-size:2rem;margin-bottom:12px;">📅</div>
        <div style="color:#e4e4e7;font-weight:600;">Sin hitos con los filtros seleccionados</div>
    </div>""", unsafe_allow_html=True)
else:
    for h in filtered:
        days              = h["_days"]
        bg, color, label  = _badge(days)
        soc               = h.get("sociedad") or ""
        importe           = f"EUR {h['importe']:,.0f}" if h.get("importe") else ""
        activo_icon       = "✅" if h.get("activo") else "⏸"
        subtitle          = "  ·  ".join(filter(None, [soc, importe]))

        with st.expander(f"{activo_icon}  {h['fecha']}  ·  {h['descripcion']}"
                         + (f"  ·  {soc}" if soc else ""), expanded=False):
            m1, m2, m3, m4 = st.columns(4)
            for c, lbl, val in [
                (m1, "Fecha",    h["fecha"]),
                (m2, "Sociedad", soc or "—"),
                (m3, "Importe",  importe or "—"),
            ]:
                c.markdown(f"""
                <div>
                    <div style="font-size:0.65rem;text-transform:uppercase;
                                letter-spacing:0.15em;color:#52525b;font-weight:700;
                                margin-bottom:4px;">{lbl}</div>
                    <div style="font-size:0.92rem;font-weight:600;color:#e4e4e7;">{val}</div>
                </div>""", unsafe_allow_html=True)
            m4.markdown(f"""
            <div>
                <div style="font-size:0.65rem;text-transform:uppercase;
                            letter-spacing:0.15em;color:#52525b;font-weight:700;
                            margin-bottom:4px;">Días restantes</div>
                <span style="background:{bg};color:{color};
                             padding:4px 14px;border-radius:99px;
                             font-size:0.82rem;font-weight:700;">{label}</span>
            </div>""", unsafe_allow_html=True)

            if h.get("notas"):
                st.markdown(f"""
                <div style="margin-top:14px;padding:12px 16px;background:#0d0d0f;
                            border:1px solid rgba(255,255,255,0.06);border-radius:10px;
                            font-size:0.83rem;color:#a1a1aa;">📝  {h['notas']}</div>
                """, unsafe_allow_html=True)

            new_activo = st.checkbox("Activo", value=bool(h.get("activo")), key=f"a_{h['id']}")
            if new_activo != bool(h.get("activo")):
                client.table("alsari_hitos").update({"activo": new_activo}).eq("id", h["id"]).execute()
                st.cache_data.clear()
                st.rerun()

# ── Añadir ────────────────────────────────────────────────────────────────────
st.markdown('<div class="section-label">Añadir nuevo hito</div>', unsafe_allow_html=True)

with st.form("new_hito"):
    na, nb = st.columns(2)
    desc      = na.text_input("Descripción *", placeholder="Vencimiento seguro Campanillas")
    fecha_new = nb.date_input("Fecha *", value=today + timedelta(days=30))
    nc, nd, ne = st.columns(3)
    soc_new   = nc.selectbox("Sociedad", [""] + SOCIEDADES)
    imp_new   = nd.number_input("Importe (EUR)", min_value=0.0, step=1000.0)
    alert_new = ne.number_input("Alertar X días antes", min_value=1, value=30)
    notas_new = st.text_area("Notas", height=72)
    if st.form_submit_button("Guardar hito", type="primary"):
        if not desc.strip():
            st.error("La descripción es obligatoria.")
        else:
            row: dict = {"descripcion": desc.strip(), "fecha": fecha_new.isoformat(),
                         "activo": True, "alert_dias": int(alert_new)}
            if soc_new:          row["sociedad"] = soc_new
            if imp_new:          row["importe"]  = float(imp_new)
            if notas_new.strip(): row["notas"]   = notas_new.strip()
            client.table("alsari_hitos").insert(row).execute()
            st.cache_data.clear()
            st.success("Hito guardado.")
            st.rerun()
