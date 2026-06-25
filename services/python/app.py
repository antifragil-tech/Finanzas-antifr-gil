"""Alsari Knowledge — dashboard entry point con autenticación."""

from __future__ import annotations

import base64
from pathlib import Path

import streamlit as st

from alsari.config import get_settings

st.set_page_config(
    page_title="Alsari Knowledge",
    page_icon="💠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Logo como base64 para inyección directa en CSS/HTML ──────────────────────
_LOGO_WHITE = Path(__file__).parent / "logo alsari blanco.png"
_LOGO_DARK  = Path(__file__).parent / "alsari logo.png"

def _b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode() if path.exists() else ""

logo_white_b64 = _b64(_LOGO_WHITE)
logo_dark_b64  = _b64(_LOGO_DARK)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');

* { box-sizing: border-box; }

.stApp {
    background: #09090b !important;
    font-family: 'Inter', sans-serif;
    color: #e4e4e7;
}

/* Header y sidebar base */
[data-testid="stHeader"]             { background: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
[data-testid="stSidebar"]            { background: #0a0a0c !important; border-right: 1px solid rgba(255,255,255,0.06) !important; }
[data-testid="stMainBlockContainer"] { padding-top: 2.5rem; padding-left: 2rem; padding-right: 2rem; }
footer { visibility: hidden; }

/* Ocultar logo nativo de Streamlit (lo ponemos manual) */
[data-testid="stLogoLink"] { display: none !important; }

/* Nav links */
[data-testid="stSidebarNav"] { padding: 0 12px !important; }
[data-testid="stSidebarNav"] a {
    color: #71717a !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    padding: 9px 12px !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.2s ease !important;
    margin-bottom: 2px !important;
}
[data-testid="stSidebarNav"] a:hover { color: #f4f4f5 !important; background: rgba(255,255,255,0.06) !important; }
[data-testid="stSidebarNav"] [aria-selected="true"] {
    color: #f4f4f5 !important;
    background: rgba(59,130,246,0.1) !important;
    border-left: 2px solid #3b82f6 !important;
}

/* Scrollbar */
::-webkit-scrollbar       { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 99px; }

/* ── Tarjetas KPI ── */
.kpi-card {
    background: #111113;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 24px 28px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s ease, background 0.3s ease;
    height: 100%;
}
.kpi-card:hover { background: #141416; }
.kpi-card.blue:hover   { border-color: rgba(59,130,246,0.3); }
.kpi-card.green:hover  { border-color: rgba(16,185,129,0.3); }
.kpi-card.amber:hover  { border-color: rgba(245,158,11,0.3); }
.kpi-card.rose:hover   { border-color: rgba(244,63,94,0.3); }

.kpi-card .icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px; font-size: 18px;
}
.kpi-card.blue  .icon { background: rgba(59,130,246,0.12); color: #60a5fa; }
.kpi-card.green .icon { background: rgba(16,185,129,0.12); color: #34d399; }
.kpi-card.amber .icon { background: rgba(245,158,11,0.12); color: #fbbf24; }
.kpi-card.rose  .icon { background: rgba(244,63,94,0.12);  color: #fb7185; }

.kpi-card .label {
    font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.18em;
    color: #71717a; font-weight: 700; margin-bottom: 8px;
}
.kpi-card .value {
    font-size: 2rem; font-weight: 800; color: #f4f4f5;
    letter-spacing: -0.03em; line-height: 1;
}

/* ── Tarjetas contenido ── */
.card {
    background: #111113;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 10px;
    transition: border-color 0.2s ease;
}
.card:hover { border-color: rgba(59,130,246,0.25); }

/* ── Título de sección ── */
.section-label {
    font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.22em;
    color: #52525b; font-weight: 800;
    margin: 2rem 0 0.9rem;
    display: flex; align-items: center; gap: 8px;
}
.section-label::before {
    content: ""; width: 5px; height: 5px; flex-shrink: 0;
    background: #3b82f6; border-radius: 50%;
    box-shadow: 0 0 6px rgba(59,130,246,0.8);
}

/* ── Título de página ── */
.page-h { font-size: 2rem; font-weight: 800; color: #f4f4f5; letter-spacing: -0.04em; line-height: 1.1; }
.page-s { font-size: 0.88rem; color: #71717a; margin-top: 4px; margin-bottom: 2rem; }

/* ── Badges ── */
.badge { display:inline-block; font-size:0.68rem; font-weight:700; padding:3px 10px; border-radius:99px; }
.badge.red    { background:rgba(244,63,94,.15);  color:#fca5a5; }
.badge.amber  { background:rgba(245,158,11,.15); color:#fde68a; }
.badge.blue   { background:rgba(59,130,246,.15); color:#93c5fd; }
.badge.green  { background:rgba(16,185,129,.15); color:#6ee7b7; }
.badge.gray   { background:rgba(113,113,122,.15);color:#d4d4d8; }

/* ── Login ── */
.login-wrap { max-width:380px; margin:80px auto 0; }
.login-card {
    background: #111113;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px; padding: 40px 36px;
}

/* Sidebar status */
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.blink { animation: blink 2.2s ease infinite; }

/* ── Inputs (text + textarea + number) ── */
[data-baseweb="input"],
[data-baseweb="textarea"],
.stTextInput > div > div,
.stTextArea > div > div,
.stNumberInput > div > div,
.stDateInput > div > div {
    background: #0e0e11 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 10px !important;
    transition: border-color .15s ease, box-shadow .15s ease;
}
[data-baseweb="input"]:hover,
[data-baseweb="textarea"]:hover,
.stTextInput > div > div:hover,
.stTextArea > div > div:hover,
.stNumberInput > div > div:hover,
.stDateInput > div > div:hover {
    border-color: rgba(255,255,255,0.18) !important;
}
[data-baseweb="input"]:focus-within,
[data-baseweb="textarea"]:focus-within,
.stTextInput > div > div:focus-within,
.stTextArea > div > div:focus-within,
.stNumberInput > div > div:focus-within,
.stDateInput > div > div:focus-within {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
}
[data-baseweb="input"] input,
[data-baseweb="textarea"] textarea {
    background: transparent !important;
    color: #f4f4f5 !important;
    font-size: 0.92rem !important;
}
[data-baseweb="input"] input::placeholder,
[data-baseweb="textarea"] textarea::placeholder {
    color: #52525b !important;
    opacity: 1 !important;
}

/* ── Selectbox ── */
[data-baseweb="select"] > div {
    background: #0e0e11 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 10px !important;
    transition: border-color .15s ease;
}
[data-baseweb="select"] > div:hover { border-color: rgba(255,255,255,0.18) !important; }
[data-baseweb="select"] > div:focus-within {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
}
/* Dropdown menu (popover) */
[data-baseweb="popover"] {
    background: #111113 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 10px !important;
}
[data-baseweb="menu"] li:hover { background: rgba(59,130,246,0.12) !important; color: #f4f4f5 !important; }

/* ── Slider ── */
[data-testid="stSlider"] [role="slider"] {
    background: #3b82f6 !important;
    box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 12px rgba(59,130,246,0.5) !important;
    border: 2px solid #09090b !important;
}
[data-testid="stSlider"] [data-baseweb="slider"] > div > div { background: #27272a !important; }
[data-testid="stSlider"] [data-baseweb="slider"] > div > div > div { background: #3b82f6 !important; }
[data-testid="stSlider"] label { color: #a1a1aa !important; }

/* ── Botones ── */
.stButton > button,
.stFormSubmitButton > button {
    background: #18181b !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: #e4e4e7 !important;
    border-radius: 10px !important;
    font-weight: 600 !important;
    font-family: 'Inter', sans-serif !important;
    transition: all .18s ease !important;
}
.stButton > button:hover,
.stFormSubmitButton > button:hover {
    background: #1f1f23 !important;
    border-color: rgba(59,130,246,0.4) !important;
    color: #ffffff !important;
}
.stButton > button[kind="primary"],
.stFormSubmitButton > button[kind="primary"],
.stButton > button[data-testid="baseButton-primary"],
.stFormSubmitButton > button[data-testid="baseButton-primary"] {
    background: #3b82f6 !important;
    border: 1px solid #3b82f6 !important;
    color: #ffffff !important;
    box-shadow: 0 0 0 0 rgba(59,130,246,0), 0 4px 14px rgba(59,130,246,0.25) !important;
}
.stButton > button[kind="primary"]:hover,
.stFormSubmitButton > button[kind="primary"]:hover,
.stButton > button[data-testid="baseButton-primary"]:hover,
.stFormSubmitButton > button[data-testid="baseButton-primary"]:hover {
    background: #2563eb !important;
    border-color: #2563eb !important;
    box-shadow: 0 6px 20px rgba(59,130,246,0.4) !important;
    transform: translateY(-1px);
}

/* ── Checkboxes / radios ── */
[data-testid="stCheckbox"] input:checked + div,
[data-testid="stRadio"] input:checked + div {
    background: #3b82f6 !important;
    border-color: #3b82f6 !important;
}

/* ── Form border ── */
[data-testid="stForm"] {
    background: #0c0c0e !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    border-radius: 16px !important;
    padding: 24px !important;
}

/* ── Labels generales ── */
.stTextInput label, .stSelectbox label, .stNumberInput label,
.stDateInput label, .stTextArea label, .stSlider label {
    color: #a1a1aa !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
</style>
""", unsafe_allow_html=True)


# ── Login ─────────────────────────────────────────────────────────────────────
def _login() -> None:
    logo_html = (
        f'<img src="data:image/png;base64,{logo_dark_b64}" style="width:100%;border-radius:12px;">'
        if logo_dark_b64 else
        '<div style="font-size:1.4rem;font-weight:800;color:#f4f4f5;text-align:center;">ALSARI CAPITAL</div>'
    )
    st.markdown(f"""
    <div class="login-wrap">
        <div class="login-card">
            <div style="margin-bottom:28px;">{logo_html}</div>
            <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.22em;
                        color:#52525b;font-weight:800;margin-bottom:6px;">Knowledge System</div>
            <div style="font-size:0.85rem;color:#71717a;margin-bottom:28px;">
                Base de conocimiento documental
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Inputs fuera del HTML para que Streamlit los gestione
    with st.container():
        st.markdown('<div style="max-width:380px;margin:0 auto;">', unsafe_allow_html=True)
        pwd = st.text_input("", type="password", placeholder="Contraseña de acceso",
                            label_visibility="collapsed")
        if st.button("Entrar →", use_container_width=True, type="primary"):
            if pwd == get_settings().dashboard_password:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("Contraseña incorrecta")
        st.markdown('</div>', unsafe_allow_html=True)


# Login deshabilitado temporalmente — acceso abierto
# if not st.session_state.get("authenticated"):
#     _login()
#     st.stop()

# ── Sidebar: logo manual + navegación ────────────────────────────────────────
with st.sidebar:
    if logo_white_b64:
        st.markdown(f"""
        <div style="padding:24px 20px 20px;
                    border-bottom:1px solid rgba(255,255,255,0.06);
                    margin-bottom:16px;
                    text-align:center;">
            <img src="data:image/png;base64,{logo_white_b64}"
                 style="height:28px;width:auto;object-fit:contain;opacity:0.85;">
        </div>
        """, unsafe_allow_html=True)

pg = st.navigation([
    st.Page("pages/estadisticas.py",  title="Estadísticas",        icon="📊", default=True),
    st.Page("pages/busqueda.py",      title="Búsqueda",             icon="🔍"),
    st.Page("pages/hitos.py",         title="Hitos y vencimientos", icon="📅"),
    st.Page("pages/grafo.py",         title="Grafo de conocimiento",icon="🕸"),
])

pg.run()

with st.sidebar:
    st.markdown("<br>" * 5, unsafe_allow_html=True)
    st.markdown("""
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding:14px 16px 8px;">
        <div style="font-family:monospace;font-size:0.58rem;color:#3f3f46;
                    text-transform:uppercase;letter-spacing:0.18em;
                    text-align:center;margin-bottom:8px;">Terminal Status</div>
        <div style="font-family:monospace;font-size:0.62rem;color:#52525b;
                    display:flex;align-items:center;justify-content:center;gap:6px;">
            <span class="blink" style="width:5px;height:5px;background:#10b981;
                  border-radius:50%;display:inline-block;flex-shrink:0;"></span>
            SYSTEM ONLINE
        </div>
    </div>
    """, unsafe_allow_html=True)
    # Botón cerrar sesión deshabilitado mientras el login está abierto
