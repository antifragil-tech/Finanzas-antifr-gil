import { describe, expect, it } from 'vitest';
import { escaleraMargen, estadoValidacion } from './finanzas';
import {
  importarEfectivo,
  importarExtractoBanco,
  importarFacturasEmitidas,
  importarFacturasRecibidas,
  importarFacturasSalonized,
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

  it('un export tipo Salonized (cabeceras en inglés) se mapea a ingresos', () => {
    const r = importarIngresos(
      parseCsv(
        'Date,Customer,Treatment,Employee,Total,Payment method\n05/07/2026,Cliente Demo 03,Fisioterapia,Profesional Demo 01,"45,00",Card\n',
      ),
    );
    expect(r.avisos.filter((a) => a.includes('tipo_ingreso'))).toHaveLength(1); // Salonized no trae tipo
    expect(r.entidades).toHaveLength(1);
    expect(r.entidades[0]?.importeDevengado).toBe(45);
    expect(r.entidades[0]?.concepto).toContain('Cliente Demo 03');
  });

  it('facturas_salonized: mapea cabeceras EN, separa datáfono vs efectivo y avisa sin nº factura', () => {
    const r = importarFacturasSalonized(
      parseCsv(
        'Invoice number,Date,Customer,Treatment,Total,Payment method\n' +
          'INV-001,05/07/2026,Cliente Demo 01,Fisioterapia,"45,00",Card\n' +
          'INV-002,05/07/2026,Cliente Demo 02,Nutrición,"55,00",Cash\n' +
          'INV-003,06/07/2026,Cliente Demo 03,Fisioterapia,"45,00",Datáfono\n' +
          ',06/07/2026,Cliente Demo 04,Fisioterapia,"45,00",\n',
      ),
    );
    expect(r.errores).toEqual([]);
    expect(r.entidades).toHaveLength(4);
    expect(r.entidades[0]?.numeroFactura).toBe('INV-001');
    expect(r.entidades[0]?.metodoPago).toBe('tarjeta'); // Card → tarjeta (datáfono)
    expect(r.entidades[1]?.metodoPago).toBe('efectivo'); // Cash → efectivo
    expect(r.entidades[2]?.metodoPago).toBe('tarjeta'); // Datáfono → tarjeta
    expect(r.entidades[3]?.metodoPago).toBeNull(); // sin método → sin cobro
    expect(r.avisos.some((a) => a.includes('sin nº de factura'))).toBe(true);
  });

  it('facturas_salonized: fila sin fecha o importe es error y no entra', () => {
    const r = importarFacturasSalonized(
      parseCsv(
        'numero_factura;fecha;cliente;importe\nINV-9;;Cliente;45\nINV-10;05/07/2026;Cliente;no-num\n',
      ),
    );
    expect(r.entidades).toHaveLength(0);
    expect(r.errores).toHaveLength(2);
  });

  it('efectivo: importa el formato acordado (fecha;hora;importe;nota) con BOM y duplicados legítimos', () => {
    const r = importarEfectivo(
      parseCsv(
        '﻿fecha;hora;importe;nota\n' +
          '2026-05-28;20:27;45;\n' +
          '2026-05-27;13:27;45;\n' +
          '2026-05-27;13:27;45;segundo pago misma hora\n' +
          '2026-05-22;09:09;225;bono 5 sesiones\n',
      ),
    );
    expect(r.errores).toEqual([]);
    expect(r.entidades).toHaveLength(4);
    expect(r.entidades[0]).toMatchObject({
      fecha: '2026-05-28',
      hora: '20:27',
      importe: 45,
      nota: '',
    });
    expect(r.entidades[2]?.nota).toBe('segundo pago misma hora');
    expect(r.entidades[3]?.importe).toBe(225);
  });

  it('efectivo: importe 0 o fecha inválida son error legible por fila', () => {
    const r = importarEfectivo(
      parseCsv('fecha;hora;importe;nota\n2026-05-28;10:00;0;\nayer;10:00;45;\n'),
    );
    expect(r.entidades).toHaveLength(0);
    expect(r.errores).toHaveLength(2);
    expect(r.errores[0]).toContain('fila 2');
  });

  it('extracto_banco: importes CON SIGNO en formato español y saldo opcional', () => {
    const r = importarExtractoBanco(
      parseCsv(
        'Fecha operación;Concepto;Importe;Saldo\n' +
          '05/07/2026;TRANSFERENCIA PROVEEDOR DEMO;-1.234,56;10.000,00\n' +
          '06/07/2026;ABONO TPV DATAFONO;345,10;10.345,10\n',
      ),
    );
    expect(r.errores).toEqual([]);
    expect(r.entidades).toHaveLength(2);
    expect(r.entidades[0]?.importe).toBe(-1234.56); // negativo = pago saliente
    expect(r.entidades[0]?.saldo).toBe(10000);
    expect(r.entidades[1]?.importe).toBe(345.1);
  });

  it('extracto_banco: beneficiario vale como concepto y la fila sin concepto avisa sin romper', () => {
    const r = importarExtractoBanco(
      parseCsv(
        'fecha;beneficiario;importe\n05/07/2026;GESTORIA DEMO SL;-108,90\n06/07/2026;;-50\n',
      ),
    );
    expect(r.errores).toEqual([]);
    expect(r.entidades[0]?.concepto).toBe('GESTORIA DEMO SL');
    expect(r.entidades[1]?.concepto).toBe('movimiento sin concepto');
    expect(r.avisos.some((a) => a.includes('sin concepto'))).toBe(true);
  });

  it('las plantillas CSV nuevas se reimportan limpias (round-trip demo)', () => {
    const sal = importarFacturasSalonized(parseCsv(plantillaCsv('facturas_salonized')));
    expect(sal.errores).toEqual([]);
    expect(sal.entidades[0]?.metodoPago).toBe('tarjeta');
    const efe = importarEfectivo(parseCsv(plantillaCsv('efectivo')));
    expect(efe.errores).toEqual([]);
    expect(efe.entidades[0]?.importe).toBe(45);
    const ban = importarExtractoBanco(parseCsv(plantillaCsv('extracto_banco')));
    expect(ban.errores).toEqual([]);
    expect(ban.entidades[0]?.importe).toBe(-180);
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
