// Tipos canónicos de los datos maestros (sociedades, proyectos, KPIs).
// La fuente de verdad es Supabase; el parser de Excel que vivía aquí se
// eliminó cuando el Excel maestro quedó obsoleto como vía de carga (2026-06-12).

export type SociedadRow = {
  id_ref: string;
  nombre: string;
  cif: string | null;
  holding_principal: string | null;
  pct_pavier: number | null;
  pct_armia: number | null;
  estado: string | null;
  parent_sociedad_id: string | null;
  pct_en_sociedad_padre: number | null;
};

export type ProyectoRow = {
  id_ref: string;
  nombre: string;
  sociedad_tenedora: string | null;
  estado: string | null;
};

export type KpisSocRow = {
  id_ref: string;
  nombre: string | null;
  tipo: string | null;
  caja_disponible: number | null;
  deuda_bancaria_cp: number | null;
  deuda_bancaria_lp: number | null;
  deuda_bancaria: number | null;
  deuda_socios: number | null;
  deuda_financiera_neta: number | null;
  activo_corriente: number | null;
  activo_no_corriente: number | null;
  activo_total: number | null;
  pasivo_corriente: number | null;
  pasivo_no_corriente: number | null;
  pasivo_total: number | null;
  fondo_maniobra: number | null;
  patrimonio_neto: number | null;
  fecha_actualizacion: string | null;
};

export type KpisProjRow = {
  id_ref: string;
  nombre: string | null;
  tipo: string | null;
  sociedad_tenedora: string | null;
  presupuesto: number | null;
  inversion_inicial: number | null;
  recapex_acumulado: number | null;
  capital_expuesto: number | null;
  deuda: number | null;
  beneficio_acumulado_bruto: number | null;
  opex_acumulado: number | null;
  valoracion: number | null;
  margen_latente_salida: number | null;
  margen_latente_salida_pct: number | null;
  fecha_actualizacion: string | null;
};
