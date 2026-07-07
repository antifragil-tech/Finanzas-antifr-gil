import Link from 'next/link';
import { formatCurrency } from '@alsari/utils';
import {
  aplicarLote,
  conciliarPago,
  descartarLote,
  subirReporte,
} from '@/lib/datos/accionesImportacion';
import {
  cargarFacturasConciliables,
  cargarPagosSalientesSinFactura,
  cuentasTesoreriaPorTipo,
  datosRealesDisponibles,
  idsExistentes,
} from '@/lib/datos/fuenteDatos';
import {
  construirPlan,
  leerLote,
  loteValido,
  sugerirFacturas,
  TIPOS_REPORTE,
  type PlanImportacion,
} from '@/lib/datos/importacionWeb';
import { primerValor } from '@/lib/datos/periodo';
import { OSEmptyState, OSPageHeader, OSSection, OSStatusBadge } from '@/components/os/ui';

// Importación web de reportes periódicos (Salonized · efectivo · extracto
// banco) + conciliación pago→factura. Flujo: subir CSV → lote temporal en
// tmpdir (JAMÁS el repo) → preview server-rendered → Aplicar (claves uuid v5
// deterministas: re-importar el mismo archivo no duplica).

const MAX_FILAS_PREVIEW = 80;

function BotonEnviar({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="text-2xs rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function ListaAvisos({
  titulo,
  items,
  tono,
}: {
  titulo: string;
  items: string[];
  tono: 'warn' | 'danger';
}) {
  if (items.length === 0) return null;
  const visibles = items.slice(0, 10);
  return (
    <div className="mt-3">
      <p className="text-2xs mb-1 uppercase tracking-widest text-zinc-500">
        {titulo} ({items.length})
      </p>
      <ul
        className={`rounded-xl border px-4 py-2.5 text-xs ${
          tono === 'danger'
            ? 'border-rose-400/20 bg-rose-400/5 text-rose-300'
            : 'border-amber-400/20 bg-amber-400/5 text-amber-300'
        }`}
      >
        {visibles.map((e, i) => (
          <li key={i} className="py-0.5">
            {e}
          </li>
        ))}
        {items.length > visibles.length ? (
          <li className="py-0.5 text-zinc-500">… y {items.length - visibles.length} más</li>
        ) : null}
      </ul>
    </div>
  );
}

async function Previsualizacion({ loteId }: { loteId: string }) {
  const lote = await leerLote(loteId);
  if (!lote) {
    return (
      <OSEmptyState
        titulo="Lote no encontrado o caducado"
        descripcion="Los lotes viven en el directorio temporal del servidor solo hasta aplicarse o descartarse. Vuelve a subir el archivo."
      />
    );
  }
  const plan: PlanImportacion = construirPlan(lote.tipo, lote.csv, await cuentasTesoreriaPorTipo());

  // Duplicados: ids deterministas que YA existen en su tabla destino.
  const idsPorTabla = new Map<string, string[]>();
  for (const f of plan.vista) {
    idsPorTabla.set(f.tabla, [...(idsPorTabla.get(f.tabla) ?? []), f.id]);
  }
  const existentes = new Set<string>();
  for (const [tabla, ids] of idsPorTabla) {
    for (const id of await idsExistentes(tabla, ids)) existentes.add(id);
  }
  const nuevas = plan.vista.filter((f) => !existentes.has(f.id)).length;
  const etiquetaTipo = TIPOS_REPORTE.find((t) => t.valor === lote.tipo);
  const filasVisibles = plan.vista.slice(0, MAX_FILAS_PREVIEW);

  return (
    <div>
      <p className="text-xs text-zinc-400">
        <span className="text-zinc-200">{lote.nombreArchivo}</span> · {etiquetaTipo?.etiqueta} →{' '}
        {etiquetaTipo?.destino} · {plan.vista.length} filas válidas ·{' '}
        <span className="text-emerald-300">{nuevas} nuevas</span> ·{' '}
        <span className="text-amber-300">{plan.vista.length - nuevas} ya importadas</span> ·{' '}
        <span className={plan.errores.length > 0 ? 'text-rose-300' : ''}>
          {plan.errores.length} errores
        </span>
      </p>

      <ListaAvisos titulo="Errores (esas filas NO entran)" items={plan.errores} tono="danger" />
      <ListaAvisos titulo="Avisos" items={plan.avisos} tono="warn" />
      <ListaAvisos titulo="Valores no reconocidos" items={plan.desconocidos} tono="warn" />

      <div className="glass-panel mt-4 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="text-2xs border-b border-white/5 uppercase tracking-widest text-zinc-500">
            <tr>
              {['Fecha', 'Concepto', 'Importe', 'Destino', 'Estado', 'Detalle'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((f) => (
              <tr
                key={f.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2.5 text-zinc-500">{f.fecha}</td>
                <td className="max-w-[320px] truncate px-4 py-2.5 text-zinc-200">{f.concepto}</td>
                <td className={`px-4 py-2.5 ${f.importe < 0 ? 'text-rose-300' : 'text-zinc-300'}`}>
                  {formatCurrency(f.importe)}
                </td>
                <td className="px-4 py-2.5 font-mono text-zinc-500">{f.tabla}</td>
                <td className="px-4 py-2.5">
                  <OSStatusBadge tone={existentes.has(f.id) ? 'warn' : 'ok'}>
                    {existentes.has(f.id) ? 'Ya importada' : 'Nueva'}
                  </OSStatusBadge>
                </td>
                <td className="px-4 py-2.5 text-zinc-500">{f.detalle ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.vista.length > filasVisibles.length ? (
        <p className="text-2xs mt-2 uppercase tracking-widest text-zinc-600">
          Mostrando {filasVisibles.length} de {plan.vista.length} filas — Aplicar procesa todas
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <form action={aplicarLote}>
          <input type="hidden" name="lote" value={loteId} />
          <BotonEnviar>Aplicar importación</BotonEnviar>
        </form>
        <form action={descartarLote}>
          <input type="hidden" name="lote" value={loteId} />
          <button
            type="submit"
            className="text-2xs rounded-lg border border-white/10 px-4 py-2 uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Descartar lote
          </button>
        </form>
        <span className="text-2xs uppercase tracking-widest text-zinc-600">
          re-importar el mismo archivo no duplica (clave determinista por fila)
        </span>
      </div>
    </div>
  );
}

async function Conciliacion() {
  const [pagos, facturas] = await Promise.all([
    cargarPagosSalientesSinFactura(),
    cargarFacturasConciliables(),
  ]);
  if (pagos.length === 0) {
    return (
      <OSEmptyState
        titulo="No hay pagos salientes pendientes de conciliar"
        descripcion="Importa un extracto de banco: los movimientos negativos sin factura asociada aparecerán aquí con sus candidatas."
      />
    );
  }
  return (
    <div className="space-y-3">
      {pagos.map((p) => {
        const sugerencias = sugerirFacturas(p, facturas);
        return (
          <div key={p.id} className="glass-panel rounded-2xl px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-sm text-zinc-200">
                {p.concepto}
                <span className="text-2xs ml-3 uppercase tracking-widest text-zinc-600">
                  {p.fecha}
                </span>
              </p>
              <p className="text-sm text-rose-300">{formatCurrency(p.importe)}</p>
            </div>
            {sugerencias.length === 0 ? (
              <p className="text-2xs mt-2 uppercase tracking-widest text-zinc-600">
                Sin candidatas (importe ±0,01 € y fecha ±45 días) — registra la factura primero
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sugerencias.map((s) => (
                  <li
                    key={s.factura.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5"
                  >
                    <span className="text-xs text-zinc-300">
                      {s.factura.proveedor}
                      <span className="text-2xs ml-2 text-zinc-500">
                        {s.factura.fecha} · {formatCurrency(s.factura.total)} ·{' '}
                        {s.factura.estado.replaceAll('_', ' ')} ·{' '}
                        {s.afinidad > 0 ? `afinidad ${s.afinidad}` : 'sin afinidad de nombre'} · Δ
                        {s.diasDiferencia}d
                      </span>
                    </span>
                    <form action={conciliarPago}>
                      <input type="hidden" name="movimiento_id" value={p.id} />
                      <input type="hidden" name="factura_id" value={s.factura.id} />
                      <BotonEnviar>Vincular y marcar pagada</BotonEnviar>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const loteParam = primerValor(params['lote']);
  const lote = loteValido(loteParam) ? loteParam : undefined;
  const avisoOk = primerValor(params['ok']);
  const avisoError = primerValor(params['error']);
  const real = datosRealesDisponibles();

  return (
    <div className="pb-10">
      <OSPageHeader
        titulo="Importar reportes"
        descripcion={
          real
            ? 'Salonized, efectivo y extracto de banco → preview con detección de duplicados → aplicar a las tablas reales. El archivo no se guarda en el repositorio.'
            : 'Modo demo sin Supabase: la preview funciona, pero Aplicar devolverá un error legible.'
        }
        acciones={
          <Link
            href="/tesoreria"
            className="text-2xs uppercase tracking-widest text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
          >
            ← Tesorería
          </Link>
        }
      />

      {avisoOk || avisoError ? (
        <div className="px-8 pt-2">
          <p
            className={`rounded-xl border px-4 py-2.5 text-xs ${
              avisoError
                ? 'border-rose-400/20 bg-rose-400/5 text-rose-300'
                : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
            }`}
          >
            {avisoError ?? avisoOk}
          </p>
        </div>
      ) : null}

      <OSSection
        titulo="Subir reporte"
        nota="CSV exportado · máx. 4 MB · el lote temporal se destruye al aplicar o descartar"
      >
        <form
          action={subirReporte}
          encType="multipart/form-data"
          className="glass-panel grid gap-3 rounded-2xl px-5 py-4 md:grid-cols-3"
        >
          <label>
            <span className="field-label">Tipo de reporte</span>
            <select name="tipo" required className="field-input">
              {TIPOS_REPORTE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Archivo CSV</span>
            <input
              type="file"
              name="archivo"
              required
              accept=".csv,text/csv,text/plain"
              className="field-input file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-0.5 file:text-xs file:text-zinc-200"
            />
          </label>
          <div className="self-end pb-0.5">
            <BotonEnviar>Previsualizar</BotonEnviar>
          </div>
        </form>
      </OSSection>

      {lote ? (
        <OSSection
          titulo="Previsualización"
          nota="Nada se escribe hasta pulsar Aplicar — filas con error quedan fuera"
        >
          <Previsualizacion loteId={lote} />
        </OSSection>
      ) : null}

      <OSSection
        titulo="Conciliación banco → facturas recibidas"
        nota="Pagos salientes sin factura asociada · match por importe ±0,01 €, fecha ±45 días y afinidad de nombre"
      >
        {real ? (
          <Conciliacion />
        ) : (
          <OSEmptyState
            titulo="Sin conexión a Supabase"
            descripcion="La conciliación necesita los movimientos bancarios reales (entorno no configurado — modo demo)."
          />
        )}
      </OSSection>
    </div>
  );
}
