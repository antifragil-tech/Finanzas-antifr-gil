import { FileText, FileCheck, Wallet, AlertCircle } from 'lucide-react';
import { ScreenShell } from './ScreenShell';
import { Bloque, Fila, Tag, eur } from '../panel/PanelKit';
import { demoFacturas, type EstadoFactura } from '../mock/demoData';

const estadoCls: Record<EstadoFactura, string> = {
  pendiente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  revisada: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  pagada: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  incidencia: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-widest ${estadoCls[estado]}`}>
      {estado}
    </span>
  );
}

const F = demoFacturas;

export function FacturasDemo() {
  return (
    <ScreenShell icon={FileText} titulo="Facturación" aviso="Facturación demo · sin datos fiscales reales">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque titulo="Facturas recibidas" icon={FileText} tag={<Tag>mock</Tag>}>
          {F.recibidas.map((f) => (
            <Fila key={f.numero} label={`${f.numero} · ${f.contraparte}`} value={eur(f.importe)} tag={<EstadoBadge estado={f.estado} />} />
          ))}
        </Bloque>

        <Bloque titulo="Facturas emitidas" icon={FileCheck} tag={<Tag>mock</Tag>}>
          {F.emitidas.map((f) => (
            <Fila key={f.numero} label={`${f.numero} · ${f.contraparte}`} value={eur(f.importe)} tag={<EstadoBadge estado={f.estado} />} />
          ))}
        </Bloque>

        <Bloque titulo="Pagos registrados" icon={Wallet} tag={<Tag>mock</Tag>}>
          {F.pagos.map((p) => (
            <Fila key={p.ref} label={`${p.ref} · ${p.concepto}`} value={eur(p.importe)} tag={<Tag>{p.medio}</Tag>} />
          ))}
        </Bloque>

        <Bloque titulo="Incidencias" icon={AlertCircle} tag={<Tag>demo</Tag>}>
          {F.incidencias.map((i) => (
            <Fila key={`${i.ref}-${i.tipo}`} label={`${i.ref} · ${i.tipo}`} value={<Tag>{i.severidad}</Tag>} />
          ))}
        </Bloque>
      </div>
      <p className="mt-6 text-2xs uppercase tracking-widest text-amber-400/80">
        Estados: pendiente · revisada · pagada · incidencia — todo demo, sin datos fiscales reales
      </p>
    </ScreenShell>
  );
}
