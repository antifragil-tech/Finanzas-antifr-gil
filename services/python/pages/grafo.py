"""Grafo de conocimiento — estilo Obsidian."""

from __future__ import annotations

import json
from collections import defaultdict

import streamlit as st
import streamlit.components.v1 as components

from pathlib import Path

from alsari.db.supabase import get_client

st.markdown("""
<div class="page-h">Grafo de conocimiento</div>
<div class="page-s">Red semántica de documentos conectados por proyectos y contrapartes</div>
""", unsafe_allow_html=True)

client = get_client()


def _color(area: str) -> str:
    if area in ("legal", "financiero"):       return "#3b82f6"
    if area in ("inmobiliario", "operativo"): return "#10b981"
    if area in ("fiscal", "comercial"):       return "#f59e0b"
    return "#52525b"


@st.cache_data(ttl=300)
def _load_documents() -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        batch = (
            client.table("alsari_knowledge")
            .select(
                "source_id,source_title,source_url,source_type,"
                "tipo_documento,area,proyectos,contrapartes,personas,sociedades,chunk_total"
            )
            .eq("chunk_index", 0)
            .range(offset, offset + 999)
            .execute()
            .data or []
        )
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


docs = _load_documents()

nodes: list[dict] = []
for i, doc in enumerate(docs):
    title = (doc.get("source_title") or doc.get("source_id") or "")[:80]
    area  = doc.get("area") or ""
    nodes.append({
        "id":           i,
        "title":        title,
        "url":          doc.get("source_url") or "",
        "area":         area,
        "tipo":         doc.get("tipo_documento") or "",
        "stype":        doc.get("source_type") or "",
        "color":        _color(area),
        "r":            max(3, min(12, (doc.get("chunk_total") or 1) * 1.0)),
        "proyectos":    doc.get("proyectos") or [],
        "contrapartes": doc.get("contrapartes") or [],
        "personas":     doc.get("personas") or [],
        "sociedades":   doc.get("sociedades") or [],
    })

# ── Construcción de edges con 4 tipos de entidad ─────────────────────────────
# proyecto > contraparte > persona > sociedad (orden de especificidad)
entity_to_docs: dict[tuple[str, str], list[int]] = defaultdict(list)
for i, doc in enumerate(docs):
    for p in doc.get("proyectos")    or []: entity_to_docs[("proyecto",    p)].append(i)
    for c in doc.get("contrapartes") or []: entity_to_docs[("contraparte", c)].append(i)
    for p in doc.get("personas")     or []: entity_to_docs[("persona",     p)].append(i)
    for s in doc.get("sociedades")   or []: entity_to_docs[("sociedad",    s)].append(i)

TYPE_PRIORITY = {"proyecto": 4, "contraparte": 3, "persona": 2, "sociedad": 1}
SHORT_TYPE    = {"proyecto": "p", "contraparte": "c", "persona": "u", "sociedad": "s"}

SMALL_GROUP   = 15   # ≤ esto: malla completa
MEDIUM_GROUP  = 60   # ≤ esto: ciclo (cada doc conectado a 3 vecinos del grupo)
GENERIC_LIMIT = 100  # > esto: entidad demasiado genérica → ignorar

pair_data: dict[tuple[int, int], dict] = {}

for (etype, _ename), idxs in entity_to_docs.items():
    n = len(idxs)
    if n < 2 or n > GENERIC_LIMIT:
        continue

    if n <= SMALL_GROUP:
        pairs = [(idxs[a], idxs[b]) for a in range(n) for b in range(a + 1, n)]
    else:
        sorted_idx = sorted(idxs)
        pairs = []
        for i in range(n):
            for j in (1, 2, 3):
                pairs.append((sorted_idx[i], sorted_idx[(i + j) % n]))

    for a, b in pairs:
        if a == b: continue
        key = (min(a, b), max(a, b))
        d = pair_data.get(key)
        if d is None:
            pair_data[key] = {"count": 1, "type": etype}
        else:
            d["count"] += 1
            if TYPE_PRIORITY[etype] > TYPE_PRIORITY[d["type"]]:
                d["type"] = etype

# Si hay demasiados edges, prioriza los de mayor peso (más entidades compartidas)
sorted_pairs = sorted(pair_data.items(), key=lambda kv: (-kv[1]["count"], -TYPE_PRIORITY[kv[1]["type"]]))
MAX_LINKS = 5000
sorted_pairs = sorted_pairs[:MAX_LINKS]

links: list[dict] = [
    {"source": a, "target": b, "t": SHORT_TYPE[d["type"]], "w": d["count"]}
    for (a, b), d in sorted_pairs
]

graph_json = json.dumps({"nodes": nodes, "links": links})

# KPIs
k1, k2, k3 = st.columns(3)
for col, lbl, val in [
    (k1, "Documentos", len(nodes)),
    (k2, "Conexiones",  len(links)),
    (k3, "Entidades activas", len([e for e in entity_to_docs if 2 <= len(entity_to_docs[e]) <= GENERIC_LIMIT])),
]:
    col.markdown(f"""
    <div class="kpi-card blue">
        <div class="label">{lbl}</div>
        <div class="value">{val}</div>
    </div>""", unsafe_allow_html=True)

st.markdown("""
<div style="margin-top:1rem;font-size:0.72rem;color:#3f3f46;display:flex;gap:20px;">
  <span>Arrastrar · Scroll zoom · Click abre doc · Hover resalta conexiones</span>
</div>
""", unsafe_allow_html=True)

_D3 = (Path(__file__).parent.parent / "static" / "d3.v7.min.js").read_text(encoding="utf-8")
_HTML = r"""<!DOCTYPE html><html><head><meta charset="utf-8">
<script>""" + _D3 + r"""</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#070709;overflow:hidden;font-family:Inter,sans-serif}
svg{width:100%;height:100%}
#tip{
  position:fixed;background:rgba(10,10,12,.98);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  padding:13px 16px;color:#e4e4e7;font-size:12px;max-width:280px;
  pointer-events:none;display:none;z-index:100;
  box-shadow:0 12px 48px rgba(0,0,0,.9);
}
.tt{font-weight:700;color:#f4f4f5;margin-bottom:8px;font-size:13px;line-height:1.4}
.tm{color:#71717a;font-size:11px;line-height:1.9}
.tm span{color:#a1a1aa}
#ctrl{position:fixed;top:10px;right:10px;display:flex;gap:6px;z-index:100}
.btn{
  background:rgba(10,10,12,.95);border:1px solid rgba(255,255,255,.1);
  color:#52525b;padding:5px 12px;border-radius:8px;cursor:pointer;
  font-size:11px;font-family:inherit;transition:.18s;
}
.btn:hover,.btn.on{color:#93c5fd;border-color:rgba(59,130,246,.35);background:rgba(59,130,246,.08)}
#leg{position:fixed;bottom:12px;left:12px;z-index:100;display:flex;gap:5px;flex-wrap:wrap;max-width:420px}
.li{display:flex;align-items:center;gap:5px;background:rgba(10,10,12,.85);
    border:1px solid rgba(255,255,255,.06);border-radius:99px;padding:3px 10px;
    font-size:10px;color:#52525b}
.ld{width:6px;height:6px;border-radius:50%;flex-shrink:0}
</style></head><body>
<div id="tip"></div>
<div id="ctrl">
  <button class="btn" id="lblBtn" onclick="toggleLabels()">Etiquetas</button>
  <button class="btn" onclick="resetView()">Centrar</button>
</div>
<div id="leg">
  <div class="li"><div class="ld" style="background:#3b82f6"></div>Legal · Financiero</div>
  <div class="li"><div class="ld" style="background:#10b981"></div>Inmobiliario · Operativo</div>
  <div class="li"><div class="ld" style="background:#f59e0b"></div>Fiscal · Comercial</div>
  <div class="li"><div class="ld" style="background:#52525b"></div>Sin área</div>
  <div class="li" style="margin-left:8px;border-left:1px solid rgba(255,255,255,.08);padding-left:12px">
    <div class="ld" style="background:rgba(96,165,250,.7);width:14px;height:1.5px;border-radius:0"></div>Proyecto
  </div>
  <div class="li"><div class="ld" style="background:rgba(244,114,182,.7);width:14px;height:1.5px;border-radius:0"></div>Contraparte</div>
  <div class="li"><div class="ld" style="background:rgba(110,231,183,.6);width:14px;height:1.5px;border-radius:0"></div>Persona</div>
  <div class="li"><div class="ld" style="background:rgba(253,224,71,.5);width:14px;height:1.5px;border-radius:0"></div>Sociedad</div>
</div>
<svg id="g"></svg>
<script>
const data = __GRAPH_DATA__;
const W = window.innerWidth, H = window.innerHeight;
let showLbls = false, hovering = false;

// Cluster targets por área — fuerza suave que separa grupos
const CLUSTER = {
  "legal":        {x: W*0.28, y: H*0.28},
  "financiero":   {x: W*0.42, y: H*0.22},
  "inmobiliario": {x: W*0.72, y: H*0.32},
  "operativo":    {x: W*0.78, y: H*0.62},
  "fiscal":       {x: W*0.22, y: H*0.68},
  "comercial":    {x: W*0.48, y: H*0.78},
};
const DEFAULT_POS = {x: W*0.5, y: H*0.5};

// Inicializar posiciones repartidas por cluster
data.nodes.forEach(n => {
  const c = CLUSTER[n.area] || DEFAULT_POS;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 180 + 40;
  n.x = c.x + Math.cos(angle) * radius;
  n.y = c.y + Math.sin(angle) * radius;
});

const svg = d3.select("#g");
const defs = svg.append("defs");

function addGlow(id, std) {
  const f = defs.append("filter").attr("id",id)
    .attr("x","-100%").attr("y","-100%")
    .attr("width","300%").attr("height","300%");
  f.append("feGaussianBlur").attr("stdDeviation",std).attr("result","b");
  const m = f.append("feMerge");
  m.append("feMergeNode").attr("in","b");
  m.append("feMergeNode").attr("in","SourceGraphic");
}
addGlow("gl",2);
addGlow("glw",8);

const zoom = d3.zoom().scaleExtent([.03,15])
  .on("zoom",e=>grp.attr("transform",e.transform));
svg.call(zoom).on("dblclick.zoom",null);

const grp = svg.append("g");

const sim = d3.forceSimulation(data.nodes)
  .force("link",   d3.forceLink(data.links).id(d=>d.id).distance(85).strength(0.15))
  .force("charge", d3.forceManyBody().strength(-280).distanceMax(500))
  .force("collide",d3.forceCollide(d=>d.r+8).iterations(2))
  // Fuerzas de clustering suaves — separan áreas sin colapsar el grafo
  .force("cx", d3.forceX(d=>(CLUSTER[d.area]||DEFAULT_POS).x).strength(0.06))
  .force("cy", d3.forceY(d=>(CLUSTER[d.area]||DEFAULT_POS).y).strength(0.06))
  .alphaDecay(0.022)
  .velocityDecay(0.45);

const EDGE_COLOR = {
  "p":"rgba(96,165,250,0.30)",   // proyecto — azul
  "c":"rgba(244,114,182,0.24)",  // contraparte — rosa
  "u":"rgba(110,231,183,0.22)",  // persona — verde
  "s":"rgba(253,224,71,0.18)",   // sociedad — ámbar
};

const lnk = grp.append("g")
  .selectAll("line").data(data.links).join("line")
  .attr("stroke",l=>EDGE_COLOR[l.t]||"rgba(255,255,255,0.15)")
  .attr("stroke-width",l=>Math.min(2.6, 0.9 + (l.w||1)*0.35))
  .attr("stroke-linecap","round");

const nd = grp.append("g")
  .selectAll("g").data(data.nodes).join("g")
  .attr("cursor","pointer")
  .call(d3.drag()
    .on("start",(e,d)=>{if(!e.active)sim.alphaTarget(.2).restart();d.fx=d.x;d.fy=d.y;})
    .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y;})
    .on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;})
  );

nd.append("circle")
  .attr("r",d=>d.r)
  .attr("fill",d=>d.color)
  .attr("fill-opacity",.7)
  .attr("filter","url(#gl)");

const lbl = nd.append("text")
  .attr("dx",d=>d.r+5).attr("dy","0.35em")
  .attr("fill","#52525b").attr("font-size","9px")
  .attr("font-family","Inter,sans-serif").attr("font-weight","500")
  .text(d=>d.title.length>32?d.title.slice(0,32)+"…":d.title)
  .style("pointer-events","none").style("display","none");

const tip = d3.select("#tip");

// Índice de vecinos
const nbIdx = new Map(data.nodes.map(n=>[n.id, new Set()]));
data.links.forEach(l=>{
  nbIdx.get(l.source.id??l.source)?.add(l.target.id??l.target);
  nbIdx.get(l.target.id??l.target)?.add(l.source.id??l.source);
});

nd.on("mouseover",(evt,d)=>{
  hovering=true;
  const nb = nbIdx.get(d.id)||new Set();

  nd.select("circle").transition().duration(100)
    .attr("fill",n=>n.id===d.id?"#ffffff":nb.has(n.id)?n.color:"#0c0c0f")
    .attr("fill-opacity",n=>n.id===d.id?1:nb.has(n.id)?.9:.15)
    .attr("r",n=>n.id===d.id?n.r*1.6:n.r)
    .attr("filter",n=>n.id===d.id?"url(#glw)":nb.has(n.id)?"url(#gl)":"none");

  lnk.transition().duration(100)
    .attr("stroke",l=>{
      const s=l.source.id??l.source, t=l.target.id??l.target;
      return (s===d.id||t===d.id)?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.02)";
    })
    .attr("stroke-width",l=>{
      const s=l.source.id??l.source, t=l.target.id??l.target;
      return (s===d.id||t===d.id)?2:0.5;
    });

  lbl.style("display",n=>(n.id===d.id||nb.has(n.id))?"block":"none")
     .attr("fill",n=>n.id===d.id?"#f4f4f5":nb.has(n.id)?"#a1a1aa":"#52525b");

  const proy=d.proyectos.length?d.proyectos.join(", "):"—";
  const cp=d.contrapartes.length?d.contrapartes.join(", "):"—";
  const per=d.personas.length?d.personas.join(", "):"—";
  const soc=d.sociedades.length?d.sociedades.join(", "):"—";
  tip.style("display","block")
    .style("left",(evt.clientX+16)+"px").style("top",(evt.clientY-14)+"px")
    .html(`<div class="tt">${d.title}</div><div class="tm">📄 <span>${d.tipo||"—"}</span> · ${d.area||"sin área"}<br>🏗 <span>${proy}</span><br>🤝 <span>${cp}</span><br>👤 <span>${per}</span><br>🏢 <span>${soc}</span></div>`);
})
.on("mousemove",evt=>{
  tip.style("left",(evt.clientX+16)+"px").style("top",(evt.clientY-14)+"px");
})
.on("mouseout",()=>{
  hovering=false;
  tip.style("display","none");
  nd.select("circle").transition().duration(180)
    .attr("fill",n=>n.color).attr("fill-opacity",.7)
    .attr("r",n=>n.r).attr("filter","url(#gl)");
  lnk.transition().duration(180)
    .attr("stroke",l=>EDGE_COLOR[l.t]||"rgba(255,255,255,0.15)")
    .attr("stroke-width",l=>Math.min(2.6, 0.9 + (l.w||1)*0.35));
  lbl.style("display",showLbls?"block":"none").attr("fill","#52525b");
})
.on("click",(evt,d)=>{if(d.url)window.open(d.url,"_blank");});

sim.on("tick",()=>{
  lnk.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
     .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
  nd.attr("transform",d=>`translate(${d.x},${d.y})`);
});

function fitView(){
  const b=grp.node().getBBox();
  if(b.width<1||b.height<1)return;
  const scale=Math.min(.92, .92*Math.min(W/b.width,H/b.height));
  const tx=W/2-(b.x+b.width/2)*scale;
  const ty=H/2-(b.y+b.height/2)*scale;
  svg.transition().duration(700)
    .call(zoom.transform,d3.zoomIdentity.translate(tx,ty).scale(scale));
}
function resetView(){ fitView(); }
function toggleLabels(){
  showLbls=!showLbls;
  if(!hovering) lbl.style("display",showLbls?"block":"none");
  d3.select("#lblBtn").classed("on",showLbls);
}

sim.on("end",fitView);
setTimeout(fitView,1400);
</script></body></html>"""

html = _HTML.replace("__GRAPH_DATA__", graph_json)
components.html(html, height=760, scrolling=False)
