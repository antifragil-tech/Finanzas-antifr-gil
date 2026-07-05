import { describe, it, expect } from 'vitest';
import type { ProveedorRegla, FacturaRecibida, FacturaPago } from '@alsari/types';
import {
  seleccionarRegla,
  analizarRegla,
  reglaDesdeFactura,
  estadoOperativoFactura,
  tieneSugerenciasPendientes,
} from '../proveedorReglas';

// ── Factories mínimas ─────────────────────────────────────────────────────────
function mkRegla(p: Partial<ProveedorRegla> = {}): ProveedorRegla {
  return {
    id: p.id ?? 'r1',
    contacto_id: 'c1',
    nif_normalizado: null,
    sociedad_id_ref: null,
    cuenta_contable_default: null,
    proyecto_id_ref: null,
    presupuesto_id: null,
    partida_id: null,
    metodo_pago_default: null,
    es_domiciliada: false,
    requiere_pago_manual: false,
    requiere_aprobacion_javi: false,
    requiere_factura: true,
    requiere_justificante_pago: true,
    tipo_operacion_default: null,
    iva_default: null,
    retencion_pct_default: null,
    importe_habitual: null,
    tolerancia_importe_pct: null,
    concepto_recurrente: null,
    auto_validar: false,
    activa: true,
    notas: null,
    created_at: '2026-06-23',
    updated_at: '2026-06-23',
    ...p,
  };
}
function mkFactura(p: Partial<FacturaRecibida> = {}): FacturaRecibida {
  return {
    id: 'f1',
    sociedad_id_ref: 'S-001',
    sociedad_validada: true,
    numero_factura: '1',
    proveedor_nombre: 'Prov',
    proveedor_nif: 'B-93626158',
    fecha_factura: '2026-06-15',
    fecha_vencimiento: null,
    base_imponible: 100,
    tipo_iva: 21,
    cuota_iva: 21,
    retencion_pct: 0,
    retencion_importe: 0,
    total: 121,
    total_a_pagar: 121,
    concepto: null,
    categoria: null,
    subcategoria: null,
    proyecto_id_ref: null,
    estado: 'pendiente_pago',
    movimiento_id: null,
    cuenta_gasto: null,
    tipo_operacion: 'normal',
    receptor_nombre_ocr: null,
    receptor_nif_ocr: null,
    contacto_id: 'c1',
    ocr_raw: null,
    ocr_confianza: null,
    presupuesto_pago_id: null,
    storage_path: null,
    archivo_url: null,
    drive_file_id: null,
    drive_folder_id: null,
    drive_estado: 'no_archivado',
    drive_error: null,
    drive_web_link: null,
    drive_synced_at: null,
    es_domiciliada: false,
    regla_aplicada_id: null,
    notas: null,
    created_at: '2026-06-15',
    updated_at: '2026-06-15',
    ...p,
  };
}
function mkPago(p: Partial<FacturaPago> = {}): FacturaPago {
  return {
    id: 'p1',
    factura_id: 'f1',
    importe: 121,
    fecha_pago: '2026-06-20',
    metodo_pago: 'domiciliacion',
    tipo_pago: 'total',
    justificante_storage_path: null,
    justificante_nombre_archivo: null,
    justificante_mime_type: null,
    justificante_size: null,
    comentario: null,
    registrado_por_email: null,
    registrado_por_rol: null,
    drive_file_id: null,
    drive_estado: 'no_archivado',
    drive_error: null,
    drive_web_link: null,
    drive_synced_at: null,
    created_at: '2026-06-20',
    updated_at: '2026-06-20',
    ...p,
  };
}

describe('seleccionarRegla', () => {
  const global = mkRegla({ id: 'g', sociedad_id_ref: null });
  const espS1 = mkRegla({ id: 's1', sociedad_id_ref: 'S-001' });
  const espS2 = mkRegla({ id: 's2', sociedad_id_ref: 'S-002' });

  it('sociedad validada: específica tiene prioridad sobre global', () => {
    expect(seleccionarRegla([global, espS1, espS2], 'c1', 'S-001', true)?.id).toBe('s1');
  });
  it('sociedad validada sin específica: cae a global', () => {
    expect(seleccionarRegla([global, espS2], 'c1', 'S-001', true)?.id).toBe('g');
  });
  it('sociedad pendiente: solo global aunque exista específica', () => {
    expect(seleccionarRegla([global, espS1], 'c1', 'S-001', false)?.id).toBe('g');
    expect(seleccionarRegla([espS1], 'c1', 'S-001', false)).toBeNull();
  });
  it('sin contacto → null; sin reglas activas → null', () => {
    expect(seleccionarRegla([global], null, 'S-001', true)).toBeNull();
    expect(seleccionarRegla([mkRegla({ activa: false })], 'c1', 'S-001', true)).toBeNull();
  });
  it('ignora reglas de otro contacto', () => {
    expect(
      seleccionarRegla([mkRegla({ id: 'x', contacto_id: 'otro' })], 'c1', 'S-001', true),
    ).toBeNull();
  });
});

describe('analizarRegla', () => {
  it('propone campos no aplicados y marca los que ya coinciden', () => {
    const regla = mkRegla({
      cuenta_contable_default: '628',
      iva_default: 10,
      concepto_recurrente: 'Suministro',
    });
    const f = mkFactura({ cuenta_gasto: '628', tipo_iva: 21, concepto: null });
    const a = analizarRegla(regla, f);
    const cuenta = a.sugerencias.find((s) => s.campo === 'cuenta_gasto')!;
    const iva = a.sugerencias.find((s) => s.campo === 'tipo_iva')!;
    expect(cuenta.yaAplicado).toBe(true); // 628 == 628
    expect(iva.yaAplicado).toBe(false); // 21 != 10
    expect(a.sugerencias.find((s) => s.campo === 'concepto')!.valor).toBe('Suministro');
  });
  it('es_domiciliada solo se sugiere si la regla la marca', () => {
    expect(
      analizarRegla(mkRegla({ es_domiciliada: false }), mkFactura()).sugerencias.find(
        (s) => s.campo === 'es_domiciliada',
      ),
    ).toBeUndefined();
    expect(
      analizarRegla(mkRegla({ es_domiciliada: true }), mkFactura()).sugerencias.find(
        (s) => s.campo === 'es_domiciliada',
      )?.valor,
    ).toBe(true);
  });
  it('alerta de importe solo con base + tolerancia, y solo si se sale del rango', () => {
    const regla = mkRegla({ importe_habitual: 500, tolerancia_importe_pct: 15 });
    expect(analizarRegla(regla, mkFactura({ total: 900 })).importeFueraRango?.desviacionPct).toBe(
      80,
    );
    expect(analizarRegla(regla, mkFactura({ total: 520 })).importeFueraRango).toBeNull(); // 4% < 15%
  });
  it('sin base o sin tolerancia → no alerta', () => {
    expect(
      analizarRegla(mkRegla({ importe_habitual: 500 }), mkFactura({ total: 9999 }))
        .importeFueraRango,
    ).toBeNull();
    expect(
      analizarRegla(mkRegla({ tolerancia_importe_pct: 15 }), mkFactura({ total: 9999 }))
        .importeFueraRango,
    ).toBeNull();
  });
  it('expone flags requiereJavi, domiciliada, partida y método', () => {
    const regla = mkRegla({
      requiere_aprobacion_javi: true,
      es_domiciliada: true,
      partida_id: 'pa1',
      presupuesto_id: 'pr1',
      metodo_pago_default: 'domiciliacion',
    });
    const a = analizarRegla(regla, mkFactura());
    expect(a.requiereJavi).toBe(true);
    expect(a.domiciliada).toBe(true);
    expect(a.partidaSugerida).toEqual({ presupuesto_id: 'pr1', partida_id: 'pa1' });
    expect(a.metodoPagoDefault).toBe('domiciliacion');
  });
  it('tieneSugerenciasPendientes detecta sugerencias por aplicar', () => {
    expect(
      tieneSugerenciasPendientes(
        analizarRegla(
          mkRegla({ cuenta_contable_default: '628' }),
          mkFactura({ cuenta_gasto: '628' }),
        ),
      ),
    ).toBe(false);
    expect(
      tieneSugerenciasPendientes(
        analizarRegla(
          mkRegla({ cuenta_contable_default: '628' }),
          mkFactura({ cuenta_gasto: null }),
        ),
      ),
    ).toBe(true);
  });
});

describe('reglaDesdeFactura', () => {
  it('fija la sociedad solo si está validada y normaliza el NIF', () => {
    const r = reglaDesdeFactura(
      mkFactura({ sociedad_validada: true, sociedad_id_ref: 'S-001' }),
      'c1',
    );
    expect(r.sociedad_id_ref).toBe('S-001');
    expect(r.nif_normalizado).toBe('B93626158');
    expect(r.importe_habitual).toBe(121);
  });
  it('sociedad pendiente → regla global (sociedad null)', () => {
    expect(
      reglaDesdeFactura(mkFactura({ sociedad_validada: false, sociedad_id_ref: null }), 'c1')
        .sociedad_id_ref,
    ).toBeNull();
  });
});

describe('estadoOperativoFactura', () => {
  it('no domiciliada → null', () => {
    expect(estadoOperativoFactura(mkFactura({ es_domiciliada: false }), [])).toBeNull();
  });
  it('domiciliada pagada → pagada', () => {
    expect(estadoOperativoFactura(mkFactura({ es_domiciliada: true, estado: 'pagada' }), [])).toBe(
      'pagada',
    );
  });
  it('domiciliada pendiente_pago sin pagos → pendiente_cargo', () => {
    expect(
      estadoOperativoFactura(mkFactura({ es_domiciliada: true, estado: 'pendiente_pago' }), []),
    ).toBe('pendiente_cargo');
  });
  it('domiciliada con pago sin justificante → cargada_sin_justificante', () => {
    const pagos = [mkPago({ justificante_storage_path: null })];
    expect(
      estadoOperativoFactura(mkFactura({ es_domiciliada: true, estado: 'pendiente_pago' }), pagos),
    ).toBe('cargada_sin_justificante');
  });
  it('domiciliada en borrador → null (aún no aplica)', () => {
    expect(
      estadoOperativoFactura(mkFactura({ es_domiciliada: true, estado: 'borrador_ocr' }), []),
    ).toBeNull();
  });
});
