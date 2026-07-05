/**
 * Escenario demo compartido del MVP (definición de producto §9): la única
 * verdad mock que alimenta Liquidaciones, Rentabilidad y el Dashboard.
 * Todo ficticio: Cliente Demo NN, importes redondos, mes fijo de demo.
 */

import { devengoUnitario, redondear, resumenVenta } from '../devengo';
import { generarLiquidacion } from '../liquidaciones';
import { PROFESIONALES } from './profesionales';
import type {
  EventoSesionBono,
  HechoSesion,
  LiquidacionMensual,
  ResumenVentaBono,
  SesionLiquidable,
  VentaBono,
} from '../types';

export const MES_DEMO = '2026-07';

/** Perfil de actividad del mes por profesional: sesiones de bono y sueltas. */
const ACTIVIDAD: {
  profesionalId: string;
  servicio: string;
  deBono: number;
  sueltas: number;
  precioSuelta: number;
}[] = [
  {
    profesionalId: 'prof-maria-solis',
    servicio: 'fisioterapia',
    deBono: 15,
    sueltas: 25,
    precioSuelta: 45,
  },
  {
    profesionalId: 'prof-cecilia',
    servicio: 'fisioterapia',
    deBono: 10,
    sueltas: 12,
    precioSuelta: 45,
  },
  { profesionalId: 'prof-marta', servicio: 'nutricion', deBono: 0, sueltas: 10, precioSuelta: 45 },
  {
    profesionalId: 'prof-carlos',
    servicio: 'entrenamiento',
    deBono: 0,
    sueltas: 12,
    precioSuelta: 45,
  },
];

const DEVENGO_BONO = 45; // bono 225 € / 5 sesiones (ejemplo canónico doc 10)

const CENTROS_ROTACION = [
  'centro-playamar',
  'centro-playamar',
  'centro-playamar',
  'centro-lidomare',
  'centro-oasis',
];
const CANALES_ROTACION = [
  'canal-organico',
  'canal-recomendacion',
  'canal-vivofacil',
  'canal-organico',
  'canal-9am',
];

/** Días laborables del mes demo, para repartir sesiones de forma determinista. */
function diaLaborable(indice: number): string {
  const dia = 1 + ((indice * 2) % 22); // 1..22, siempre dentro del mes
  return `${MES_DEMO}-${String(dia).padStart(2, '0')}`;
}

/** Sesiones validadas del mes (lo que liquida el equipo). */
export function sesionesDemo(): SesionLiquidable[] {
  const sesiones: SesionLiquidable[] = [];
  for (const act of ACTIVIDAD) {
    const total = act.deBono + act.sueltas;
    for (let i = 0; i < total; i++) {
      sesiones.push({
        id: `${act.profesionalId}-${MES_DEMO}-${i + 1}`,
        fecha: diaLaborable(i),
        profesionalId: act.profesionalId,
        servicio: act.servicio,
        clienteId: `cliente-demo-${String((i % 24) + 1).padStart(2, '0')}`,
        estado: 'validada',
      });
    }
  }
  return sesiones;
}

/** Hechos económicos por sesión (vista devengo) — base de Rentabilidad. */
export function hechosDemo(): HechoSesion[] {
  const hechos: HechoSesion[] = [];
  for (const act of ACTIVIDAD) {
    const prof = PROFESIONALES.find((p) => p.id === act.profesionalId);
    const tarifa =
      prof?.reglas.find((r) => r.tipo === 'por_sesion' || r.tipo === 'pendiente_regularizar')
        ?.importe ?? 0;
    const total = act.deBono + act.sueltas;
    for (let i = 0; i < total; i++) {
      const esDeBono = i < act.deBono;
      hechos.push({
        sesionId: `${act.profesionalId}-${MES_DEMO}-${i + 1}`,
        fecha: diaLaborable(i),
        profesionalId: act.profesionalId,
        servicio: act.servicio,
        clienteId: `cliente-demo-${String((i % 24) + 1).padStart(2, '0')}`,
        centroId: CENTROS_ROTACION[i % CENTROS_ROTACION.length] ?? 'centro-playamar',
        canalId: CANALES_ROTACION[i % CANALES_ROTACION.length] ?? 'canal-organico',
        tipoVenta: esDeBono ? 'bono' : 'suelta',
        ingresoDevengado: esDeBono ? DEVENGO_BONO : act.precioSuelta,
        costeProfesional: tarifa,
        otrosCostesDirectos: 0,
      });
    }
  }
  return hechos;
}

/** Ventas de bono del escenario, en distintos puntos de su ciclo. */
export const VENTAS_DEMO: VentaBono[] = [
  {
    id: 'venta-demo-1',
    clienteId: 'cliente-demo-01',
    productoId: 'prod-bono-fisio-5',
    fechaVenta: `${MES_DEMO}-02`,
    importeCobrado: 225,
    unidades: 5,
    vencimiento: '2027-01-02',
    estado: 'parcialmente_consumido',
  },
  {
    id: 'venta-demo-2',
    clienteId: 'cliente-demo-05',
    productoId: 'prod-bono-fisio-5',
    fechaVenta: `${MES_DEMO}-03`,
    importeCobrado: 225,
    unidades: 5,
    vencimiento: '2027-01-03',
    estado: 'consumido',
  },
  {
    id: 'venta-demo-3',
    clienteId: 'cliente-demo-09',
    productoId: 'prod-bono-fisio-5',
    fechaVenta: `${MES_DEMO}-20`,
    importeCobrado: 225,
    unidades: 5,
    vencimiento: '2027-01-20',
    estado: 'activo',
  },
];

/** Consumos de esas ventas (disparan el devengo, doc 10 §6.1). */
export const EVENTOS_DEMO: EventoSesionBono[] = [
  ...[1, 2, 3].map((n) => ({
    ventaId: 'venta-demo-1',
    sesionId: `prof-maria-solis-${MES_DEMO}-${n}`,
    fecha: diaLaborable(n - 1),
    profesionalId: 'prof-maria-solis',
    tipo: 'consumida' as const,
  })),
  ...[4, 5, 6, 7, 8].map((n) => ({
    ventaId: 'venta-demo-2',
    sesionId: `prof-cecilia-${MES_DEMO}-${n}`,
    fecha: diaLaborable(n - 1),
    profesionalId: 'prof-cecilia',
    tipo: 'consumida' as const,
  })),
];

export function resumenesVentasDemo(): ResumenVentaBono[] {
  return VENTAS_DEMO.map((v) => resumenVenta(v, EVENTOS_DEMO));
}

/** Liquidaciones del mes demo, con estados variados para la pantalla. */
export function liquidacionesDemo(): LiquidacionMensual[] {
  const sesiones = sesionesDemo();
  return PROFESIONALES.map((prof) => {
    const liq = generarLiquidacion(prof, MES_DEMO, sesiones, {
      clientesActivosPlan: prof.id === 'prof-marta' ? 3 : 0,
    });
    // Estados de demo: Solís ya validada (CxP viva), el resto según cálculo.
    if (prof.id === 'prof-maria-solis') return { ...liq, estado: 'validada' as const };
    return liq;
  });
}

/** Totales de rentabilidad del mes demo (vista devengo + contraste caja). */
export function totalesDemo() {
  const hechos = hechosDemo();
  const resumenes = resumenesVentasDemo();
  const ingresoDevengado = redondear(hechos.reduce((s, h) => s + h.ingresoDevengado, 0));
  const costeProfesional = redondear(hechos.reduce((s, h) => s + h.costeProfesional, 0));
  const pendienteDeDevengar = redondear(resumenes.reduce((s, r) => s + r.pendienteDeDevengar, 0));
  const cobradoBonos = redondear(VENTAS_DEMO.reduce((s, v) => s + v.importeCobrado, 0));
  const cobradoSueltas = redondear(
    hechos.filter((h) => h.tipoVenta === 'suelta').reduce((s, h) => s + h.ingresoDevengado, 0),
  );
  return {
    ingresoDevengado,
    costeProfesional,
    margenBruto: redondear(ingresoDevengado - costeProfesional),
    pendienteDeDevengar,
    ingresoCobrado: redondear(cobradoBonos + cobradoSueltas),
    devengoUnitarioBono: devengoUnitario(VENTAS_DEMO[0] ?? { importeCobrado: 225, unidades: 5 }),
  };
}
