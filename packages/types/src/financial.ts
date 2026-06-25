// any-justificado: datos crudos de CSV vía CF Worker. Schema tipado en Fase 2 con Zod + Supabase.

export type EntityType = 'TOTAL' | 'HOLDING' | 'FILIAL';

export type Society = {
  'Nombre de la Sociedad': string;
  'ID-Ref': string;
  CIF?: string;
  '% Pavier': number;
  '% Armia': number;
  parent_sociedad_id?: string | null;
  pct_en_sociedad_padre?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type Project = {
  Nombre: string;
  'ID-Ref': string;
  'Sociedad-Ref': string;
  'Inversión inicial'?: number;
  Valoración?: number;
  'Margen latente de salida'?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type FinancialSociety = {
  Nombre: string;
  'Caja Disponible': number;
  'Deuda Bancaria'?: number;
  'Deuda Bancaria L/P'?: number;
  'Deuda Bancaria C/P'?: number;
  'Deuda de socios'?: number;
  'Fondo de maniobra'?: number;
  'Activo Corriente'?: number;
  'Pasivo Corriente'?: number;
  'Patrimonio neto'?: number;
  'Activo Total'?: number;
  'Pasivo Total'?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type FinancialProject = {
  Nombre: string;
  'ID-Ref': string;
  'Sociedad-Ref': string;
  'Capital Expuesto'?: number;
  'Beneficio Acumulado'?: number;
  'Margen Latente'?: number;
  'Margen latente de salida'?: number;
  'Margen Latente %'?: number;
  Valoración?: number;
  'Inversión inicial'?: number;
  'ReCapex Acumulado'?: number;
  Presupuesto?: number;
  'Sociedad tenedora'?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type FichaRecord = {
  Subcuenta: string;
  Nombre: string;
  Debe: number;
  Haber: number;
  Saldo: number;
};

export type ConsolidatedData = {
  propio: FinancialSociety;
  consolidated: FinancialSociety;
  type: EntityType;
  hasProjects: boolean;
  projects: FinancialProject[];
};

export type DashboardData = {
  sociedades: Society[];
  proyectos: Project[];
  finanzas_sociedades: FinancialSociety[];
  finanzas_proyectos: FinancialProject[];
  fichas: Record<string, FichaRecord[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ponderados?: Record<string, any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bancos?: Record<string, any[]>;
};

export type SelectionState = {
  type: EntityType;
  id: string;
  name: string;
};

export type SocietyOption = {
  id: string;
  nombre: string;
  idRef: string | null;
  cif?: string;
  variant: 'primary' | 'secondary' | 'neutral';
  badge?: string;
  showCrown?: boolean;
};

export type ViewOption = {
  id: string;
  nombre: string;
};

// ── Flujos de caja y métricas de proyecto ─────────────────────────────────────

export type TipoFlujo =
  | 'inversion'
  | 'recapex'
  | 'venta'
  | 'dividendo'
  | 'ingreso_operativo'
  | 'gasto_operativo'
  | 'otro';

export type FlujoCajaRow = {
  id: string;
  proyecto_id: string;
  fecha: string;
  importe: number;
  tipo_flujo: TipoFlujo;
  concepto: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MetricasProyecto = {
  tir: number | null;
  van: number | null;
  moic: number | null;
  dias_desde_inicio: number | null;
  periodo_inversion_dias: number | null;
  tasa_descuento_van: number;
};

export type ProyectoDetalle = {
  id_ref: string;
  nombre: string;
  sociedad_tenedora: string | null;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_prevista_salida: string | null;
  fecha_salida_real: string | null;
  tipo_activo: string | null;
  ubicacion: string | null;
  superficie_m2: number | null;
};

// ── Patrimonio personal y societario ─────────────────────────────────────────

export type CategoriaActivo = 'inmobiliario' | 'fondo' | 'cotizado' | 'bien_valor';

export type PersonaPatrimonio = {
  id: string;
  nombre: string;
};

export type ActivoPatrimonio = {
  id: string;
  titular_tipo: 'persona' | 'sociedad';
  titular_persona_id: string | null;
  titular_sociedad_id: string | null;
  titular_nombre?: string;

  categoria: CategoriaActivo;
  subcategoria: string | null;
  nombre: string;

  valor_adquisicion: number | null;
  valor_actual: number;
  deuda_viva: number;
  porcentaje_propiedad: number;
  moneda: string;
  fecha_valoracion: string | null;
  notas: string | null;

  // Inmobiliario
  cuota_mensual: number | null;
  renta_mensual: number | null;

  // Fondo / Cotizado
  isin: string | null;
  ticker: string | null;
  gestora_broker: string | null;
  num_unidades: number | null;
  precio_coste_medio: number | null;
  dividendo_anual_por_unidad: number | null;
  fecha_inicio_inversion: string | null;
  tae_declarada: number | null;

  // Bien de valor
  coste_mantenimiento_anual: number | null;

  created_at?: string;
  updated_at?: string;
};

export type CapexActivo = {
  id: string;
  activo_id: string;
  descripcion: string;
  importe: number;
  fecha: string;
  created_at?: string;
};
