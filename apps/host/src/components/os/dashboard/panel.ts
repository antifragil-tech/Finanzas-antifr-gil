import { formatCurrency } from '@alsari/utils';
import { PROFESIONALES, redondear, type IngresoOperativo } from '@antifragil/operativa';
import { desplazarMes, etiquetaMesCorta } from '@/lib/datos/periodo';
import { totalesCxc, type CuentaPorCobrar, type GastoReal } from '@/lib/datos/fuenteDatos';

// Derivaciones PURAS del Panel (sin fetch, sin env): reciben los datos ya
// cargados —reales o demo— y calculan las cifras héroe, la tendencia y los
// avisos. Server-safe; se importa solo desde el server component del Panel.

export interface PanelResumen {
  mes: string;
  /** Ingresos devengados del mes − gastos de la clínica del mes (sin proyectos). */
  resultado: number;
  /** Ingreso devengado del mes. */
  facturado: number;
  /** Cobrado (caja) del mes. Sin saldos de cuentas, es el cobro del periodo. */
  caja: number;
  /** CxC pendiente + partners (AFDH…) devengados sin cobrar. */
  pendienteCobrar: number;
  nIngresos: number;
  ticketMedio: number;
  gastosClinica: number;
  /** Gastos de proyectos externos del mes (segregados, no computan). */
  gastosProyectos: number;
  nProyectosGastos: number;
}

/** Resumen del mes activo a partir de los datos ya segregados clínica/proyectos. */
export function resumirPanel(
  ingresos: IngresoOperativo[],
  gastosClinica: GastoReal[],
  gastosProyectos: GastoReal[],
  cxc: CuentaPorCobrar[],
  mes: string,
): PanelResumen {
  const ingMes = ingresos.filter((i) => i.fecha.startsWith(mes));
  const gcMes = gastosClinica.filter((g) => g.fecha.startsWith(mes));
  const gpMes = gastosProyectos.filter((g) => g.fecha.startsWith(mes));

  const facturado = redondear(ingMes.reduce((s, i) => s + i.importeDevengado, 0));
  const caja = redondear(ingMes.reduce((s, i) => s + i.importeCobrado, 0));
  const gastosClinicaMes = redondear(gcMes.reduce((s, g) => s + g.importe, 0));
  const gastosProyectosMes = redondear(gpMes.reduce((s, g) => s + g.importe, 0));

  // Deuda a favor de la clínica: CxC pendiente + partners devengados sin cobrar
  // (p. ej. AFDH, que se cobra trimestralmente pero devenga cada mes).
  const partnersPendiente = redondear(
    ingMes
      .filter((i) => i.origen === 'partner')
      .reduce((s, i) => s + Math.max(0, i.importeDevengado - i.importeCobrado), 0),
  );

  const nIngresos = ingMes.length;

  return {
    mes,
    resultado: redondear(facturado - gastosClinicaMes),
    facturado,
    caja,
    pendienteCobrar: redondear(totalesCxc(cxc).pendiente + partnersPendiente),
    nIngresos,
    ticketMedio: nIngresos > 0 ? redondear(facturado / nIngresos) : 0,
    gastosClinica: gastosClinicaMes,
    gastosProyectos: gastosProyectosMes,
    nProyectosGastos: gpMes.length,
  };
}

export interface PuntoMes {
  mes: string;
  etiqueta: string;
  ingresos: number;
  gastos: number;
}

/** Serie de los últimos n meses (ingresos devengados vs gastos de la clínica). */
export function serieMensual(
  ingresos: IngresoOperativo[],
  gastosClinica: GastoReal[],
  mesRef: string,
  n = 6,
): PuntoMes[] {
  const puntos: PuntoMes[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const mes = desplazarMes(mesRef, -k);
    puntos.push({
      mes,
      etiqueta: etiquetaMesCorta(mes),
      ingresos: redondear(
        ingresos.filter((i) => i.fecha.startsWith(mes)).reduce((s, i) => s + i.importeDevengado, 0),
      ),
      gastos: redondear(
        gastosClinica.filter((g) => g.fecha.startsWith(mes)).reduce((s, g) => s + g.importe, 0),
      ),
    });
  }
  return puntos;
}

export type AvisoTono = 'atencion' | 'problema' | 'info';

export interface Aviso {
  id: string;
  texto: string;
  tono: AvisoTono;
}

/**
 * Avisos REALES derivados de los datos: IVA aplicado por error a servicios
 * exentos, relaciones/reglas de profesionales sin regularizar (bloquean la
 * liquidación) y deuda de terceros por proyectos externos. Nada se oculta.
 */
export function avisosRequierenAtencion(
  ingresos: IngresoOperativo[],
  cxc: CuentaPorCobrar[],
): Aviso[] {
  const avisos: Aviso[] = [];

  const conIva = ingresos.filter((i) => i.concepto.includes('⚠ IVA'));
  if (conIva.length > 0) {
    avisos.push({
      id: 'iva',
      tono: 'atencion',
      texto: `${conIva.length} línea${conIva.length === 1 ? '' : 's'} de ingreso con IVA 21% aplicado por error — servicios sanitarios exentos, regularizar con gestoría.`,
    });
  }

  for (const p of PROFESIONALES) {
    if (p.relacion === 'pendiente_regularizar') {
      avisos.push({
        id: `prof-${p.id}`,
        tono: 'problema',
        texto: `${p.nombre}: relación pendiente de regularizar — su liquidación queda bloqueada hasta cerrarla.`,
      });
    } else if (p.reglas.some((r) => !r.confirmada)) {
      avisos.push({
        id: `prof-${p.id}`,
        tono: 'atencion',
        texto: `${p.nombre}: regla de liquidación sin confirmar — no avanza sin validación de dirección.`,
      });
    }
  }

  const deudaProyectos = new Map<string, number>();
  for (const c of cxc) {
    if (c.proyectoIdRef && c.estado === 'pendiente') {
      deudaProyectos.set(c.deudor, (deudaProyectos.get(c.deudor) ?? 0) + c.importe);
    }
  }
  for (const [deudor, importe] of deudaProyectos) {
    avisos.push({
      id: `cxc-${deudor}`,
      tono: 'info',
      texto: `${deudor} debe ${formatCurrency(redondear(importe))} de proyectos externos (fuera de la operativa de la clínica).`,
    });
  }

  return avisos;
}
