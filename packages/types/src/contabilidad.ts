// Tipos para el módulo de contabilidad: movimientos bancarios, facturas, asientos, reconciliación.

export type BancoOrigen = 'santander' | 'bbva' | 'caixabank' | 'caja_rural' | 'otro';

export type CategoriaMovimiento =
  | 'intragrupo_entrada'
  | 'intragrupo_salida'
  | 'fiscal'
  | 'rentas_cobradas'
  | 'cobros_operacion_inmobiliaria'
  | 'gastos_inmobiliarios'
  | 'notaria_legal'
  | 'proveedores'
  | 'personal'
  | 'bancarios'
  | 'dividendos'
  | 'rendimientos_financieros'
  | 'devoluciones'
  | 'extraordinario';

export type MovimientoBancario = {
  id: string;
  sociedad_id_ref: string;
  iban: string;
  banco: BancoOrigen;
  fecha: string;                // ISO date
  fecha_valor: string | null;
  concepto: string;
  concepto_normalizado: string | null;
  importe: number;              // negativo = salida, positivo = entrada
  saldo: number | null;
  categoria: CategoriaMovimiento | null;
  subcategoria: string | null;
  es_intragrupo: boolean;
  entidad_contraparte: string | null;
  proyecto_id_ref: string | null;
  factura_recibida_id: string | null;
  asiento_borrador_id: string | null;
  revisado: boolean;
  notas: string | null;
  fuente: string;
  // PR F — importación de extractos bancarios
  extracto_id: string | null;
  hash: string | null;              // dedup: sha256(sociedad|iban|fecha|importe|concepto_norm|saldo|referencia)
  referencia: string | null;
  tipo_movimiento: string | null;
  cuenta_bancaria_id: string | null;
  importado_at: string;
  created_at: string;
};

// ── PR F — Extractos bancarios (statements) ───────────────────────────────────
export type EstadoExtracto = 'importado' | 'pendiente_revision' | 'listo_conciliacion' | 'deshecho';

export const ESTADO_EXTRACTO_LABEL: Record<EstadoExtracto, string> = {
  importado:          'Importado',
  pendiente_revision: 'Pendiente de revisión',
  listo_conciliacion: 'Listo para conciliación',
  deshecho:           'Deshecho',
};

export type ExtractoBancario = {
  id: string;
  sociedad_id_ref: string;
  cuenta_bancaria_id: string | null;
  banco: string | null;
  iban: string | null;
  anio: number;
  mes: number;
  nombre_archivo: string | null;
  formato: 'csv' | 'xlsx' | null;
  archivo_hash: string;
  n_movimientos: number;
  n_importados: number;
  n_duplicados: number;
  rango_fecha_min: string | null;
  rango_fecha_max: string | null;
  estado: EstadoExtracto;
  importado_por_email: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type LineaFactura = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  tipo_iva: number;
  subtotal: number;
};

// Workflow canónico: borrador_ocr → revision_javi? (si total > umbral) → pendiente_pago → pagada
//                    cualquier estado → rechazada (con motivo)
// Estos son los valores TÉCNICOS canónicos (alineados con BD viva, frontend y
// Edge Function). La migración 20260521130000 (estados_v2) intentó renombrarlos a
// validacion/revision/pago pero quedó HUÉRFANA: nunca se reflejó en código y la
// migración 202606191000 la neutraliza. No usar validacion/revision/pago.
export type EstadoFacturaRecibida =
  | 'borrador_ocr'    // validación de Guille
  | 'revision_javi'   // revisión de Javi (si supera el umbral)
  | 'pendiente_pago'  // aprobada, pendiente de pago de Alicia
  | 'pagada'
  | 'rechazada';

// Labels visibles canónicos (fuente única; no duplicar en componentes).
export const ESTADO_FACTURA_RECIBIDA_LABEL: Record<EstadoFacturaRecibida, string> = {
  borrador_ocr:   'Validación Guille',
  revision_javi:  'Revisión Javi',
  pendiente_pago: 'Pendiente de pago',
  pagada:         'Pagada',
  rechazada:      'Rechazada',
};

// Tipo de operación a efectos de IVA (España)
export type TipoOperacion =
  | 'normal'                  // IVA normal (21 %, 10 %, 5 %, 4 %, 0 %)
  | 'exenta'                  // Exenta de IVA (art. 20 LIVA)
  | 'no_sujeta'               // No sujeta a IVA
  | 'inversion_sujeto_pasivo' // Receptor auto-liquida el IVA (art. 84 LIVA)
  | 'suplido';                // Gasto pagado por cuenta del cliente, sin IVA

// Confianza OCR por campo (0–1). Ausente = sin dato OCR.
export type OcrConfianza = Partial<Record<
  | 'proveedor_nombre' | 'proveedor_nif' | 'numero_factura'
  | 'fecha_factura' | 'fecha_vencimiento'
  | 'base_imponible' | 'tipo_iva' | 'cuota_iva'
  | 'retencion_pct' | 'retencion_importe' | 'total' | 'concepto'
  | 'tipo_operacion' | 'receptor_nombre' | 'receptor_nif',
  number
>>;

export type RolAprobacion = 'guille' | 'javi' | 'alicia';

// ── Auditoría de transiciones de factura (log inmutable) ──────────────────────
export type ActorRol = 'guille' | 'javi' | 'alicia' | 'sistema' | 'otro';

export type AccionAprobacion =
  | 'crea_borrador_ocr'   // la Edge Function crea la factura (actor: sistema)
  | 'valida'              // Guille valida
  | 'aprueba'             // Javi aprueba (si supera el umbral)
  | 'rechaza'             // rechazo con motivo
  | 'marca_pagada'        // Alicia marca pagada
  | 'registra_pago'       // Alicia registra un pago (parcial/total/anticipo/regularización)
  | 'crea_incidencia'     // descuadre de pago (sobrepago/infrapago)
  | 'resuelve_incidencia' // incidencia resuelta
  | 'cambia_sociedad'     // cambio manual de la sociedad receptora
  | 'solicita_aclaracion' // (reservado)
  | 'cambia_estado';      // (reservado) cambio manual de estado

export type FacturaAprobacion = {
  id: string;
  factura_id: string;
  actor_email: string | null;
  actor_nombre: string | null;
  actor_rol: ActorRol;
  accion: AccionAprobacion;
  estado_anterior: string | null;
  estado_nuevo: string;
  comentario: string | null;
  motivo_rechazo: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// Labels visibles de cada acción (fuente única para la timeline).
export const ACCION_APROBACION_LABEL: Record<AccionAprobacion, string> = {
  crea_borrador_ocr:   'Creada desde OCR',
  valida:              'Validada',
  aprueba:             'Aprobada',
  rechaza:             'Rechazada',
  marca_pagada:        'Marcada como pagada',
  registra_pago:       'Pago registrado',
  crea_incidencia:     'Incidencia creada',
  resuelve_incidencia: 'Incidencia resuelta',
  cambia_sociedad:     'Cambio de sociedad',
  solicita_aclaracion: 'Solicita aclaración',
  cambia_estado:       'Cambio de estado',
};

// ── Pagos de factura (libro de tesorería) e incidencias ───────────────────────
export type MetodoPago = 'transferencia' | 'domiciliacion' | 'tarjeta' | 'efectivo' | 'otro';
export type TipoPago = 'total' | 'parcial' | 'anticipo' | 'regularizacion';

// Estado de pago DERIVADO (no se persiste en facturas_recibidas.estado).
export type EstadoPago = 'sin_pagos' | 'pago_parcial' | 'pagada' | 'sobrepagada' | 'descuadrada';

export type TipoIncidenciaFactura =
  | 'infrapago' | 'sobrepago' | 'justificante_no_coincide'
  | 'falta_justificante' | 'pago_duplicado_posible' | 'otro';
export type SeveridadIncidencia = 'baja' | 'media' | 'alta';

export type FacturaPago = {
  id: string;
  factura_id: string;
  importe: number;                        // negativo solo en tipo_pago='regularizacion'
  fecha_pago: string;                     // ISO date
  metodo_pago: MetodoPago;
  tipo_pago: TipoPago;
  justificante_storage_path: string | null;   // bucket privado `facturas` → signed URL
  justificante_nombre_archivo: string | null;
  justificante_mime_type: string | null;
  justificante_size: number | null;
  comentario: string | null;
  registrado_por_email: string | null;
  registrado_por_rol: string | null;
  drive_file_id: string | null;         // PR D: justificante archivado en Google Drive
  drive_estado: DriveEstado;
  drive_error: string | null;
  drive_web_link: string | null;
  drive_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FacturaIncidencia = {
  id: string;
  factura_id: string;
  pago_id: string | null;
  tipo: TipoIncidenciaFactura;
  severidad: SeveridadIncidencia;
  descripcion: string | null;
  resuelta: boolean;
  resuelta_por_email: string | null;
  resuelta_at: string | null;
  created_at: string;
};

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  domiciliacion: 'Domiciliación',
  tarjeta:       'Tarjeta',
  efectivo:      'Efectivo',
  otro:          'Otro',
};

export const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  total:          'Pago total',
  parcial:        'Pago parcial',
  anticipo:       'Anticipo',
  regularizacion: 'Regularización',
};

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  sin_pagos:    'Sin pagos',
  pago_parcial: 'Pago parcial',
  pagada:       'Pagada',
  sobrepagada:  'Sobrepagada',
  descuadrada:  'Descuadrada',
};

export const TIPO_INCIDENCIA_LABEL: Record<TipoIncidenciaFactura, string> = {
  infrapago:                'Infrapago',
  sobrepago:                'Sobrepago',
  justificante_no_coincide: 'Justificante no coincide',
  falta_justificante:       'Falta justificante',
  pago_duplicado_posible:   'Posible pago duplicado',
  otro:                     'Otro',
};

// ── Archivo documental en Google Drive (PR D) ─────────────────────────────────
// Drive es archivo SECUNDARIO; Supabase Storage sigue siendo la fuente operativa.
export type DriveEstado = 'no_archivado' | 'sincronizado' | 'error';

export const DRIVE_ESTADO_LABEL: Record<DriveEstado, string> = {
  no_archivado: 'No archivado',
  sincronizado: 'Archivado en Drive',
  error:        'Error Drive',
};

export type ConfiguracionContabilidad = {
  id: string;
  umbral_aprobacion_javi: number;
  email_guille: string;
  email_javi: string;
  email_alicia: string;
  // Interruptor maestro de notificaciones externas (emails a Javi/Alicia,
  // recordatorios). Hoy SIEMPRE false: ningún envío real está implementado.
  // Las "notificaciones" viven como bandejas/badges internos. Se activará en una
  // fase final, cuando el flujo esté validado.
  notifications_enabled: boolean;
  updated_at: string;
};

export type Contacto = {
  id: string;
  nombre: string;
  nif: string | null;
  tipo: 'proveedor' | 'cliente' | 'ambos';
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

// ── PR E — Reglas de proveedor recurrente / domiciliadas ──────────────────────
// Regla por (contacto, sociedad) para SUGERIR campos de factura. v1 = SOLO
// sugerencias: nada se auto-valida, auto-aprueba ni auto-paga. `sociedad_id_ref`
// null = regla GLOBAL del proveedor (fallback). `auto_validar` es INERTE en v1.
export type ProveedorRegla = {
  id: string;
  contacto_id: string;
  nif_normalizado: string | null;
  sociedad_id_ref: string | null;            // null = regla global del proveedor
  cuenta_contable_default: string | null;
  proyecto_id_ref: string | null;
  presupuesto_id: string | null;
  partida_id: string | null;
  metodo_pago_default: MetodoPago | null;
  es_domiciliada: boolean;
  requiere_pago_manual: boolean;
  requiere_aprobacion_javi: boolean;         // v1: solo aviso visual (no fuerza routing)
  requiere_factura: boolean;
  requiere_justificante_pago: boolean;
  tipo_operacion_default: TipoOperacion | null;
  iva_default: number | null;
  retencion_pct_default: number | null;
  importe_habitual: number | null;
  tolerancia_importe_pct: number | null;
  concepto_recurrente: string | null;
  auto_validar: boolean;                     // INERTE en v1 (reservado v2)
  activa: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

// Sub-estado operativo DERIVADO de una factura domiciliada (no se persiste).
export type EstadoOperativoDomiciliada = 'pendiente_cargo' | 'cargada_sin_justificante' | 'pagada';

export const ESTADO_OPERATIVO_DOMICILIADA_LABEL: Record<EstadoOperativoDomiciliada, string> = {
  pendiente_cargo:          'Pendiente de cargo',
  cargada_sin_justificante: 'Cargada · falta justificante',
  pagada:                   'Pagada',
};

export type FacturaRecibida = {
  id: string;
  sociedad_id_ref: string | null;       // PR D.1: null = sin sociedad validada (pendiente)
  sociedad_validada: boolean;           // PR D.1: false = sociedad receptora pendiente de validar
  numero_factura: string | null;
  proveedor_nombre: string;
  proveedor_nif: string | null;
  fecha_factura: string;
  fecha_vencimiento: string | null;
  base_imponible: number;
  tipo_iva: number;
  cuota_iva: number;
  retencion_pct: number;
  retencion_importe: number;
  total: number;
  total_a_pagar: number;
  concepto: string | null;
  categoria: string | null;
  subcategoria: string | null;
  proyecto_id_ref: string | null;
  estado: EstadoFacturaRecibida;
  movimiento_id: string | null;
  cuenta_gasto: string | null;
  tipo_operacion: TipoOperacion | null;     // régimen IVA detectado por OCR
  receptor_nombre_ocr: string | null;       // destinatario detectado por OCR
  receptor_nif_ocr: string | null;          // NIF del destinatario detectado
  contacto_id: string | null;               // FK a contactos (auto-creado por OCR)
  ocr_raw: Record<string, unknown> | null;
  ocr_confianza: OcrConfianza | null;
  presupuesto_pago_id: string | null;   // FK a presupuesto_pagos — vinculación bidireccional
  storage_path: string | null;          // ruta del PDF en el bucket privado `facturas` (fuente de signed URLs)
  archivo_url: string | null;           // legado: URL pública previa (fallback si no hay storage_path)
  drive_file_id: string | null;         // PR D: PDF archivado en Google Drive
  drive_folder_id: string | null;
  drive_estado: DriveEstado;
  drive_error: string | null;
  drive_web_link: string | null;
  drive_synced_at: string | null;
  es_domiciliada: boolean;              // PR E: se cargará por domiciliación (no requiere transferencia manual)
  regla_aplicada_id: string | null;    // PR E: traza de la regla de proveedor usada para sugerir/aplicar
  notas: string | null;
  created_at: string;
  updated_at: string;
};

// Ficha de sociedad enriquecida (para facturación y cuentas bancarias)
export type SociedadContabilidad = {
  id: string;           // = id_ref en la tabla sociedades
  nombre: string;
  cif: string | null;
  domicilio: string | null;
  localidad: string | null;
  codigo_postal: string | null;
  pais: string | null;
  email: string | null;
  telefono: string | null;
  logo_url: string | null;
};

// Cuenta bancaria de cobro ligada a una sociedad
export type CuentaBancariaSociedad = {
  id: string;
  sociedad_id_ref: string;
  alias: string;
  titular: string;
  banco: string | null;
  iban: string;
  swift: string | null;
  activa: boolean;
  created_at: string;
};

export type EstadoFacturaEmitida = 'borrador' | 'emitida' | 'cobrada' | 'vencida' | 'anulada';

export type FacturaEmitida = {
  id: string;
  sociedad_id_ref: string;
  numero_factura: string;
  serie: string;
  cliente_nombre: string;
  cliente_nif: string | null;
  cliente_direccion: string | null;
  fecha_factura: string;
  fecha_vencimiento: string | null;
  lineas: LineaFactura[];
  base_imponible: number;
  tipo_iva: number;
  cuota_iva: number;
  retencion_pct: number;
  retencion_importe: number;
  total: number;
  total_a_cobrar: number;
  estado: EstadoFacturaEmitida;
  movimiento_id: string | null;
  notas: string | null;
  // Pago
  metodo_pago: string | null;
  cuenta_bancaria_iban: string | null;
  cuenta_bancaria_alias: string | null;
  cuenta_bancaria_titular: string | null;
  created_at: string;
  updated_at: string;
};

export type LineaAsiento = {
  cuenta_codigo: string;
  cuenta_descripcion: string;
  debe: number;
  haber: number;
};

export type EstadoAsientoBorrador = 'borrador' | 'confirmado' | 'rechazado';

export type AsientoBorrador = {
  id: string;
  sociedad_id_ref: string;
  fecha: string;
  numero: string | null;
  concepto: string;
  lineas: LineaAsiento[];
  total_debe: number;
  total_haber: number;
  estado: EstadoAsientoBorrador;
  movimiento_id: string | null;
  factura_recibida_id: string | null;
  factura_emitida_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FuenteAsientoOficial = 'a3' | 'sage' | 'holded' | 'contasol' | 'csv' | 'manual';
export type EstadoReconciliacion = 'pendiente' | 'coincide' | 'diferencia' | 'sin_borrador';

export type AsientoOficial = {
  id: string;
  sociedad_id_ref: string;
  fecha: string;
  numero_oficial: string | null;
  concepto: string;
  lineas: LineaAsiento[];
  total_debe: number;
  total_haber: number;
  fuente: FuenteAsientoOficial;
  asiento_borrador_id: string | null;
  estado_reconciliacion: EstadoReconciliacion;
  created_at: string;
};

export type PlanCuenta = {
  id: string;
  sociedad_id_ref: string;
  codigo: string;
  descripcion: string;
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'resultado';
  padre_codigo: string | null;
  nivel: number;
  activa: boolean;
  created_at: string;
};

export type ReglaCategorizacion = {
  id: string;
  patron: string;
  campo: 'concepto' | 'contraparte' | 'banco';
  es_regex: boolean;
  categoria: CategoriaMovimiento;
  subcategoria: string | null;
  es_intragrupo: boolean;
  prioridad: number;
  fuente: 'sistema' | 'usuario' | 'aprendizaje';
  confirmaciones: number;
  activa: boolean;
  created_at: string;
};

export type TipoReconciliacion =
  | 'coincide'
  | 'diferencia_importe'
  | 'diferencia_cuenta'
  | 'diferencia_fecha'
  | 'sin_borrador'
  | 'sin_oficial';

export type ReconciliacionItem = {
  id: string;
  sociedad_id_ref: string;
  periodo: string;
  asiento_oficial_id: string | null;
  asiento_borrador_id: string | null;
  tipo: TipoReconciliacion;
  score_similitud: number | null;
  diferencias: Record<string, unknown> | null;
  resuelto: boolean;
  resolucion_notas: string | null;
  created_at: string;
};

// ── DTOs para importación CSV ──────────────────────────────────────────────────

export type MovimientoCsvRaw = {
  fecha: string;
  fecha_valor?: string;
  concepto: string;
  importe: number;
  saldo?: number;
  referencia?: string;        // PR F (opcional; algunos formatos la traen)
  tipo_movimiento?: string;   // PR F (opcional)
};

export type ResultadoImportacion = {
  total: number;
  importados: number;
  duplicados: number;
  errores: number;
  extracto_id?: string;       // PR F
  ya_importado?: boolean;     // PR F: el fichero ya se había importado
  movimientos?: MovimientoBancario[];
};
