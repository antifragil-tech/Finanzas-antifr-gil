import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { DashboardData } from '@alsari/types';

type Props = {
  data: DashboardData;
  onSelectSociety: (id: string) => void;
  onClose: () => void;
};

type MapNode = {
  id: string;
  nombre: string;
  level: number;
  x: number;
  y: number;
  isPerson?: boolean;
  isHolding?: boolean;
  unconfigured?: boolean;
  pctLabel?: string;
};

// ── Layout constants ──────────────────────────────────────────────────────────

const W       = 1440;
const NODE_W  = 160;
const NODE_H  = 54;
// Level 0 = personas, 1 = holdings, 2 = directas, 3 = subsidiarias
const LEVEL_Y = [80, 260, 460, 660] as const;

function normP(v: number | null | undefined): number {
  if (!v) return 0;
  return v > 1 ? v / 100 : v;
}

function centerX(index: number, total: number): number {
  const spread = Math.min(total * 210, W - 80);
  const start  = W / 2 - spread / 2;
  const step   = total > 1 ? spread / (total - 1) : 0;
  return total <= 1 ? W / 2 : start + index * step;
}

// Numeric ID-Ref → persona física (Javier="1", Iván="2")
function isPersona(idRef: string): boolean {
  return idRef !== '' && !isNaN(Number(idRef));
}

// ── Build layout ──────────────────────────────────────────────────────────────

function buildLayout(sociedades: DashboardData['sociedades']): {
  nodes: MapNode[];
  edges: { from: string; to: string }[];
  PAVIER_ID: string;
  ARMIA_ID: string;
} {
  const nodes: MapNode[] = [];
  const edges: { from: string; to: string }[] = [];
  const socs = sociedades ?? [];

  const pavierSoc = socs.find(s => (s['Nombre de la Sociedad'] as string)?.toLowerCase().includes('pavier'));
  const armiaSoc  = socs.find(s => (s['Nombre de la Sociedad'] as string)?.toLowerCase().includes('armia'));
  const PAVIER_ID = (pavierSoc?.['ID-Ref'] as string) ?? '';
  const ARMIA_ID  = (armiaSoc?.['ID-Ref']  as string) ?? '';

  // ── Level 2: Filiales directas (computadas primero para anclar holdings) ─
  const directSubs = socs.filter(s => {
    const id = s['ID-Ref'] as string;
    if (isPersona(id)) return false;
    if (id === PAVIER_ID || id === ARMIA_ID) return false;
    if (s.parent_sociedad_id) return false;
    return normP(s['% Pavier'] as number) > 0 || normP(s['% Armia'] as number) > 0;
  });

  // Ordenar [solo-Pavier | compartidas | solo-Armia] para eliminar cruces
  const pavierOnly = directSubs.filter(s => normP(s['% Pavier'] as number) > 0 && normP(s['% Armia'] as number) === 0);
  const armiaOnly  = directSubs.filter(s => normP(s['% Armia']  as number) > 0 && normP(s['% Pavier'] as number) === 0);
  const shared     = directSubs.filter(s => normP(s['% Pavier'] as number) > 0 && normP(s['% Armia']  as number) > 0);
  const orderedL2  = [...pavierOnly, ...shared, ...armiaOnly];

  orderedL2.forEach((soc, i) => {
    const id      = soc['ID-Ref'] as string;
    const nombre  = soc['Nombre de la Sociedad'] as string;
    const pPavier = normP(soc['% Pavier'] as number);
    const pArmia  = normP(soc['% Armia']  as number);
    const noConfig = pPavier === 0 && pArmia === 0;

    let pctLabel = '';
    if (pPavier > 0 && pArmia > 0) {
      const pp = (pPavier * 100).toFixed(0);
      const pa = (pArmia  * 100).toFixed(0);
      pctLabel = pp === pa ? `${pp}% · ${pp}%` : `P:${pp}% · A:${pa}%`;
    } else if (pPavier > 0) {
      pctLabel = `Pavier ${(pPavier * 100).toFixed(0)}%`;
    } else if (pArmia > 0) {
      pctLabel = `Armia ${(pArmia * 100).toFixed(0)}%`;
    }

    nodes.push({ id, nombre, level: 2, x: centerX(i, orderedL2.length), y: LEVEL_Y[2], unconfigured: noConfig, pctLabel });
    if (pPavier > 0 && PAVIER_ID) edges.push({ from: PAVIER_ID, to: id });
    if (pArmia  > 0 && ARMIA_ID)  edges.push({ from: ARMIA_ID,  to: id });
  });

  // ── Level 1: Holdings — anclados a los extremos del nivel 2 ─────────────
  // Pavier se alinea con el nodo L2 más a la izquierda de sus hijos
  // Armia se alinea con el nodo L2 más a la derecha de sus hijos
  // Esto garantiza que los tallos caigan en los extremos del bus compartido.
  const l2Nodes = nodes.filter(n => n.level === 2);
  const pavierChildren = l2Nodes.filter(n => {
    const soc = socs.find(s => s['ID-Ref'] === n.id);
    return soc ? normP(soc['% Pavier'] as number) > 0 : false;
  });
  const armiaChildren = l2Nodes.filter(n => {
    const soc = socs.find(s => s['ID-Ref'] === n.id);
    return soc ? normP(soc['% Armia'] as number) > 0 : false;
  });

  const pavierX = pavierChildren.length > 0
    ? Math.min(...pavierChildren.map(n => n.x))
    : centerX(0, 2);
  const armiaX = armiaChildren.length > 0
    ? Math.max(...armiaChildren.map(n => n.x))
    : centerX(1, 2);

  if (PAVIER_ID) {
    const nombre = (pavierSoc?.['Nombre de la Sociedad'] as string) ?? PAVIER_ID;
    nodes.push({ id: PAVIER_ID, nombre, level: 1, x: pavierX, y: LEVEL_Y[1], isHolding: true });
  }
  if (ARMIA_ID) {
    const nombre = (armiaSoc?.['Nombre de la Sociedad'] as string) ?? ARMIA_ID;
    nodes.push({ id: ARMIA_ID, nombre, level: 1, x: armiaX, y: LEVEL_Y[1], isHolding: true });
  }

  // ── Level 0: Personas físicas — alineadas con su holding ────────────────
  const personas = socs
    .filter(s => isPersona(s['ID-Ref'] as string))
    .filter(s => normP(s['% Pavier'] as number) === 1 || normP(s['% Armia'] as number) === 1);

  personas.forEach(soc => {
    const id         = soc['ID-Ref'] as string;
    const nombre     = soc['Nombre de la Sociedad'] as string;
    const ownsPavier = normP(soc['% Pavier'] as number) === 1;
    const x          = ownsPavier ? pavierX : armiaX;
    nodes.push({ id, nombre, level: 0, x, y: LEVEL_Y[0], isPerson: true });
    const holdingId  = ownsPavier ? PAVIER_ID : ARMIA_ID;
    if (holdingId) edges.push({ from: id, to: holdingId });
  });

  // ── Level 3: Subsidiarias de segundo nivel ───────────────────────────────
  const indirectSubs = socs.filter(s => !!s.parent_sociedad_id && !isPersona(s['ID-Ref'] as string));

  const byParent = new Map<string, typeof indirectSubs>();
  for (const s of indirectSubs) {
    const pid = s.parent_sociedad_id as string;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }

  // Ordenar grupos por X del padre para que hermanos queden juntos
  const parentIds = [...byParent.keys()].sort((a, b) => {
    const xA = nodes.find(n => n.id === a)?.x ?? 0;
    const xB = nodes.find(n => n.id === b)?.x ?? 0;
    return xA - xB;
  });

  const allLevel3 = parentIds.flatMap(pid => byParent.get(pid) ?? []);
  allLevel3.forEach((soc, i) => {
    const id     = soc['ID-Ref'] as string;
    const nombre = soc['Nombre de la Sociedad'] as string;
    const pct    = normP(soc.pct_en_sociedad_padre ?? 0);

    nodes.push({
      id, nombre, level: 3,
      x: centerX(i, allLevel3.length),
      y: LEVEL_Y[3],
      unconfigured: pct === 0,
      pctLabel: pct > 0 ? `${(pct * 100).toFixed(0)}%` : '',
    });
    edges.push({ from: soc.parent_sociedad_id as string, to: id });
  });

  return { nodes, edges, PAVIER_ID, ARMIA_ID };
}

// ── Bus edge group ────────────────────────────────────────────────────────────
// Un padre → N hijos: tallo ↓ barra horizontal ↓ caídas a cada hijo

function BusEdgeGroup({
  parentId, childIds, busY, color, nodes,
}: {
  parentId: string;
  childIds: string[];
  busY: number;
  color: string;
  nodes: MapNode[];
}) {
  const parent   = nodes.find(n => n.id === parentId);
  const children = childIds.map(id => nodes.find(n => n.id === id)).filter((n): n is MapNode => !!n);
  if (!parent || children.length === 0) return null;

  const allX = [parent.x, ...children.map(c => c.x)];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);

  return (
    <g stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={parent.x} y1={parent.y + NODE_H} x2={parent.x} y2={busY} />
      {minX < maxX && <line x1={minX} y1={busY} x2={maxX} y2={busY} />}
      {children.map(c => (
        <line key={c.id} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
      ))}
    </g>
  );
}

// N padres + N hijos compartiendo UN único bus horizontal
// Refleja co-propiedad: ambos holdings bajan al mismo rail y desde ahí caen las filiales

function SharedBusEdges({
  parentIds, childIds, busY, color, nodes,
}: {
  parentIds: string[];
  childIds: string[];
  busY: number;
  color: string;
  nodes: MapNode[];
}) {
  const parents  = parentIds.map(id => nodes.find(n => n.id === id)).filter((n): n is MapNode => !!n);
  const children = childIds.map(id => nodes.find(n => n.id === id)).filter((n): n is MapNode => !!n);
  if (!parents.length || !children.length) return null;

  const allX = [...parents.map(p => p.x), ...children.map(c => c.x)];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);

  return (
    <g stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Tallos verticales de cada padre al bus */}
      {parents.map(p => (
        <line key={p.id} x1={p.x} y1={p.y + NODE_H} x2={p.x} y2={busY} />
      ))}
      {/* Bus horizontal compartido */}
      <line x1={minX} y1={busY} x2={maxX} y2={busY} />
      {/* Caídas verticales a cada hijo */}
      {children.map(c => (
        <line key={c.id} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
      ))}
    </g>
  );
}

// Línea simple (1 padre → 1 hijo, sin bus)
function StemEdge({ fromId, toId, busY, color, nodes }: {
  fromId: string; toId: string; busY: number; color: string; nodes: MapNode[];
}) {
  const a = nodes.find(n => n.id === fromId);
  const b = nodes.find(n => n.id === toId);
  if (!a || !b) return null;
  return (
    <g stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round">
      <line x1={a.x} y1={a.y + NODE_H} x2={a.x} y2={busY} />
      {a.x !== b.x && <line x1={a.x} y1={busY} x2={b.x} y2={busY} />}
      <line x1={b.x} y1={busY} x2={b.x} y2={b.y} />
    </g>
  );
}

// ── Alsari Capital frame ──────────────────────────────────────────────────────
// Pavier + Armia operan comercialmente como "Alsari Capital", pero no existe
// una sociedad con ese nombre: el recuadro punteado documenta esa realidad.

function AlsariCapitalFrame({ nodes }: { nodes: MapNode[] }) {
  const holdings = nodes.filter(n => n.isHolding);
  const first = holdings[0];
  if (holdings.length < 2 || !first) return null;

  const PAD_X   = 28;
  const LABEL_H = 34;
  const minX = Math.min(...holdings.map(n => n.x)) - NODE_W / 2 - PAD_X;
  const maxX = Math.max(...holdings.map(n => n.x)) + NODE_W / 2 + PAD_X;
  const top  = first.y - LABEL_H;
  const bot  = first.y + NODE_H + 14;
  const midX = (minX + maxX) / 2;

  return (
    <g>
      <rect
        x={minX} y={top}
        width={maxX - minX} height={bot - top}
        rx={16}
        fill="#F5F0E1" fillOpacity={0.015}
        stroke="#F5F0E1" strokeOpacity={0.18}
        strokeWidth={1} strokeDasharray="6 4"
      />
      <text x={midX} y={top + 16} textAnchor="middle" fill="#F5F0E1" fillOpacity={0.65} fontSize={11} fontWeight="600" letterSpacing="3">
        ALSARI CAPITAL
      </text>
      <text x={midX} y={top + 27} textAnchor="middle" fill="#71717a" fontSize={8} letterSpacing="1">
        denominación comercial · sin sociedad constituida
      </text>
    </g>
  );
}

// ── Node box ──────────────────────────────────────────────────────────────────

function NodeBox({ node, onClick }: { node: MapNode; onClick: () => void }) {
  const isPerson  = !!node.isPerson;
  const isHolding = !!node.isHolding;
  const warn      = !!node.unconfigured;

  let fill: string, stroke: string, tColor: string;
  if (isPerson) {
    fill = '#0f0f12'; stroke = '#52525b'; tColor = '#a1a1aa';
  } else if (isHolding) {
    fill = '#17253a'; stroke = '#2563a8'; tColor = '#93c5fd';
  } else if (warn) {
    fill = '#231a0a'; stroke = '#b45309'; tColor = '#fbbf24';
  } else {
    fill = '#18181b'; stroke = '#3f3f46'; tColor = '#e4e4e7';
  }

  const hasSub = !isPerson && node.pctLabel;
  const nameY  = node.y + (hasSub ? NODE_H / 2 - 3 : NODE_H / 2 + 5);
  const short  = node.nombre.length > 22 ? node.nombre.slice(0, 21) + '…' : node.nombre;
  const nodeW  = isPerson ? 150 : NODE_W;
  const nodeH  = isPerson ? 46  : NODE_H;
  const rx     = isPerson ? 23  : 10;

  return (
    <g
      onClick={isPerson ? undefined : onClick}
      className={isPerson ? '' : 'cursor-pointer'}
      style={{ userSelect: 'none' }}
    >
      <rect
        x={node.x - nodeW / 2} y={node.y}
        width={nodeW} height={nodeH}
        rx={rx}
        fill={fill} stroke={stroke}
        strokeWidth={isHolding ? 1.5 : warn ? 1.5 : 1}
        strokeDasharray={isPerson ? '5 3' : undefined}
        className={isPerson ? '' : 'hover:brightness-125 transition-all duration-150'}
      />
      <text
        x={node.x} y={nameY}
        textAnchor="middle"
        fill={tColor}
        fontSize={isPerson ? 10 : isHolding ? 12 : 11}
        fontWeight={isHolding ? '800' : '600'}
      >
        {short}
      </text>
      {hasSub && (
        <text
          x={node.x} y={node.y + NODE_H / 2 + 12}
          textAnchor="middle"
          fill="#52525b"
          fontSize={9}
          fontWeight="600"
        >
          {node.pctLabel}
        </text>
      )}
      {warn && (
        <g transform={`translate(${node.x + nodeW / 2 - 10}, ${node.y - 8})`}>
          <circle r={7} fill="#b45309" />
          <text textAnchor="middle" y={4} fill="white" fontSize={10} fontWeight="900">!</text>
        </g>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CorporateMap({ data, onSelectSociety, onClose }: Props) {
  const { nodes, edges, PAVIER_ID, ARMIA_ID } = useMemo(
    () => buildLayout(data.sociedades),
    [data.sociedades],
  );

  const edgesByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of edges) {
      if (!map.has(e.from)) map.set(e.from, []);
      map.get(e.from)!.push(e.to);
    }
    return map;
  }, [edges]);

  const maxLevel = Math.max(...nodes.map(n => n.level));
  const svgH     = (LEVEL_Y[maxLevel as 0 | 1 | 2 | 3] ?? LEVEL_Y[2]) + NODE_H + 80;
  const isEmpty  = !nodes.some(n => n.isHolding);

  // Bus Y entre niveles
  const busY_01 = Math.round((LEVEL_Y[0] + NODE_H + LEVEL_Y[1]) / 2);
  const busY_12 = Math.round((LEVEL_Y[1] + NODE_H + LEVEL_Y[2]) / 2);
  const busY_23 = Math.round((LEVEL_Y[2] + NODE_H + LEVEL_Y[3]) / 2);

  const personaNodes   = nodes.filter(n => n.isPerson);
  const pavierChildSet = new Set(PAVIER_ID ? (edgesByParent.get(PAVIER_ID) ?? []) : []);
  const armiaChildSet  = new Set(ARMIA_ID  ? (edgesByParent.get(ARMIA_ID)  ?? []) : []);

  // Hijos compartidos por ambos holdings → un único bus
  const sharedChildIds  = [...pavierChildSet].filter(id => armiaChildSet.has(id));
  // Hijos exclusivos de cada holding → bus propio (por si los hay en el futuro)
  const pavierOnlyIds   = [...pavierChildSet].filter(id => !armiaChildSet.has(id));
  const armiaOnlyIds    = [...armiaChildSet].filter(id => !pavierChildSet.has(id));

  const l2WithChildren  = nodes.filter(n => n.level === 2 && (edgesByParent.get(n.id)?.length ?? 0) > 0);

  return (
    <div className="w-full h-full min-h-[700px] relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-light text-white uppercase tracking-tight">Estructura Societaria</h2>
          <p className="text-sm text-zinc-500 mt-1 font-medium">
            Mapa dinámico del holding · Click en un nodo para navegar
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all flex items-center gap-2"
        >
          <X size={18} /> Cerrar
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-32 text-zinc-600 space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest">Sin estructura societaria configurada</p>
          <p className="text-xs text-zinc-700">Configura las sociedades y sus % de participación en Datos Maestros</p>
        </div>
      ) : (
        <div className="w-full bg-zinc-900/30 rounded-2xl border border-white/[0.06] overflow-auto">
          <svg width={W} height={svgH} viewBox={`0 0 ${W} ${svgH}`} className="block mx-auto">

            {/* Persona → Holding (tallo simple, sin bus) */}
            {personaNodes.map(p => {
              const holdingId = edgesByParent.get(p.id)?.[0];
              if (!holdingId) return null;
              return (
                <StemEdge
                  key={p.id}
                  fromId={p.id}
                  toId={holdingId}
                  busY={busY_01}
                  color="#3f3f46"
                  nodes={nodes}
                />
              );
            })}

            {/* Holdings → filiales compartidas: UN único bus horizontal */}
            {sharedChildIds.length > 0 && PAVIER_ID && ARMIA_ID && (
              <SharedBusEdges
                parentIds={[PAVIER_ID, ARMIA_ID]}
                childIds={sharedChildIds}
                busY={busY_12}
                color="#1e3a5f"
                nodes={nodes}
              />
            )}

            {/* Filiales exclusivas de Pavier (si las hubiera) */}
            {pavierOnlyIds.length > 0 && PAVIER_ID && (
              <BusEdgeGroup
                parentId={PAVIER_ID}
                childIds={pavierOnlyIds}
                busY={busY_12 - 14}
                color="#1e3a5f"
                nodes={nodes}
              />
            )}

            {/* Filiales exclusivas de Armia (si las hubiera) */}
            {armiaOnlyIds.length > 0 && ARMIA_ID && (
              <BusEdgeGroup
                parentId={ARMIA_ID}
                childIds={armiaOnlyIds}
                busY={busY_12 - 14}
                color="#1e3a5f"
                nodes={nodes}
              />
            )}

            {/* L2 → subsidiarias (un bus por padre) */}
            {l2WithChildren.map(p => (
              <BusEdgeGroup
                key={p.id}
                parentId={p.id}
                childIds={edgesByParent.get(p.id)!}
                busY={busY_23}
                color="#3f3f46"
                nodes={nodes}
              />
            ))}

            {/* Marco comercial Alsari Capital (Pavier + Armia) */}
            <AlsariCapitalFrame nodes={nodes} />

            {/* Nodos (encima de las aristas) */}
            {nodes.map(node => (
              <NodeBox
                key={node.id}
                node={node}
                onClick={() => {
                  if (node.isPerson) return;
                  onSelectSociety(node.id);
                  onClose();
                }}
              />
            ))}

            {/* Leyenda */}
            <g transform={`translate(20, ${svgH - 44})`}>
              <rect x={0} y={0} width={12} height={12} rx={6} fill="#0f0f12" stroke="#52525b" strokeDasharray="5 3" strokeWidth={1} />
              <text x={18} y={9} fill="#52525b" fontSize={9}>Propietario</text>
              <rect x={120} y={0} width={8} height={8} rx={2} fill="#17253a" stroke="#2563a8" strokeWidth={1.5} />
              <text x={134} y={8} fill="#52525b" fontSize={9}>Holding</text>
              <rect x={200} y={0} width={8} height={8} rx={2} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
              <text x={214} y={8} fill="#52525b" fontSize={9}>Filial</text>
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
