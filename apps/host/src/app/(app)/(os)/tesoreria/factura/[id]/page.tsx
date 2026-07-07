import Link from 'next/link';
import { formatCurrency } from '@alsari/utils';
import { cargarFacturaEmitidaPorId, datosRealesDisponibles } from '@/lib/datos/fuenteDatos';
import { OSEmptyState, OSPageHeader } from '@/components/os/ui';
import { BotonImprimir } from './BotonImprimir';

// Vista imprimible de una factura operativa (serie OPS/DRV): página limpia de
// FONDO BLANCO pensada para Ctrl+P → PDF. Se pinta como overlay sobre el shell
// oscuro del OS; las reglas @media print de globals.css garantizan que al
// imprimir solo sale la factura (.factura-print).

const NOMBRE_ORIGEN: Record<string, string> = {
  sesion: 'Sesión',
  bono: 'Bono',
  programa: 'Programa',
  partner: 'Partner B2B',
};

export default async function FacturaImprimiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!datosRealesDisponibles()) {
    return (
      <div className="pb-10">
        <OSPageHeader titulo="Factura operativa" />
        <div className="px-8 pt-4">
          <OSEmptyState
            titulo="Sin conexión a Supabase"
            descripcion="La vista imprimible necesita los datos reales (entorno no configurado — modo demo)."
          />
        </div>
      </div>
    );
  }

  const f = await cargarFacturaEmitidaPorId(id);
  if (!f) {
    return (
      <div className="pb-10">
        <OSPageHeader titulo="Factura operativa" />
        <div className="px-8 pt-4">
          <OSEmptyState
            titulo="Factura no encontrada"
            descripcion="El identificador no corresponde a ninguna factura emitida operativa."
          />
        </div>
      </div>
    );
  }

  const concepto = f.concepto ?? `Servicios (${NOMBRE_ORIGEN[f.origenTipo] ?? f.origenTipo})`;
  const conDesglose = f.base !== null;
  const iva = f.iva ?? 0;

  return (
    <div className="factura-print fixed inset-0 z-50 overflow-y-auto bg-white text-zinc-900">
      {/* Barra de acciones — solo pantalla, nunca en papel */}
      <div className="mx-auto flex max-w-2xl items-center justify-between px-8 pt-6 print:hidden">
        <Link
          href="/tesoreria"
          className="text-2xs uppercase tracking-widest text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-800 hover:underline"
        >
          ← Volver a Tesorería
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-2xs uppercase tracking-widest text-zinc-400">
            Estado: {f.estado.replaceAll('_', ' ')}
          </span>
          <BotonImprimir />
        </div>
      </div>

      {/* Hoja de factura */}
      <div className="mx-auto max-w-2xl px-8 py-10">
        <header className="border-b border-zinc-200 pb-8">
          <p className="text-2xl font-light uppercase tracking-[0.45em] text-zinc-900">
            Antifrágil
          </p>
          <p className="text-2xs mt-2 uppercase tracking-widest text-zinc-500">
            Clínica · Operativa · Finanzas
          </p>
        </header>

        <section className="flex flex-wrap items-start justify-between gap-6 py-8">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Factura operativa</p>
            <p className="mt-1 text-xl font-light tracking-tight">
              {f.serie}-{f.numero}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Fecha</p>
            <p className="mt-1 text-sm">{f.fecha}</p>
          </div>
        </section>

        <section className="grid gap-8 pb-8 sm:grid-cols-2">
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Contraparte</p>
            <p className="mt-1 text-sm">{f.contraparte}</p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Origen</p>
            <p className="mt-1 text-sm">{NOMBRE_ORIGEN[f.origenTipo] ?? f.origenTipo}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-2xs uppercase tracking-widest text-zinc-500">Concepto</p>
            <p className="mt-1 text-sm leading-relaxed">{concepto}</p>
          </div>
        </section>

        <section className="border-t border-zinc-200">
          {conDesglose ? (
            <>
              <div className="flex items-baseline justify-between border-b border-zinc-100 py-3">
                <span className="text-2xs uppercase tracking-widest text-zinc-500">
                  Base imponible
                </span>
                <span className="text-sm">{formatCurrency(f.base ?? 0)}</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-zinc-100 py-3">
                <span className="text-2xs uppercase tracking-widest text-zinc-500">
                  {iva === 0 ? 'IVA — exento' : 'IVA'}
                </span>
                <span className="text-sm">{formatCurrency(iva)}</span>
              </div>
              {iva === 0 ? (
                <p className="text-2xs border-b border-zinc-100 py-3 uppercase tracking-widest text-zinc-500">
                  Servicios sanitarios exentos de IVA (art. 20.Uno.3º Ley 37/1992)
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-2xs border-b border-zinc-100 py-3 uppercase tracking-widest text-zinc-500">
              Desglose base/IVA no registrado en el OS (factura vinculada a documento externo)
            </p>
          )}
          <div className="flex items-baseline justify-between py-4">
            <span className="text-2xs uppercase tracking-widest text-zinc-700">Total</span>
            <span className="text-2xl font-light tracking-tight">{formatCurrency(f.importe)}</span>
          </div>
        </section>

        {f.refFacturaExterna ? (
          <p className="text-2xs pt-2 uppercase tracking-widest text-zinc-400">
            Ref. factura oficial externa: {f.refFacturaExterna}
          </p>
        ) : null}

        <footer className="mt-14 border-t border-zinc-200 pt-4">
          <p className="text-2xs uppercase tracking-widest text-zinc-400">
            Documento operativo interno — no es factura fiscal oficial
          </p>
        </footer>
      </div>
    </div>
  );
}
