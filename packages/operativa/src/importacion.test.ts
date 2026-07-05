import { describe, expect, it } from 'vitest';
import { escaleraMargen, estadoValidacion } from './finanzas';
import {
  importarFacturasEmitidas,
  importarFacturasRecibidas,
  importarGastos,
  importarIngresos,
  mapearColumnas,
  normalizarFecha,
  normalizarImporte,
  parseCsv,
  plantillaCsv,
} from './importacion';

describe('importación segura Excel/CSV', () => {
  it('normaliza fechas dd/mm/yyyy e importes con coma española', () => {
    expect(normalizarFecha('5/7/2026')).toBe('2026-07-05');
    expect(normalizarFecha('05-07-26')).toBe('2026-07-05');
    expect(normalizarImporte('1.234,56')).toBe(1234.56);
    expect(normalizarImporte('45 €')).toBe(45);
    expect(normalizarImporte('no-numero')).toBeNull();
  });

  it('mapea columnas por sinónimos y acentos (Método de pago → metodo_pago)', () => {
    const m = mapearColumnas(
      ['Fecha', 'CLIENTE', 'Servicio', 'Tipo', 'Ingreso', 'Método de pago'],
      'ingresos',
    );
    expect(m.mapa['Método de pago']).toBe('metodo_pago');
    expect(m.mapa['Ingreso']).toBe('importe_devengado');
    expect(m.faltantes).toEqual([]);
  });

  it('una columna desconocida NO rompe: se reporta como desconocida', () => {
    const filas = parseCsv(
      'fecha;cliente;servicio;tipo_ingreso;importe_devengado;columna_rara\n05/07/2026;Cliente Demo 01;fisio;suelta;45;xyz\n',
    );
    const r = importarIngresos(filas);
    expect(r.entidades).toHaveLength(1);
    expect(r.errores).toEqual([]);
    expect(r.desconocidos.some((d) => d.includes('columna_rara'))).toBe(true);
  });

  it('un concepto desconocido pasa a pendiente_confirmacion sin romper', () => {
    const r = importarGastos(
      parseCsv('fecha;concepto;categoria;importe\n05/07/2026;Cosa rara GEA;gea_mensual;100\n'),
    );
    expect(r.entidades[0]?.tipo).toBe('concepto_provisional');
    expect(r.entidades[0]?.pendienteConfirmacion).toBe(true);
    expect(r.desconocidos.some((d) => d.startsWith('categoria:'))).toBe(true);
  });

  it('un gasto importado sin documento queda bloqueado para validación de pago', () => {
    const r = importarGastos(
      parseCsv(
        'fecha;concepto;categoria;importe;documento_recibido\n05/07/2026;Suministros;suministros;180;no\n',
      ),
    );
    const g = r.entidades[0];
    expect(g).toBeDefined();
    if (g) expect(estadoValidacion(g)).toBe('bloqueado_sin_documento');
  });

  it('factura recibida importada no implica pago; emitida no implica cobro', () => {
    const fr = importarFacturasRecibidas(
      parseCsv(
        'fecha_emision;proveedor;concepto;total;estado\n05/07/2026;Proveedor Demo;Luz;180;recibida\n',
      ),
    );
    expect(fr.entidades[0]?.estado).toBe('recibida'); // no pagada
    const fe = importarFacturasEmitidas(
      parseCsv(
        'fecha;cliente_partner;origen;total;estado\n05/07/2026;Vivofácil;partner;540;emitida_operativa\n',
      ),
    );
    expect(fe.entidades[0]?.estado).toBe('emitida_operativa'); // no cobrada
  });

  it('las plantillas CSV se reimportan limpias (round-trip demo)', () => {
    const ing = importarIngresos(parseCsv(plantillaCsv('ingresos')));
    expect(ing.errores).toEqual([]);
    expect(ing.entidades).toHaveLength(1);
    const gas = importarGastos(parseCsv(plantillaCsv('gastos')));
    expect(gas.errores).toEqual([]);
    expect(gas.entidades[0]?.tipo).toBe('alquiler');
  });

  it('un import demo alimenta la escalera M1→M3 igual que el motor', () => {
    const ingresos = importarIngresos(
      parseCsv(
        'fecha;cliente;servicio;tipo_ingreso;importe_devengado;importe_cobrado\n01/07/2026;Cliente Demo 01;fisio;suelta;45;45\n02/07/2026;Cliente Demo 02;fisio;bono;45;0\n',
      ),
    ).entidades;
    const gastos = importarGastos(
      parseCsv(
        'fecha;concepto;categoria;capa_imputacion;importe;documento_recibido\n01/07/2026;30 ses;coste_por_sesion;directo;30;si\n01/07/2026;Alquiler;alquiler;fijo;40;si\n',
      ),
    ).entidades;
    const e = escaleraMargen(ingresos, gastos);
    expect(e.ingresoDevengado).toBe(90);
    expect(e.m1).toBe(60);
    expect(e.m3).toBe(20);
    expect(e.provisional).toBe(false);
  });
});
