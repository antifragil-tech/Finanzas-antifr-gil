import type { GastoOperativo, IngresoOperativo } from '@antifragil/operativa';

/**
 * Fuente de datos del OS (solo servidor): lee las tablas reales de Supabase
 * vía PostgREST con la service_role key (jamás llega al cliente) y mapea al
 * dominio. Sin entorno configurado devuelve null y las pantallas caen al
 * escenario demo — así el build de CI sin secrets sigue en verde.
 */

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

export function datosRealesDisponibles(): boolean {
  return Boolean(URL_BASE && SERVICE_KEY);
}

async function rest<T>(recurso: string): Promise<T[]> {
  if (!URL_BASE || !SERVICE_KEY) return [];
  const res = await fetch(`${URL_BASE}/rest/v1/${recurso}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'count=none',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostgREST ${recurso}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

interface FilaGasto {
  id: string;
  fecha: string;
  tipo: GastoOperativo['tipo'];
  concepto: string;
  importe: number | string;
  capa: GastoOperativo['capa'];
  documento_tipo: GastoOperativo['documento']['tipo'];
  documento_recibido: boolean;
  documento_referencia: string | null;
  pendiente_confirmacion: boolean;
  nota: string | null;
}

interface FilaIngreso {
  id: string;
  fecha_devengo: string;
  origen: IngresoOperativo['origen'];
  concepto: string | null;
  importe_devengado: number | string;
  pendiente_confirmacion: boolean;
}

/** Gastos reales importados (Cash Flow: su fecha es la de PAGO). */
export async function cargarGastosReales(): Promise<GastoOperativo[]> {
  const filas = await rest<FilaGasto>('gastos_operativos?select=*&order=fecha.asc&limit=5000');
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    concepto: f.concepto,
    fecha: f.fecha,
    importe: Number(f.importe),
    capa: f.capa,
    documento: {
      tipo: f.documento_tipo,
      recibido: f.documento_recibido,
      ...(f.documento_referencia ? { referencia: f.documento_referencia } : {}),
    },
    ...(f.pendiente_confirmacion ? { pendienteConfirmacion: true } : {}),
    ...(f.nota ? { nota: f.nota } : {}),
  }));
}

/** Ingresos devengados reales (agregados mensuales del Excel; la caja real de cobros llegará con Salonized). */
export async function cargarIngresosReales(): Promise<IngresoOperativo[]> {
  const filas = await rest<FilaIngreso>(
    'ingresos_devengados?select=*&order=fecha_devengo.asc&limit=5000',
  );
  return filas.map((f) => ({
    id: f.id,
    origen: f.origen,
    concepto: f.concepto ?? 'ingreso',
    fecha: f.fecha_devengo,
    centroId: 'centro-playamar',
    canalId: 'canal-organico',
    importeDevengado: Number(f.importe_devengado),
    importeCobrado: 0,
    ...(f.pendiente_confirmacion ? { pendienteConfirmacion: true } : {}),
  }));
}
