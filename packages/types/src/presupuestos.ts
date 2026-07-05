export type PresupuestoEstado = 'borrador' | 'activo' | 'cerrado';
export type PresupuestoTipo = 'obra' | 'explotacion' | 'capex' | 'corporativo' | 'tesoreria';
export type PresupuestoCategoria = 'gasto' | 'ingreso';
export type PagoEstado = 'pendiente' | 'pagado' | 'cancelado';
export type PagoTipoFlujo = 'gasto' | 'ingreso';

export type Presupuesto = {
  id: string;
  nombre: string;
  tipo: PresupuestoTipo;
  categoria: PresupuestoCategoria;
  proyecto_id_ref: string | null;
  proyecto_nombre: string | null;
  sociedad_id_ref: string | null;
  estado: PresupuestoEstado;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string | null;
  es_presupuesto_maestro: boolean;
  fecha_aprobacion: string | null;
  aprobado_por: string | null;
  created_at: string;
  updated_at: string;
  // Calculados en cliente
  importe_total?: number;
  importe_pagado?: number;
};

export type EscenarioTipo = 'conservador' | 'base' | 'optimista';

export type EscenarioFinanciero = {
  id: string;
  proyecto_id_ref: string;
  tipo_analisis: string;
  nombre: string;
  escenario: EscenarioTipo;
  parametros: Record<string, unknown>;
  resultado: Record<string, unknown>;
  es_activo: boolean;
  created_at: string;
  updated_at: string;
};

export type PresupuestoCapitulo = {
  id: string;
  presupuesto_id: string;
  nombre: string;
  orden: number;
  created_at: string;
  partidas?: PresupuestoPartida[];
};

export type RecurrenciaPartida = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export type PresupuestoPartida = {
  id: string;
  presupuesto_id: string;
  capitulo_id: string;
  codigo: string | null;
  descripcion: string;
  importe_presupuestado: number;
  tipo_iva: PagoTipoIva;
  proveedor_esperado: string | null;
  notas: string | null;
  recurrencia: RecurrenciaPartida | null;
  fecha_inicio_recurrencia: string | null;
  fecha_fin_recurrencia: string | null;
  created_at: string;
  updated_at: string;
  pagos?: PresupuestoPago[];
};

export type PagoTipoIva = 0 | 4 | 10 | 21;

export type PresupuestoPago = {
  id: string;
  presupuesto_id: string;
  partida_id: string;
  descripcion: string | null;
  importe: number;
  tipo_iva: PagoTipoIva;
  fecha_prevista: string;
  fecha_real_pago: string | null;
  estado: PagoEstado;
  tipo_flujo: PagoTipoFlujo;
  factura_recibida_id: string | null;
  factura_emitida_id: string | null;
  notas: string | null;
  created_at: string;
  partida_descripcion?: string;
  presupuesto_nombre?: string;
  proyecto_nombre?: string;
  sociedad_id_ref?: string | null;
};

// ── Módulo Proyectos ──────────────────────────────────────────

export type ProyectoEstadoKanban = 'activo' | 'pausado' | 'cerrado';
export type TareaColumna = 'backlog' | 'todo' | 'doing' | 'on_hold' | 'done';
export type TareaCategoria = 'general' | 'obra' | 'legal' | 'financiero';
export type TareaRecurrencia =
  | 'diaria'
  | 'semanal'
  | 'quincenal'
  | 'mensual'
  | 'trimestral'
  | 'anual';
export type KRUnidad = 'porcentaje' | 'euros' | 'numero' | 'fecha' | 'booleano';
export type ObjetivoEstado = 'activo' | 'completado' | 'cancelado';

export type ProyectoObjetivo = {
  id: string;
  proyecto_id: string;
  titulo: string;
  descripcion: string | null;
  fecha_objetivo: string | null;
  estado: ObjetivoEstado;
  orden: number;
  created_at: string;
  krs?: ProyectoKR[];
};

export type ProyectoKR = {
  id: string;
  objetivo_id: string;
  proyecto_id: string;
  titulo: string;
  unidad: KRUnidad;
  valor_objetivo: number | null;
  valor_actual: number;
  completado: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

export type ProyectoTarea = {
  id: string;
  proyecto_id: string;
  titulo: string;
  descripcion: string | null;
  columna: TareaColumna;
  categoria: TareaCategoria;
  fecha_limite: string | null;
  recurrencia: TareaRecurrencia | null;
  orden: number;
  created_at: string;
  updated_at: string;
};

// ── Métricas por Proyecto ─────────────────────────────────────────────────────

export type TipoAnalisisExtendido =
  | 'compra_venta'
  | 'renta'
  | 'alternativo'
  | 'explotacion'
  | 'prestamo'
  | 'capex_interno';

export type FuenteFlujo = 'flujo_manual' | 'presupuesto_pago' | 'factura_recibida';

export type FlujoProyectoConsolidado = {
  proyecto_id_ref: string;
  fecha: string;
  importe: number;
  tipo_flujo: string;
  concepto: string | null;
  fuente: FuenteFlujo;
  sociedad_id_ref: string | null;
  factura_id: string | null;
  presupuesto_pago_id: string | null;
  estado: string | null;
  es_real: boolean;
  es_previsto: boolean;
};

export type MetricasProyectoResumen = {
  proyecto_id_ref: string;
  sociedad_id_ref: string | null;
  tipo_analisis: TipoAnalisisExtendido | null;
  inversion_total_proyectada: number | null;
  gasto_real_acumulado: number | null;
  ingreso_real_acumulado: number | null;
  saldo_neto_real: number | null;
  presupuesto_total_aprobado: number | null;
  presupuesto_pagado: number | null;
  presupuesto_pendiente: number | null;
  desviacion_presupuesto_importe: number | null;
  desviacion_presupuesto_pct: number | null;
  facturas_pendientes_importe: number | null;
  facturas_pagadas_importe: number | null;
  flujos_manuales_importe: number | null;
  ultimo_movimiento_fecha: string | null;
};
