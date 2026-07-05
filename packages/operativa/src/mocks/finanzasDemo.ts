/**
 * Escenario financiero demo del mes MES_DEMO: ingresos, gastos y facturas
 * enlazados con liquidaciones y cobros. Todo ficticio; los conceptos sin
 * criterio confirmado van marcados pendienteConfirmacion (UG/PM de Marta,
 * GEA, AFDH, formaciones de Solís) — no rompen cálculos, marcan provisional.
 */

import type {
  FacturaEmitidaOperativa,
  FacturaRecibida,
  GastoOperativo,
  IngresoOperativo,
} from '../finanzas';
import { hechosDemo, MES_DEMO, VENTAS_DEMO } from './escenario';

// ---------------------------------------------------------------------------
// Ingresos operativos del mes (desde el escenario compartido)
// ---------------------------------------------------------------------------

export function ingresosDemo(): IngresoOperativo[] {
  const hechos = hechosDemo();
  const ingresos: IngresoOperativo[] = hechos.map((h) => ({
    id: `ing-${h.sesionId}`,
    origen: h.tipoVenta,
    concepto: `Sesión ${h.servicio}`,
    fecha: h.fecha,
    centroId: h.centroId,
    canalId: h.canalId,
    importeDevengado: h.ingresoDevengado,
    // Demo: las sueltas se cobran en el acto; el devengo de bono ya se cobró
    // con la venta del bono (no se vuelve a contar aquí: anti-doble-conteo).
    importeCobrado: h.tipoVenta === 'suelta' ? h.ingresoDevengado : 0,
    ...(h.tipoVenta === 'suelta' ? { facturaEmitidaId: `fe-sesion-${h.sesionId}` } : {}),
  }));

  // Partner Vivofácil: cierre mensual agrupado (B2B) — devengado, aún sin cobrar.
  ingresos.push({
    id: 'ing-partner-vivofacil',
    origen: 'partner',
    concepto: 'Cierre mensual Vivofácil (12 sesiones × 45 €)',
    fecha: `${MES_DEMO}-22`,
    centroId: 'centro-playamar',
    canalId: 'canal-vivofacil',
    importeDevengado: 540,
    importeCobrado: 0,
    facturaEmitidaId: 'fe-partner-vivofacil',
  });

  return ingresos;
}

// ---------------------------------------------------------------------------
// Gastos del mes por taxonomía (importes redondos, ficticios)
// ---------------------------------------------------------------------------

const doc = (
  tipo: GastoOperativo['documento']['tipo'],
  recibido: boolean,
  referencia?: string,
): GastoOperativo['documento'] => ({ tipo, recibido, ...(referencia ? { referencia } : {}) });

export const GASTOS_DEMO: GastoOperativo[] = [
  // B) nóminas y costes laborales
  {
    id: 'g-nomina-moreno',
    tipo: 'nomina_fija',
    concepto: 'Nómina María Moreno (importe demo)',
    fecha: `${MES_DEMO}-28`,
    importe: 1400,
    capa: 'fijo',
    documento: doc('nomina', true, 'NOM-DEMO-07'),
    profesionalId: 'prof-maria-moreno',
  },
  {
    id: 'g-ss',
    tipo: 'seguridad_social',
    concepto: 'Seguridad Social (SST + SSE)',
    fecha: `${MES_DEMO}-28`,
    importe: 340,
    capa: 'fijo',
    documento: doc('no_requerido', true),
  },
  {
    id: 'g-irpf',
    tipo: 'irpf_retenciones',
    concepto: 'Retenciones IRPF (recordatorio documental)',
    fecha: `${MES_DEMO}-28`,
    importe: 260,
    capa: 'fijo',
    documento: doc('no_requerido', true),
  },
  {
    id: 'g-lidia',
    tipo: 'coste_compartido',
    concepto: 'Recepción Lidia — parte fija Antifrágil (resto Lidomare)',
    fecha: `${MES_DEMO}-28`,
    importe: 400,
    capa: 'compartido',
    documento: doc('nomina', true, 'NOM-DEMO-08'),
    profesionalId: 'prof-lidia',
  },
  // C) gastos de clínica
  {
    id: 'g-alquiler',
    tipo: 'alquiler',
    concepto: 'Alquiler Clínica Playamar',
    fecha: `${MES_DEMO}-01`,
    importe: 1200,
    capa: 'fijo',
    documento: doc('factura_recibida', true, 'FR-DEMO-101'),
    centroId: 'centro-playamar',
  },
  {
    id: 'g-suministros',
    tipo: 'suministros',
    concepto: 'Luz y agua',
    fecha: `${MES_DEMO}-10`,
    importe: 180,
    capa: 'fijo',
    documento: doc('factura_recibida', false),
    centroId: 'centro-playamar',
  },
  {
    id: 'g-software',
    tipo: 'software',
    concepto: 'Software de gestión',
    fecha: `${MES_DEMO}-05`,
    importe: 90,
    capa: 'fijo',
    documento: doc('factura_recibida', true, 'FR-DEMO-102'),
  },
  {
    id: 'g-gestoria',
    tipo: 'gestoria',
    concepto: 'Gestoría',
    fecha: `${MES_DEMO}-05`,
    importe: 120,
    capa: 'general',
    documento: doc('factura_recibida', true, 'FR-DEMO-103'),
  },
  {
    id: 'g-tpv',
    tipo: 'tpv_comisiones',
    concepto: 'Comisiones datáfono (~1,5% de cobros con tarjeta)',
    fecha: `${MES_DEMO}-30`,
    importe: 45,
    capa: 'directo',
    documento: doc('no_requerido', true),
  },
  {
    id: 'g-material',
    tipo: 'material',
    concepto: 'Material de sesión',
    fecha: `${MES_DEMO}-12`,
    importe: 150,
    capa: 'directo',
    documento: doc('ticket', true, 'TCK-DEMO-11'),
  },
  {
    id: 'g-marketing',
    tipo: 'marketing',
    concepto: 'Campaña local',
    fecha: `${MES_DEMO}-15`,
    importe: 100,
    capa: 'general',
    documento: doc('factura_recibida', false),
  },
  {
    id: 'g-extra',
    tipo: 'gasto_extra',
    concepto: 'Gastos varios',
    fecha: `${MES_DEMO}-18`,
    importe: 60,
    capa: 'general',
    documento: doc('ticket', true),
  },
  // D) amortizables (fuera del M3 mensual; se muestran aparte)
  {
    id: 'g-equipamiento',
    tipo: 'equipamiento',
    concepto: 'Camilla eléctrica (inversión)',
    fecha: `${MES_DEMO}-08`,
    importe: 2000,
    capa: 'amortizable',
    documento: doc('factura_recibida', true, 'FR-DEMO-104'),
  },
  // Conceptos PENDIENTES DE CONFIRMACIÓN — no rompen, marcan provisional.
  {
    id: 'g-formacion-solis',
    tipo: 'formacion_profesional',
    concepto: 'Formaciones María Solís (importe pendiente de confirmar)',
    fecha: `${MES_DEMO}-30`,
    importe: 0,
    capa: 'directo',
    documento: doc('factura_recibida', false),
    profesionalId: 'prof-maria-solis',
    pendienteConfirmacion: true,
    nota: 'Aparece en el Excel de pagos como "Nº de Formaciones"; tarifa sin confirmar.',
  },
  {
    id: 'g-gea',
    tipo: 'concepto_provisional',
    concepto: 'GEA (concepto del Excel, significado pendiente de confirmar)',
    fecha: `${MES_DEMO}-30`,
    importe: 0,
    capa: 'general',
    documento: doc('no_requerido', true),
    pendienteConfirmacion: true,
  },
  {
    id: 'g-afdh',
    tipo: 'concepto_provisional',
    concepto: 'AFDH (concepto del Excel, significado pendiente de confirmar)',
    fecha: `${MES_DEMO}-30`,
    importe: 0,
    capa: 'general',
    documento: doc('no_requerido', true),
    pendienteConfirmacion: true,
  },
];

/**
 * Coste profesional variable como gastos (desde el escenario compartido):
 * Solís/Cecilia/Carlos por sesión, Marta sueltas + plan. La regla UG/PM 45 €
 * de Marta queda PENDIENTE de confirmar: NO sustituye a la general de 35 €.
 */
export function gastosProfesionalesDemo(): GastoOperativo[] {
  const hechos = hechosDemo();
  const porProfesional = new Map<string, { sesiones: number; importe: number }>();
  for (const h of hechos) {
    const acc = porProfesional.get(h.profesionalId) ?? { sesiones: 0, importe: 0 };
    acc.sesiones += 1;
    acc.importe += h.costeProfesional;
    porProfesional.set(h.profesionalId, acc);
  }
  const gastos: GastoOperativo[] = [...porProfesional.entries()].map(([profId, acc]) => ({
    id: `g-var-${profId}`,
    tipo: 'coste_por_sesion',
    concepto: `${acc.sesiones} sesiones validadas`,
    fecha: `${MES_DEMO}-30`,
    importe: acc.importe,
    capa: 'directo',
    // El pago del variable exige factura de autónomo (R2): solo Solís la entregó.
    documento:
      profId === 'prof-maria-solis'
        ? doc('factura_recibida', true, 'FAC-DEMO-2026-031')
        : doc('factura_recibida', false),
    profesionalId: profId,
  }));
  gastos.push({
    id: 'g-var-marta-plan',
    tipo: 'coste_por_cliente_plan',
    concepto: '3 clientes activos en plan × 30 €/mes (regla sin confirmar)',
    fecha: `${MES_DEMO}-30`,
    importe: 90,
    capa: 'directo',
    documento: doc('factura_recibida', false),
    profesionalId: 'prof-marta',
    pendienteConfirmacion: true,
    nota: 'Regla UG/PM a 45 € detectada en Excel: pendiente de confirmar, NO aplicada.',
  });
  return gastos;
}

export function gastosDemo(): GastoOperativo[] {
  return [...gastosProfesionalesDemo(), ...GASTOS_DEMO];
}

// ---------------------------------------------------------------------------
// Facturas emitidas operativas / recibidas
// ---------------------------------------------------------------------------

export function facturasEmitidasDemo(): FacturaEmitidaOperativa[] {
  const facturas: FacturaEmitidaOperativa[] = VENTAS_DEMO.map((v, i) => ({
    id: `fe-bono-${v.id}`,
    serie: 'OPS',
    numero: 100 + i,
    origenTipo: 'bono',
    origenId: v.id,
    contraparte: v.clienteId,
    fecha: v.fechaVenta,
    importe: v.importeCobrado,
    estado: 'cobrada',
  }));
  facturas.push(
    {
      id: 'fe-partner-vivofacil',
      serie: 'OPS',
      numero: 110,
      origenTipo: 'partner',
      origenId: 'cierre-vivofacil-07',
      contraparte: 'Vivofácil',
      fecha: `${MES_DEMO}-22`,
      importe: 540,
      estado: 'emitida_operativa',
    },
    {
      id: 'fe-sesion-demo-borrador',
      serie: 'OPS',
      numero: 111,
      origenTipo: 'sesion',
      origenId: 'prof-marta-2026-07-1',
      contraparte: 'cliente-demo-02',
      fecha: `${MES_DEMO}-21`,
      importe: 45,
      estado: 'borrador',
    },
    {
      id: 'fe-sesion-oficial-pendiente',
      serie: 'OPS',
      numero: 112,
      origenTipo: 'sesion',
      origenId: 'prof-maria-solis-2026-07-20',
      contraparte: 'cliente-demo-07',
      fecha: `${MES_DEMO}-20`,
      importe: 45,
      estado: 'pendiente_documento_oficial',
    },
  );
  return facturas;
}

export function facturasRecibidasDemo(): FacturaRecibida[] {
  return [
    {
      id: 'fr-solis',
      contraparte: 'María Solís (autónoma)',
      tipo: 'autonomo',
      fecha: `${MES_DEMO}-30`,
      importe: 1200,
      estado: 'validada',
      gastoId: 'g-var-prof-maria-solis',
      liquidacionRef: `prof-maria-solis-${MES_DEMO}`,
    },
    {
      id: 'fr-cecilia',
      contraparte: 'Cecilia (autónoma)',
      tipo: 'autonomo',
      fecha: `${MES_DEMO}-30`,
      importe: 440,
      estado: 'pendiente_recibir',
      gastoId: 'g-var-prof-cecilia',
      liquidacionRef: `prof-cecilia-${MES_DEMO}`,
    },
    {
      id: 'fr-alquiler',
      contraparte: 'Arrendador Playamar',
      tipo: 'gasto_clinica',
      fecha: `${MES_DEMO}-01`,
      importe: 1200,
      estado: 'pagada',
      gastoId: 'g-alquiler',
    },
    {
      id: 'fr-suministros',
      contraparte: 'Compañía eléctrica',
      tipo: 'gasto_clinica',
      fecha: `${MES_DEMO}-10`,
      importe: 180,
      estado: 'pendiente_recibir',
      gastoId: 'g-suministros',
    },
    {
      id: 'fr-equipamiento',
      contraparte: 'Proveedor equipamiento',
      tipo: 'proveedor',
      fecha: `${MES_DEMO}-08`,
      importe: 2000,
      estado: 'pendiente_pago',
      gastoId: 'g-equipamiento',
    },
  ];
}

/** Conceptos abiertos que Fernando debe confirmar (visibles en UI). */
export const CONCEPTOS_PENDIENTES: { clave: string; descripcion: string }[] = [
  {
    clave: 'marta_ug_pm',
    descripcion: 'Sesiones UG/PM de Marta a 45 € (el doc dice 35 €/suelta): ¿cuál aplica?',
  },
  { clave: 'formaciones_solis', descripcion: 'Formaciones de María Solís: ¿tarifa por formación?' },
  { clave: 'gea', descripcion: 'GEA: entidad/concepto del cash flow sin definir en el OS.' },
  { clave: 'afdh', descripcion: 'AFDH: línea de ingresos del Excel sin definir en el OS.' },
];
