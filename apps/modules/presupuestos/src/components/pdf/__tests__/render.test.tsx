import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InformeFinancieroProyecto } from '../InformeFinancieroProyecto';
import { construirInforme } from '../../../lib/exportProyectoFinanciero';
import type { AnalisisFinanciero } from '../../../lib/analisisFinanciero';
import type { ProyectoRow } from '../../../lib/proyectosApi';

// Smoke test: el informe debe renderizarse a un PDF válido sin lanzar.
// Si se define PDF_PREVIEW_DIR, además escribe los PDF a disco para inspección
// visual (Villa el Chorro y Ciudad Rialsa) — no se ejecuta en CI.

const renta = (over: Partial<AnalisisFinanciero>): AnalisisFinanciero => ({
  proyecto_id: 'test',
  tipo_analisis: 'renta',
  ...over,
});

const proyecto = (nombre: string): ProyectoRow =>
  ({
    nombre,
    sociedad_tenedora: 'S-001',
    fecha_inicio: null,
    fecha_prevista_salida: null,
  }) as unknown as ProyectoRow;

const casos = [
  {
    archivo: 'informe-villa-el-chorro.pdf',
    informe: construirInforme(
      renta({
        precio_adquisicion: 491000,
        renta_mensual_bruta: 79380 / 12,
        tasa_ocupacion_prevista_pct: 100,
        valoracion_actual: 1000000,
      }),
      proyecto('Villa el Chorro'),
    ),
  },
  {
    archivo: 'informe-ciudad-rialsa.pdf',
    informe: construirInforme(
      renta({
        precio_adquisicion: 799682,
        renta_mensual_bruta: 141750 / 12,
        tasa_ocupacion_prevista_pct: 100,
        valoracion_actual: 1500000,
      }),
      proyecto('Ciudad Rialsa'),
    ),
  },
];

describe('InformeFinancieroProyecto — render a PDF', () => {
  for (const c of casos) {
    it(`genera un PDF válido (${c.archivo})`, async () => {
      const el = createElement(InformeFinancieroProyecto, { informe: c.informe });
      const buffer = await renderToBuffer(el as unknown as Parameters<typeof renderToBuffer>[0]);
      expect(buffer.length).toBeGreaterThan(2000);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');

      const dir = process.env.PDF_PREVIEW_DIR;
      if (dir) {
        const { writeFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        writeFileSync(join(dir, c.archivo), buffer);
      }
    }, 30000);
  }
});
