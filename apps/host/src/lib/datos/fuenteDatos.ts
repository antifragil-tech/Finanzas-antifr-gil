import type {
  FacturaEmitidaOperativa,
  FacturaRecibida,
  GastoOperativo,
  IngresoOperativo,
} from '@antifragil/operativa';

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
  proyecto_id_ref: string | null;
  pendiente_confirmacion: boolean;
  nota: string | null;
}

/** Proyecto de la clínica en public.proyectos: sus gastos SÍ son operativa. */
export const PROYECTO_CLINICA = 'CLI-PLY';

/** Gasto del dominio + el proyecto al que está imputado en la tabla real. */
export type GastoReal = GastoOperativo & { proyectoIdRef?: string };

/**
 * Segrega la operativa de la CLÍNICA de los proyectos externos (CENS, MENDRA,
 * 9AM…): los KPIs y la escalera de la clínica excluyen esos gastos, que se
 * muestran aparte — se segrega, nunca se oculta.
 */
export function separarPorProyecto(gastos: GastoReal[]): {
  clinica: GastoReal[];
  proyectos: GastoReal[];
} {
  const clinica: GastoReal[] = [];
  const proyectos: GastoReal[] = [];
  for (const g of gastos) {
    if (g.proyectoIdRef && g.proyectoIdRef !== PROYECTO_CLINICA) proyectos.push(g);
    else clinica.push(g);
  }
  return { clinica, proyectos };
}

interface FilaIngreso {
  id: string;
  fecha_devengo: string;
  origen: IngresoOperativo['origen'];
  concepto: string | null;
  importe_devengado: number | string;
  pendiente_confirmacion: boolean;
}

/** Gastos reales importados (Cash Flow: su fecha es la de PAGO), con su proyecto. */
export async function cargarGastosReales(): Promise<GastoReal[]> {
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
    ...(f.proyecto_id_ref ? { proyectoIdRef: f.proyecto_id_ref } : {}),
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

interface FilaFacturaEmitida {
  id: string;
  serie: string;
  numero: number;
  origen_tipo: FacturaEmitidaOperativa['origenTipo'];
  origen_id: string | null;
  contraparte: string;
  fecha: string;
  importe: number | string;
  estado: FacturaEmitidaOperativa['estado'];
  ref_factura_externa: string | null;
  notas: string | null;
}

function mapearFacturaEmitida(f: FilaFacturaEmitida): FacturaEmitidaOperativa {
  return {
    id: f.id,
    serie: f.serie,
    numero: f.numero,
    origenTipo: f.origen_tipo,
    origenId: f.origen_id ?? '',
    contraparte: f.contraparte,
    fecha: f.fecha,
    importe: Number(f.importe),
    estado: f.estado,
    ...(f.ref_factura_externa ? { refFacturaExterna: f.ref_factura_externa } : {}),
  };
}

/** Facturas emitidas operativas reales (registro precontable, doc 02). */
export async function cargarFacturasEmitidasReales(): Promise<FacturaEmitidaOperativa[]> {
  const filas = await rest<FilaFacturaEmitida>(
    'facturas_emitidas_operativas?select=*&order=fecha.desc,numero.desc&limit=1000',
  );
  return filas.map(mapearFacturaEmitida);
}

/** Detalle de una factura emitida operativa, con el desglose base/IVA parseado de las notas. */
export interface FacturaEmitidaDetalle extends FacturaEmitidaOperativa {
  concepto: string | null;
  base: number | null;
  iva: number | null;
  notas: string | null;
}

/**
 * La tabla facturas_emitidas_operativas no desglosa IVA a propósito (D2:
 * catálogo sanitario exento). La emisión manual guarda el desglose en `notas`
 * con formato estable «Concepto: … · Base: 0.00 · IVA: 0.00»; aquí se parsea.
 */
function parsearDesglose(notas: string | null): {
  concepto: string | null;
  base: number | null;
  iva: number | null;
} {
  if (!notas) return { concepto: null, base: null, iva: null };
  const concepto = /Concepto:\s*(.*?)(?:\s+·\s+(?:Base|IVA):|$)/.exec(notas)?.[1] ?? null;
  const base = /Base:\s*(\d+(?:\.\d+)?)/.exec(notas)?.[1];
  const iva = /IVA:\s*(\d+(?:\.\d+)?)/.exec(notas)?.[1];
  return {
    concepto,
    base: base !== undefined ? Number(base) : null,
    iva: iva !== undefined ? Number(iva) : null,
  };
}

export async function cargarFacturaEmitidaPorId(id: string): Promise<FacturaEmitidaDetalle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const filas = await rest<FilaFacturaEmitida>(
    `facturas_emitidas_operativas?select=*&id=eq.${id}&limit=1`,
  );
  const fila = filas[0];
  if (!fila) return null;
  return { ...mapearFacturaEmitida(fila), notas: fila.notas, ...parsearDesglose(fila.notas) };
}

interface FilaFacturaRecibidaOperativa {
  id: string;
  contraparte: string;
  fecha: string;
  importe: number | string;
  estado_operativo: FacturaRecibida['estado'] | null;
  gasto_operativo_id: string | null;
  liquidacion_id: string | null;
}

/**
 * Facturas recibidas reales vía la vista v_facturas_recibidas_operativas
 * (traduce el estado físico del workflow OCR al vocabulario del producto).
 */
export async function cargarFacturasRecibidasReales(): Promise<FacturaRecibida[]> {
  const filas = await rest<FilaFacturaRecibidaOperativa>(
    'v_facturas_recibidas_operativas?select=*&order=fecha.desc&limit=1000',
  );
  return filas.map((f) => ({
    id: f.id,
    contraparte: f.contraparte,
    tipo: 'proveedor',
    fecha: f.fecha,
    importe: Number(f.importe),
    estado: f.estado_operativo ?? 'recibida',
    ...(f.gasto_operativo_id ? { gastoId: f.gasto_operativo_id } : {}),
    ...(f.liquidacion_id ? { liquidacionRef: f.liquidacion_id } : {}),
  }));
}

interface FilaLiquidacion {
  id: string;
  mes: string;
  importe_calculado: number | string;
  estado: string;
  notas: string | null;
  clinica_profesionales: { nombre: string; activo: boolean } | null;
  lineas_liquidacion: { detalle: string; cantidad: number | string; importe: number | string }[];
}

export interface LiquidacionReal {
  id: string;
  mes: string;
  profesional: string;
  activo: boolean;
  detalle: string;
  importe: number;
  estado: string;
}

/** Liquidaciones reales importadas (Pago de Trabajadores nov-2024 → dic-2025). */
export async function cargarLiquidacionesReales(): Promise<LiquidacionReal[]> {
  const filas = await rest<FilaLiquidacion>(
    'liquidaciones_mensuales?select=id,mes,importe_calculado,estado,notas,clinica_profesionales(nombre,activo),lineas_liquidacion(detalle,cantidad,importe)&order=mes.desc&limit=500',
  );
  return filas.map((f) => ({
    id: f.id,
    mes: f.mes,
    profesional: f.clinica_profesionales?.nombre ?? 'profesional',
    activo: f.clinica_profesionales?.activo ?? true,
    detalle: f.lineas_liquidacion.map((l) => l.detalle).join(' · ') || '—',
    importe: Number(f.importe_calculado),
    estado: f.estado,
  }));
}

// ---------------------------------------------------------------------------
// Importación de reportes y conciliación (lecturas)
// ---------------------------------------------------------------------------

/** Cuentas de tesorería activas por TIPO (nunca ids hardcodeados). Seguro sin env. */
export async function cuentasTesoreriaPorTipo(): Promise<{
  caja: string | null;
  banco: string | null;
}> {
  try {
    const filas = await rest<{ id: string; tipo: string }>(
      'cuenta_tesoreria?select=id,tipo&activa=is.true&order=created_at.asc',
    );
    return {
      caja: filas.find((c) => c.tipo === 'caja')?.id ?? null,
      banco: filas.find((c) => c.tipo === 'banco')?.id ?? null,
    };
  } catch {
    return { caja: null, banco: null };
  }
}

/** ¿Cuáles de estos ids ya existen en la tabla? (detección de duplicados en la preview). */
export async function idsExistentes(tabla: string, ids: string[]): Promise<Set<string>> {
  const existentes = new Set<string>();
  if (!datosRealesDisponibles()) return existentes;
  for (let i = 0; i < ids.length; i += 80) {
    const trozo = ids.slice(i, i + 80);
    try {
      const filas = await rest<{ id: string }>(
        `${tabla}?select=id&id=in.(${trozo.join(',')})&limit=${trozo.length}`,
      );
      for (const f of filas) existentes.add(f.id);
    } catch {
      // La preview sigue sin marca de duplicados antes que romper la página.
    }
  }
  return existentes;
}

export interface PagoSalienteBanco {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
}

/** Pagos SALIENTES del banco aún sin factura recibida asociada (conciliación v1). */
export async function cargarPagosSalientesSinFactura(): Promise<PagoSalienteBanco[]> {
  const filas = await rest<{
    id: string;
    fecha: string;
    concepto: string;
    importe: number | string;
  }>(
    'movimientos_bancarios?select=id,fecha,concepto,importe&importe=lt.0&factura_recibida_id=is.null&order=fecha.desc&limit=100',
  );
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    concepto: f.concepto,
    importe: Number(f.importe),
  }));
}

export interface FacturaConciliable {
  id: string;
  proveedor: string;
  fecha: string;
  total: number;
  estado: string;
  gastoOperativoId: string | null;
}

/** Facturas recibidas sin movimiento bancario vinculado (candidatas de conciliación). */
export async function cargarFacturasConciliables(): Promise<FacturaConciliable[]> {
  const filas = await rest<{
    id: string;
    proveedor_nombre: string;
    fecha_factura: string;
    total: number | string;
    estado: string;
    gasto_operativo_id: string | null;
  }>(
    'facturas_recibidas?select=id,proveedor_nombre,fecha_factura,total,estado,gasto_operativo_id&movimiento_id=is.null&estado=neq.rechazada&order=fecha_factura.desc&limit=1000',
  );
  return filas.map((f) => ({
    id: f.id,
    proveedor: f.proveedor_nombre,
    fecha: f.fecha_factura,
    total: Number(f.total),
    estado: f.estado,
    gastoOperativoId: f.gasto_operativo_id,
  }));
}

// ---------------------------------------------------------------------------
// Cuentas por cobrar y proyectos
// ---------------------------------------------------------------------------

export type EstadoCxc = 'pendiente' | 'cobrada' | 'cancelada';

export interface CuentaPorCobrar {
  id: string;
  fechaOrigen: string;
  deudor: string;
  concepto: string;
  importe: number;
  proyectoIdRef: string | null;
  estado: EstadoCxc;
  cobroId: string | null;
  notas: string | null;
}

/** Cuentas por cobrar reales (p. ej. el 50 % de los pagos CENS que debe Felipe). */
export async function cargarCuentasPorCobrar(): Promise<CuentaPorCobrar[]> {
  const filas = await rest<{
    id: string;
    fecha_origen: string;
    deudor: string;
    concepto: string;
    importe: number | string;
    proyecto_id_ref: string | null;
    estado: EstadoCxc;
    cobro_id: string | null;
    notas: string | null;
  }>('cuentas_por_cobrar?select=*&order=fecha_origen.desc&limit=500');
  return filas.map((f) => ({
    id: f.id,
    fechaOrigen: f.fecha_origen,
    deudor: f.deudor,
    concepto: f.concepto,
    importe: Number(f.importe),
    proyectoIdRef: f.proyecto_id_ref,
    estado: f.estado,
    cobroId: f.cobro_id,
    notas: f.notas,
  }));
}

export interface TotalesCxc {
  pendiente: number;
  cobrada: number;
  porDeudor: { deudor: string; pendiente: number; partidas: number }[];
}

/** Totales derivados de CxC (nunca almacenados): pendiente/cobrado y desglose por deudor. */
export function totalesCxc(cuentas: CuentaPorCobrar[]): TotalesCxc {
  const porDeudor = new Map<string, { pendiente: number; partidas: number }>();
  let pendiente = 0;
  let cobrada = 0;
  for (const c of cuentas) {
    if (c.estado === 'cobrada') cobrada += c.importe;
    if (c.estado !== 'pendiente') continue;
    pendiente += c.importe;
    const acc = porDeudor.get(c.deudor) ?? { pendiente: 0, partidas: 0 };
    acc.pendiente += c.importe;
    acc.partidas += 1;
    porDeudor.set(c.deudor, acc);
  }
  return {
    pendiente: Math.round(pendiente * 100) / 100,
    cobrada: Math.round(cobrada * 100) / 100,
    porDeudor: [...porDeudor.entries()]
      .map(([deudor, v]) => ({ deudor, ...v, pendiente: Math.round(v.pendiente * 100) / 100 }))
      .sort((a, b) => b.pendiente - a.pendiente),
  };
}

export interface ProyectoInfo {
  idRef: string;
  nombre: string;
  estado: string;
}

/** Catálogo de proyectos (CLI-PLY, CENS, MENDRA, 9AM, LIDO, EVT). */
export async function cargarProyectos(): Promise<ProyectoInfo[]> {
  const filas = await rest<{ id_ref: string; nombre: string; estado: string | null }>(
    'proyectos?select=id_ref,nombre,estado&order=id_ref.asc&limit=100',
  );
  return filas.map((f) => ({ idRef: f.id_ref, nombre: f.nombre, estado: f.estado ?? 'activo' }));
}

/** Cuentas de tesorería activas (para elegir dónde entra un cobro). */
export interface CuentaTesoreriaInfo {
  id: string;
  nombre: string;
  tipo: string;
}

export async function cargarCuentasTesoreria(): Promise<CuentaTesoreriaInfo[]> {
  try {
    return await rest<CuentaTesoreriaInfo>(
      'cuenta_tesoreria?select=id,nombre,tipo&activa=is.true&order=tipo.asc',
    );
  } catch {
    return [];
  }
}
