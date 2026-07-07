/**
 * Importación segura de Excel/CSV al dominio financiero (fase 3 del plan
 * MVP mock → Supabase). Fernando exporta cada hoja a CSV, la importación
 * mapea columnas por sinónimos, normaliza fechas/importes, clasifica contra
 * la taxonomía y convierte a entidades del dominio.
 *
 * Reglas duras:
 * - Ningún Excel/dato real se commitea: la salida vive en datos-locales/
 *   (gitignorado) o en memoria. Los fixtures del repo son SIEMPRE demo.
 * - Una columna desconocida NO rompe: se reporta como aviso.
 * - Un concepto desconocido NO rompe: entra como pendiente_confirmacion.
 * - Un gasto sin documento entra calculado pero bloqueado para pago.
 */

import { redondear } from './devengo';
import {
  CATEGORIA_DE,
  type FacturaEmitidaOperativa,
  type FacturaRecibida,
  type GastoOperativo,
  type IngresoOperativo,
  type TipoGasto,
} from './finanzas';

// ---------------------------------------------------------------------------
// CSV y normalización
// ---------------------------------------------------------------------------

export type Fila = Record<string, string>;

/** Parser CSV mínimo sin dependencias: detecta ; o , y respeta comillas. */
export function parseCsv(texto: string): Fila[] {
  const lineas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lineas.length < 2) return [];
  const sep =
    (lineas[0]?.match(/;/g)?.length ?? 0) >= (lineas[0]?.match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (linea: string): string[] => {
    const celdas: string[] = [];
    let actual = '';
    let entreComillas = false;
    for (const ch of linea) {
      if (ch === '"') entreComillas = !entreComillas;
      else if (ch === sep && !entreComillas) {
        celdas.push(actual.trim());
        actual = '';
      } else actual += ch;
    }
    celdas.push(actual.trim());
    return celdas;
  };
  const cabeceras = partir(lineas[0] ?? '');
  return lineas.slice(1).map((l) => {
    const celdas = partir(l);
    const fila: Fila = {};
    cabeceras.forEach((c, i) => {
      fila[c] = celdas[i] ?? '';
    });
    return fila;
  });
}

export function normalizarClave(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** "1.234,56" | "1234.56" | "45 €" → number (euros). */
export function normalizarImporte(v: string): number | null {
  const limpio = v.replace(/[€\s]/g, '');
  if (limpio === '') return null;
  const conPunto =
    limpio.includes(',') && limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  const n = Number(conPunto);
  return Number.isFinite(n) ? redondear(n) : null;
}

/** "5/7/2026" | "05-07-2026" | "2026-07-05" → ISO YYYY-MM-DD. */
export function normalizarFecha(v: string): string | null {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const anio = (a ?? '').length === 2 ? `20${a}` : a;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Plantillas de importación (columna canónica + sinónimos de mapeo)
// ---------------------------------------------------------------------------

export interface ColumnaPlantilla {
  clave: string;
  sinonimos: string[];
  requerida: boolean;
}

export type NombrePlantilla =
  | 'ingresos'
  | 'gastos'
  | 'facturas_recibidas'
  | 'facturas_emitidas'
  | 'facturas_salonized'
  | 'efectivo'
  | 'extracto_banco';

export const PLANTILLAS: Record<NombrePlantilla, ColumnaPlantilla[]> = {
  ingresos: [
    { clave: 'fecha', sinonimos: ['fecha', 'dia', 'date'], requerida: true },
    {
      clave: 'cliente',
      sinonimos: ['cliente', 'paciente', 'nombre', 'customer', 'customer_name', 'client'],
      requerida: true,
    },
    {
      clave: 'servicio',
      sinonimos: [
        'servicio',
        'tratamiento_tipo',
        'tipo_servicio',
        'treatment',
        'service',
        'service_name',
      ],
      requerida: true,
    },
    {
      clave: 'profesional',
      sinonimos: ['profesional', 'trabajador', 'employee', 'staff'],
      requerida: false,
    },
    { clave: 'centro', sinonimos: ['centro', 'clinica', 'sede'], requerida: false },
    { clave: 'canal', sinonimos: ['canal', 'origen'], requerida: false },
    { clave: 'tipo_ingreso', sinonimos: ['tipo_ingreso', 'tipo', 'modalidad'], requerida: true },
    {
      clave: 'importe_cobrado',
      sinonimos: ['importe_cobrado', 'cobrado', 'caja'],
      requerida: false,
    },
    {
      clave: 'importe_devengado',
      sinonimos: [
        'importe_devengado',
        'devengado',
        'importe',
        'ingreso',
        'total',
        'amount',
        'price',
      ],
      requerida: true,
    },
    {
      clave: 'metodo_pago',
      sinonimos: [
        'metodo_pago',
        'metodo_de_pago',
        'medio_pago',
        'forma_pago',
        'forma_de_pago',
        'payment_method',
      ],
      requerida: false,
    },
    {
      clave: 'factura_operativa',
      sinonimos: ['factura_operativa', 'factura_interna'],
      requerida: false,
    },
    {
      clave: 'factura_oficial_externa',
      sinonimos: ['factura_oficial_externa', 'factura_oficial'],
      requerida: false,
    },
    { clave: 'estado_cobro', sinonimos: ['estado_cobro', 'estado'], requerida: false },
    {
      clave: 'observacion_admin',
      sinonimos: ['observacion_admin', 'observaciones', 'notas'],
      requerida: false,
    },
  ],
  gastos: [
    {
      clave: 'fecha',
      sinonimos: ['fecha', 'dia', 'date', 'fecha_devengo', 'mes_devengo'],
      requerida: true,
    },
    { clave: 'fecha_pago', sinonimos: ['fecha_pago', 'pagado_en', 'mes_pago'], requerida: false },
    {
      clave: 'cuenta_tesoreria',
      sinonimos: ['cuenta_tesoreria', 'tesoreria', 'cuenta'],
      requerida: false,
    },
    {
      clave: 'proveedor_profesional',
      sinonimos: ['proveedor_profesional', 'proveedor', 'profesional', 'trabajador'],
      requerida: false,
    },
    {
      clave: 'concepto',
      sinonimos: ['concepto', 'descripcion', 'detalle', 'gasto'],
      requerida: true,
    },
    { clave: 'categoria', sinonimos: ['categoria', 'tipo_gasto', 'tipo'], requerida: true },
    {
      clave: 'capa_imputacion',
      sinonimos: ['capa_imputacion', 'capa', 'p_l', 'pl'],
      requerida: false,
    },
    { clave: 'centro', sinonimos: ['centro', 'clinica'], requerida: false },
    { clave: 'proyecto', sinonimos: ['proyecto'], requerida: false },
    { clave: 'importe', sinonimos: ['importe', 'total', 'monto', 'neto'], requerida: true },
    { clave: 'iva', sinonimos: ['iva', 'iva_si_aplica'], requerida: false },
    {
      clave: 'documento_recibido',
      sinonimos: ['documento_recibido', 'documento', 'factura_recibida', 'factura'],
      requerida: false,
    },
    { clave: 'estado_documento', sinonimos: ['estado_documento'], requerida: false },
    { clave: 'observaciones', sinonimos: ['observaciones', 'observacion'], requerida: false },
    { clave: 'estado_pago', sinonimos: ['estado_pago', 'pagado'], requerida: false },
    { clave: 'recurrente', sinonimos: ['recurrente', 'mensual'], requerida: false },
    { clave: 'amortizable', sinonimos: ['amortizable', 'inversion'], requerida: false },
    {
      clave: 'pendiente_confirmacion',
      sinonimos: ['pendiente_confirmacion', 'dudoso'],
      requerida: false,
    },
  ],
  facturas_recibidas: [
    { clave: 'fecha_emision', sinonimos: ['fecha_emision', 'fecha'], requerida: true },
    { clave: 'fecha_recepcion', sinonimos: ['fecha_recepcion'], requerida: false },
    { clave: 'proveedor', sinonimos: ['proveedor', 'emisor', 'profesional'], requerida: true },
    { clave: 'concepto', sinonimos: ['concepto', 'descripcion'], requerida: true },
    { clave: 'base', sinonimos: ['base', 'base_imponible'], requerida: false },
    { clave: 'iva', sinonimos: ['iva'], requerida: false },
    { clave: 'total', sinonimos: ['total', 'importe'], requerida: true },
    { clave: 'estado', sinonimos: ['estado', 'estado_pago'], requerida: false },
    {
      clave: 'documento_url_o_id_externo',
      sinonimos: ['documento_url_o_id_externo', 'documento', 'enlace'],
      requerida: false,
    },
    {
      clave: 'liquidacion_relacionada',
      sinonimos: ['liquidacion_relacionada', 'liquidacion'],
      requerida: false,
    },
    { clave: 'gasto_relacionado', sinonimos: ['gasto_relacionado', 'gasto'], requerida: false },
  ],
  facturas_emitidas: [
    { clave: 'fecha', sinonimos: ['fecha', 'fecha_emision'], requerida: true },
    {
      clave: 'cliente_partner',
      sinonimos: ['cliente_partner', 'cliente', 'partner'],
      requerida: true,
    },
    { clave: 'origen', sinonimos: ['origen', 'origen_tipo'], requerida: true },
    {
      clave: 'servicio_bono_programa_plan',
      sinonimos: ['servicio_bono_programa_plan', 'detalle', 'concepto'],
      requerida: false,
    },
    { clave: 'base', sinonimos: ['base', 'base_imponible'], requerida: false },
    { clave: 'iva', sinonimos: ['iva', 'iva_si_aplica'], requerida: false },
    { clave: 'total', sinonimos: ['total', 'importe'], requerida: true },
    { clave: 'estado', sinonimos: ['estado'], requerida: false },
    { clave: 'cobro_relacionado', sinonimos: ['cobro_relacionado', 'cobro'], requerida: false },
    {
      clave: 'factura_oficial_externa',
      sinonimos: ['factura_oficial_externa', 'factura_oficial'],
      requerida: false,
    },
  ],
  // Export de facturas de Salonized (semanal/mensual). Cabeceras GENÉRICAS y
  // tolerantes (ES/EN): cuando llegue el primer export real se afinan los
  // sinónimos, no la lógica.
  facturas_salonized: [
    {
      clave: 'numero_factura',
      sinonimos: [
        'numero_factura',
        'numero_de_factura',
        'numero',
        'num_factura',
        'n_factura',
        'no_factura',
        'factura',
        'invoice',
        'invoice_number',
        'invoice_no',
        'invoice_id',
        'reference',
        'referencia',
      ],
      requerida: true,
    },
    {
      clave: 'fecha',
      sinonimos: [
        'fecha',
        'fecha_factura',
        'fecha_emision',
        'date',
        'invoice_date',
        'created_at',
        'dia',
      ],
      requerida: true,
    },
    {
      clave: 'cliente',
      sinonimos: ['cliente', 'paciente', 'customer', 'customer_name', 'client', 'nombre', 'name'],
      requerida: true,
    },
    {
      clave: 'servicio',
      sinonimos: [
        'servicio',
        'tratamiento',
        'treatment',
        'concepto',
        'descripcion',
        'description',
        'detalle',
        'items',
      ],
      requerida: false,
    },
    {
      clave: 'importe',
      sinonimos: [
        'importe',
        'importe_total',
        'total',
        'amount',
        'total_amount',
        'precio',
        'price',
        'total_incl_tax',
        'grand_total',
      ],
      requerida: true,
    },
    {
      clave: 'metodo_pago',
      sinonimos: [
        'metodo_pago',
        'metodo_de_pago',
        'metodo',
        'medio_pago',
        'forma_pago',
        'forma_de_pago',
        'payment_method',
        'payment',
        'pago',
        'pagado_con',
      ],
      requerida: false,
    },
    { clave: 'estado', sinonimos: ['estado', 'status'], requerida: false },
  ],
  // Reporte periódico de pagos en EFECTIVO (formato acordado con Javi:
  // fecha;hora;importe;nota).
  efectivo: [
    { clave: 'fecha', sinonimos: ['fecha', 'dia', 'date'], requerida: true },
    { clave: 'hora', sinonimos: ['hora', 'time', 'hora_pago'], requerida: false },
    {
      clave: 'importe',
      sinonimos: ['importe', 'cantidad', 'total', 'amount', 'efectivo'],
      requerida: true,
    },
    {
      clave: 'nota',
      sinonimos: ['nota', 'notas', 'observaciones', 'observacion', 'comentario', 'comentarios'],
      requerida: false,
    },
  ],
  // Extracto semanal de la cuenta bancaria (export de Lidia). El importe va
  // CON SIGNO: negativo = pago saliente, positivo = abono entrante.
  extracto_banco: [
    {
      clave: 'fecha',
      sinonimos: ['fecha', 'fecha_operacion', 'f_operacion', 'fecha_contable', 'date', 'dia'],
      requerida: true,
    },
    {
      clave: 'fecha_valor',
      sinonimos: ['fecha_valor', 'f_valor', 'value_date'],
      requerida: false,
    },
    {
      clave: 'concepto',
      sinonimos: [
        'concepto',
        'descripcion',
        'description',
        'beneficiario',
        'concepto_operacion',
        'movimiento',
        'detalle',
        'mas_datos',
        'observaciones',
      ],
      requerida: true,
    },
    {
      clave: 'importe',
      sinonimos: ['importe', 'cantidad', 'amount', 'importe_eur', 'euros', 'imp'],
      requerida: true,
    },
    { clave: 'saldo', sinonimos: ['saldo', 'saldo_posterior', 'balance'], requerida: false },
    { clave: 'iban', sinonimos: ['iban', 'numero_cuenta', 'cuenta'], requerida: false },
    { clave: 'banco', sinonimos: ['banco', 'entidad'], requerida: false },
  ],
};

/** CSV descargable de cada plantilla, con una fila de ejemplo DEMO. */
export function plantillaCsv(nombre: NombrePlantilla): string {
  const cab = PLANTILLAS[nombre].map((c) => c.clave).join(';');
  const demo: Record<NombrePlantilla, string> = {
    ingresos:
      '05/07/2026;Cliente Demo 01;fisioterapia;Profesional Demo 01;playamar;organico;suelta;45;45;tarjeta;OPS-101;;cobrado;',
    gastos:
      '05/07/2026;;caja;Proveedor Demo;Alquiler clinica;alquiler;fijo;playamar;clinica;600;;si;recibida;;pagado;si;no;no',
    facturas_recibidas:
      '05/07/2026;;Proveedor Demo;Suministros;148,76;31,24;180;pendiente_recibir;;;g-suministros',
    facturas_emitidas: '05/07/2026;Cliente Demo 01;sesion;fisioterapia;45;;45;cobrada;;',
    facturas_salonized: 'INV-0001;05/07/2026;Cliente Demo 01;fisioterapia;45;datafono;pagada',
    efectivo: '2026-07-05;12:30;45;',
    extracto_banco: '05/07/2026;;TRANSFERENCIA PROVEEDOR DEMO;-180,00;1.234,56;;',
  };
  return `${cab}\n${demo[nombre]}\n`;
}

// ---------------------------------------------------------------------------
// Mapeo de columnas y resultado de importación
// ---------------------------------------------------------------------------

/**
 * Categorias del cashflow real de la clinica -> taxonomia del dominio.
 * Solo las inequivocas; el resto entra como concepto_provisional
 * (mapeo pendiente de confirmar con el cockpit).
 */
export const CATEGORIA_CASHFLOW: Record<string, TipoGasto> = {
  alquiler: 'alquiler',
  limpieza: 'mantenimiento',
  marketing: 'marketing',
  gestion: 'gestoria',
  materiales_clinica: 'material',
  recursos_digitales: 'software',
};

/** Columna "P&L" del cashflow -> capa de imputacion (doc 09 s4.2). */
export const PL_A_CAPA: Record<string, 'directo' | 'fijo' | 'general' | 'amortizable'> = {
  cogs: 'directo',
  personal_directo: 'directo',
  opex_directo: 'directo',
  personal_estructura: 'fijo',
  opex_estructura: 'general',
  impuestos: 'fijo',
  capex: 'amortizable',
};

/** Medio de pago (Salonized "Card"/"Cash", datafono, bizum...) -> normalizado. */
export function normalizarMetodoPago(
  v: string,
): 'tarjeta' | 'efectivo' | 'transferencia' | 'bizum' | 'otro' | null {
  const k = normalizarClave(v);
  if (k === '') return null;
  if (['tarjeta', 'card', 'datafono', 'tpv', 'credit_card'].includes(k)) return 'tarjeta';
  if (['efectivo', 'cash', 'metalico'].includes(k)) return 'efectivo';
  if (['transferencia', 'bank_transfer', 'transfer'].includes(k)) return 'transferencia';
  if (k === 'bizum') return 'bizum';
  return 'otro';
}

export interface MapeoColumnas {
  /** columna origen → clave canónica */
  mapa: Record<string, string>;
  desconocidas: string[];
  faltantes: string[];
}

export function mapearColumnas(cabeceras: string[], nombre: NombrePlantilla): MapeoColumnas {
  const plantilla = PLANTILLAS[nombre];
  const mapa: Record<string, string> = {};
  const usadas = new Set<string>();
  const desconocidas: string[] = [];
  for (const original of cabeceras) {
    const norm = normalizarClave(original);
    const col = plantilla.find((c) => c.sinonimos.some((s) => normalizarClave(s) === norm));
    if (col && !usadas.has(col.clave)) {
      mapa[original] = col.clave;
      usadas.add(col.clave);
    } else {
      desconocidas.push(original);
    }
  }
  const faltantes = plantilla
    .filter((c) => c.requerida && !usadas.has(c.clave))
    .map((c) => c.clave);
  return { mapa, desconocidas, faltantes };
}

function canonizar(fila: Fila, mapeo: MapeoColumnas): Fila {
  const salida: Fila = {};
  for (const [orig, valor] of Object.entries(fila)) {
    const clave = mapeo.mapa[orig];
    if (clave) salida[clave] = valor;
  }
  return salida;
}

export interface ResultadoImportacion<T> {
  entidades: T[];
  /** Conceptos/valores no reconocidos → revisar y confirmar. */
  desconocidos: string[];
  avisos: string[];
  errores: string[];
}

const esAfirmativo = (v: string | undefined) => /^(si|sí|s|true|1|x|yes)$/i.test((v ?? '').trim());

// ---------------------------------------------------------------------------
// Importadores → dominio
// ---------------------------------------------------------------------------

const TIPOS_INGRESO = ['suelta', 'bono', 'programa', 'plan', 'partner'] as const;

export function importarIngresos(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<IngresoOperativo> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'ingresos');
  const r: ResultadoImportacion<IngresoOperativo> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '');
    const devengado = normalizarImporte(fila['importe_devengado'] ?? '');
    if (!fecha || devengado === null) {
      r.errores.push(`fila ${i + 2}: fecha o importe_devengado inválidos`);
      return;
    }
    const tipoBruto = normalizarClave(fila['tipo_ingreso'] ?? '');
    const tipo = TIPOS_INGRESO.find((t) => t === tipoBruto);
    if (!tipo) r.desconocidos.push(`tipo_ingreso:${fila['tipo_ingreso'] ?? ''} (fila ${i + 2})`);
    r.entidades.push({
      id: `imp-ing-${i + 1}`,
      origen: tipo ?? 'suelta',
      concepto: `${fila['servicio'] ?? 'servicio'} · ${fila['cliente'] ?? 'cliente'}`,
      fecha,
      centroId: fila['centro'] ?? 'centro-playamar',
      canalId: fila['canal'] ?? 'canal-organico',
      importeDevengado: devengado,
      importeCobrado: normalizarImporte(fila['importe_cobrado'] ?? '') ?? 0,
      ...(normalizarMetodoPago(fila['metodo_pago'] ?? '')
        ? { metodoPago: normalizarMetodoPago(fila['metodo_pago'] ?? '')! }
        : {}),
      ...(fila['factura_operativa'] ? { facturaEmitidaId: fila['factura_operativa'] } : {}),
      ...(tipo ? {} : { pendienteConfirmacion: true }),
    });
  });
  return r;
}

export interface OpcionesImportacionGastos {
  /** Fecha a usar cuando la hoja no trae columna de fecha (hojas mensuales del cashflow). */
  fechaPorDefecto?: string;
  /** true si la hoja es un informe de CAJA: su fecha es la de PAGO, no la de devengo. */
  esInformeDeCaja?: boolean;
}

export function importarGastos(
  filas: Fila[],
  cabeceras?: string[],
  opciones: OpcionesImportacionGastos = {},
): ResultadoImportacion<GastoOperativo> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'gastos');
  const r: ResultadoImportacion<GastoOperativo> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  const tiposValidos = Object.keys(CATEGORIA_DE) as TipoGasto[];
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '') ?? opciones.fechaPorDefecto ?? null;
    const importe = normalizarImporte(fila['importe'] ?? '');
    if (!fecha || importe === null) {
      r.errores.push(`fila ${i + 2}: fecha o importe inválidos`);
      return;
    }
    const tipoBruto = normalizarClave(fila['categoria'] ?? '');
    const tipo = tiposValidos.find((t) => t === tipoBruto) ?? CATEGORIA_CASHFLOW[tipoBruto];
    if (!tipo) r.desconocidos.push(`categoria:${fila['categoria'] ?? ''} (fila ${i + 2})`);
    const amortizable = esAfirmativo(fila['amortizable']);
    const capaBruta = normalizarClave(fila['capa_imputacion'] ?? '');
    const capa =
      (['directo', 'fijo', 'compartido', 'general', 'amortizable'] as const).find(
        (c) => c === capaBruta,
      ) ?? PL_A_CAPA[capaBruta];
    const documentoRecibido = esAfirmativo(fila['documento_recibido']);
    const fechaPago =
      normalizarFecha(fila['fecha_pago'] ?? '') ?? (opciones.esInformeDeCaja ? fecha : null);
    const cuentaBruta = normalizarClave(fila['cuenta_tesoreria'] ?? '');
    const cuenta =
      cuentaBruta === 'banco'
        ? ('banco' as const)
        : cuentaBruta === 'cash' || cuentaBruta === 'caja'
          ? ('caja' as const)
          : null;
    r.entidades.push({
      id: `imp-gas-${i + 1}`,
      tipo: tipo ?? 'concepto_provisional',
      concepto: fila['concepto'] ?? 'sin concepto',
      fecha,
      ...(fechaPago && fechaPago !== fecha ? { fechaPago } : {}),
      ...(cuenta ? { cuentaTesoreria: cuenta } : {}),
      ...(fila['observaciones'] ? { nota: fila['observaciones'] } : {}),
      importe,
      capa: capa ?? (amortizable ? 'amortizable' : 'general'),
      documento: { tipo: 'factura_recibida', recibido: documentoRecibido },
      ...(fila['centro'] ? { centroId: fila['centro'] } : {}),
      ...(tipo && !esAfirmativo(fila['pendiente_confirmacion'])
        ? {}
        : { pendienteConfirmacion: true }),
    });
  });
  return r;
}

const ESTADOS_FR = [
  'pendiente_recibir',
  'recibida',
  'validada',
  'pendiente_pago',
  'pagada',
  'bloqueada',
] as const;

export function importarFacturasRecibidas(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<FacturaRecibida> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'facturas_recibidas');
  const r: ResultadoImportacion<FacturaRecibida> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha_emision'] ?? '');
    const total = normalizarImporte(fila['total'] ?? '');
    if (!fecha || total === null) {
      r.errores.push(`fila ${i + 2}: fecha_emision o total inválidos`);
      return;
    }
    const estadoBruto = normalizarClave(fila['estado'] ?? 'pendiente_recibir');
    const estado = ESTADOS_FR.find((e) => e === estadoBruto);
    if (!estado) r.desconocidos.push(`estado:${fila['estado'] ?? ''} (fila ${i + 2})`);
    r.entidades.push({
      id: `imp-fr-${i + 1}`,
      contraparte: fila['proveedor'] ?? 'proveedor',
      tipo: fila['liquidacion_relacionada'] ? 'autonomo' : 'gasto_clinica',
      fecha,
      importe: total,
      estado: estado ?? 'pendiente_recibir',
      ...(fila['gasto_relacionado'] ? { gastoId: fila['gasto_relacionado'] } : {}),
      ...(fila['liquidacion_relacionada']
        ? { liquidacionRef: fila['liquidacion_relacionada'] }
        : {}),
    });
  });
  return r;
}

const ESTADOS_FE = [
  'borrador',
  'emitida_operativa',
  'cobrada',
  'pendiente_documento_oficial',
  'vinculada_factura_externa',
] as const;
const ORIGENES_FE = ['sesion', 'bono', 'programa', 'partner'] as const;

export function importarFacturasEmitidas(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<FacturaEmitidaOperativa> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'facturas_emitidas');
  const r: ResultadoImportacion<FacturaEmitidaOperativa> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '');
    const total = normalizarImporte(fila['total'] ?? '');
    if (!fecha || total === null) {
      r.errores.push(`fila ${i + 2}: fecha o total inválidos`);
      return;
    }
    const origenBruto = normalizarClave(fila['origen'] ?? '');
    const origen = ORIGENES_FE.find((o) => o === origenBruto);
    if (!origen) r.desconocidos.push(`origen:${fila['origen'] ?? ''} (fila ${i + 2})`);
    const estadoBruto = normalizarClave(fila['estado'] ?? 'emitida_operativa');
    const estado = ESTADOS_FE.find((e) => e === estadoBruto);
    r.entidades.push({
      id: `imp-fe-${i + 1}`,
      serie: 'IMP',
      numero: i + 1,
      origenTipo: origen ?? 'sesion',
      origenId: fila['servicio_bono_programa_plan'] ?? '',
      contraparte: fila['cliente_partner'] ?? 'cliente',
      fecha,
      importe: total,
      estado: estado ?? 'emitida_operativa',
      ...(fila['factura_oficial_externa']
        ? { refFacturaExterna: fila['factura_oficial_externa'] }
        : {}),
    });
  });
  return r;
}

// ---------------------------------------------------------------------------
// Reportes periódicos (Salonized · efectivo · extracto banco)
// ---------------------------------------------------------------------------

export type MetodoPagoNormalizado = NonNullable<ReturnType<typeof normalizarMetodoPago>>;

/** Factura del export periódico de Salonized (una fila = una factura). */
export interface FacturaSalonizedImportada {
  id: string;
  /** Nº de factura de Salonized — clave natural para no duplicar al re-importar. */
  numeroFactura: string;
  fecha: string;
  cliente: string;
  concepto: string;
  importe: number;
  /** null = el export no traía método de pago (no se genera cobro). */
  metodoPago: MetodoPagoNormalizado | null;
  estado?: string;
}

export function importarFacturasSalonized(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<FacturaSalonizedImportada> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'facturas_salonized');
  const r: ResultadoImportacion<FacturaSalonizedImportada> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '');
    const importe = normalizarImporte(fila['importe'] ?? '');
    if (!fecha || importe === null) {
      r.errores.push(`fila ${i + 2}: fecha o importe inválidos`);
      return;
    }
    const numeroFactura = (fila['numero_factura'] ?? '').trim();
    if (!numeroFactura) {
      r.avisos.push(
        `fila ${i + 2}: sin nº de factura — la clave anti-duplicados se deriva del contenido`,
      );
    }
    const metodoPago = normalizarMetodoPago(fila['metodo_pago'] ?? '');
    if (metodoPago === 'otro') {
      r.desconocidos.push(`metodo_pago:${fila['metodo_pago'] ?? ''} (fila ${i + 2})`);
    }
    r.entidades.push({
      id: `imp-sal-${i + 1}`,
      numeroFactura,
      fecha,
      cliente: fila['cliente'] ?? 'cliente',
      concepto: fila['servicio'] ?? 'servicio clínica',
      importe,
      metodoPago,
      ...(fila['estado'] ? { estado: fila['estado'] } : {}),
    });
  });
  return r;
}

/** Pago en efectivo del reporte periódico de Javi (fecha;hora;importe;nota). */
export interface PagoEfectivoImportado {
  id: string;
  fecha: string;
  /** HH:MM si el reporte la trae; '' si no. Parte de la clave anti-duplicados. */
  hora: string;
  importe: number;
  nota: string;
}

export function importarEfectivo(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<PagoEfectivoImportado> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'efectivo');
  const r: ResultadoImportacion<PagoEfectivoImportado> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '');
    const importe = normalizarImporte(fila['importe'] ?? '');
    if (!fecha || importe === null || importe === 0) {
      r.errores.push(`fila ${i + 2}: fecha o importe inválidos`);
      return;
    }
    r.entidades.push({
      id: `imp-efe-${i + 1}`,
      fecha,
      hora: (fila['hora'] ?? '').trim(),
      importe,
      nota: (fila['nota'] ?? '').trim(),
    });
  });
  return r;
}

/** Movimiento del extracto bancario semanal (importe CON SIGNO). */
export interface MovimientoBancoImportado {
  id: string;
  fecha: string;
  fechaValor?: string;
  concepto: string;
  /** Negativo = pago saliente (candidato a conciliar con factura recibida). */
  importe: number;
  saldo?: number;
  iban?: string;
  banco?: string;
}

export function importarExtractoBanco(
  filas: Fila[],
  cabeceras?: string[],
): ResultadoImportacion<MovimientoBancoImportado> {
  const mapeo = mapearColumnas(cabeceras ?? Object.keys(filas[0] ?? {}), 'extracto_banco');
  const r: ResultadoImportacion<MovimientoBancoImportado> = {
    entidades: [],
    desconocidos: [...mapeo.desconocidas.map((c) => `columna:${c}`)],
    avisos: mapeo.faltantes.map((f) => `falta columna requerida: ${f}`),
    errores: [],
  };
  filas.forEach((filaOriginal, i) => {
    const fila = canonizar(filaOriginal, mapeo);
    const fecha = normalizarFecha(fila['fecha'] ?? '');
    const importe = normalizarImporte(fila['importe'] ?? '');
    if (!fecha || importe === null || importe === 0) {
      r.errores.push(`fila ${i + 2}: fecha o importe inválidos`);
      return;
    }
    const concepto = (fila['concepto'] ?? '').trim();
    if (!concepto) {
      r.avisos.push(`fila ${i + 2}: movimiento sin concepto — dificulta la conciliación`);
    }
    const fechaValor = normalizarFecha(fila['fecha_valor'] ?? '');
    const saldo = normalizarImporte(fila['saldo'] ?? '');
    r.entidades.push({
      id: `imp-ban-${i + 1}`,
      fecha,
      ...(fechaValor ? { fechaValor } : {}),
      concepto: concepto || 'movimiento sin concepto',
      importe,
      ...(saldo !== null ? { saldo } : {}),
      ...(fila['iban']?.trim() ? { iban: fila['iban'].trim() } : {}),
      ...(fila['banco']?.trim() ? { banco: fila['banco'].trim() } : {}),
    });
  });
  return r;
}
