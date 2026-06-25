import type { CategoriaMovimiento, MovimientoCsvRaw, MovimientoBancario, ReglaCategorizacion } from '@alsari/types';

// ── Entidades del grupo Alsari (para detección intragrupo) ────────────────────
// Se actualiza manualmente cuando se añaden nuevas sociedades al holding.

const ENTIDADES_GRUPO = [
  'alsari', 'pavier', 'armia', 'rialsa', 'inversiones sl',
  'legacy group', 'capital os',
];

// ── Reglas hard-coded de alta prioridad (no dependen de DB) ──────────────────
// Se aplican antes que las reglas de base de datos.

type ReglaLocal = {
  test: (concepto: string) => boolean;
  categoria: CategoriaMovimiento;
  subcategoria: string | null;
  es_intragrupo: boolean;
  prioridad: number;
};

const REGLAS_LOCALES: ReglaLocal[] = [
  // Intragrupo — detección por nombre de entidad del grupo
  {
    test: (c) => ENTIDADES_GRUPO.some(e => c.toLowerCase().includes(e)),
    categoria: 'intragrupo_salida',
    subcategoria: null,
    es_intragrupo: true,
    prioridad: 200,
  },
  // Ampliación de capital
  {
    test: (c) => /ampliaci[oó]n.*capital|capital.*ampliaci/i.test(c),
    categoria: 'intragrupo_salida',
    subcategoria: 'ampliacion_capital',
    es_intragrupo: true,
    prioridad: 195,
  },
  // Retrocesiones (par cargo/abono — no cambiar a intragrupo)
  {
    test: (c) => /retrocesi[oó]n/i.test(c),
    categoria: 'devoluciones',
    subcategoria: 'retrocesion',
    es_intragrupo: false,
    prioridad: 190,
  },
  // Fiscal — Junta autonómica (ITP, AJD, otros)
  {
    test: (c) => /junta de (andaluc|castilla|cataluñ|madrid|galicia|aragon|murcia|navarra|rioja|balear|canaria|astur|cantabr|extrem|valenci)/i.test(c),
    categoria: 'fiscal',
    subcategoria: 'itp_ajd',
    es_intragrupo: false,
    prioridad: 185,
  },
  // Fiscal — retenciones IRPF
  {
    test: (c) => /retenci[oó]n.*irpf|irpf.*retenci[oó]n|retenciones.*ing|ggee/i.test(c),
    categoria: 'fiscal',
    subcategoria: 'retenciones_irpf',
    es_intragrupo: false,
    prioridad: 183,
  },
  // Fiscal — IBI
  {
    test: (c) => /\bibi\b/i.test(c),
    categoria: 'fiscal',
    subcategoria: 'ibi',
    es_intragrupo: false,
    prioridad: 183,
  },
  // Fiscal — impuestos genéricos
  {
    test: (c) => /hacienda|aeat|\bimpuesto\b/i.test(c),
    categoria: 'fiscal',
    subcategoria: 'otros',
    es_intragrupo: false,
    prioridad: 180,
  },
  // Notaría / legal
  {
    test: (c) => /notari|protocolo|inscripci[oó]n|compraventa|escritura/i.test(c),
    categoria: 'notaria_legal',
    subcategoria: 'provision_fondos',
    es_intragrupo: false,
    prioridad: 175,
  },
  // Fianzas / rentas cobradas
  {
    test: (c) => /\bfianza\b/i.test(c),
    categoria: 'rentas_cobradas',
    subcategoria: 'fianza_recibida',
    es_intragrupo: false,
    prioridad: 170,
  },
  {
    test: (c) => /\balquiler\b/i.test(c),
    categoria: 'rentas_cobradas',
    subcategoria: 'alquiler_residencial',
    es_intragrupo: false,
    prioridad: 168,
  },
  // Comunidad de propietarios
  {
    test: (c) => /c\.p\.|comunidad.*propiet|comunidad.*vecin/i.test(c),
    categoria: 'gastos_inmobiliarios',
    subcategoria: 'comunidad',
    es_intragrupo: false,
    prioridad: 165,
  },
  // Gastos inmobiliarios — mantenimiento
  {
    test: (c) => /mantenimiento|reparaci[oó]n|obra\b/i.test(c),
    categoria: 'gastos_inmobiliarios',
    subcategoria: 'mantenimiento',
    es_intragrupo: false,
    prioridad: 160,
  },
  // Comisiones y gastos bancarios
  {
    test: (c) => /custodia|derechos.*custodia|comisi[oó]n.*banco|mantenimiento.*cuenta/i.test(c),
    categoria: 'bancarios',
    subcategoria: 'custodia',
    es_intragrupo: false,
    prioridad: 155,
  },
];

// ── Resultado de categorización ───────────────────────────────────────────────

export type ResultadoCategorizacion = {
  categoria: CategoriaMovimiento;
  subcategoria: string | null;
  es_intragrupo: boolean;
  confianza: 'alta' | 'media' | 'baja';
  regla_id?: string;
};

// ── Motor principal ───────────────────────────────────────────────────────────

export function categorizar(
  concepto: string,
  reglasDb: ReglaCategorizacion[] = [],
): ResultadoCategorizacion {
  const c = concepto.toLowerCase();

  // 1. Reglas hard-coded (máxima prioridad)
  const reglaLocal = REGLAS_LOCALES
    .sort((a, b) => b.prioridad - a.prioridad)
    .find(r => r.test(c));

  if (reglaLocal) {
    return {
      categoria: reglaLocal.categoria,
      subcategoria: reglaLocal.subcategoria,
      es_intragrupo: reglaLocal.es_intragrupo,
      confianza: 'alta',
    };
  }

  // 2. Reglas de base de datos (ordenadas por prioridad descendente)
  for (const regla of reglasDb.sort((a, b) => b.prioridad - a.prioridad)) {
    if (!regla.activa) continue;
    let match: boolean;
    if (regla.es_regex) {
      try { match = new RegExp(regla.patron, 'i').test(c); } catch { match = false; }
    } else {
      match = c.includes(regla.patron.toLowerCase());
    }
    if (match) {
      return {
        categoria: regla.categoria,
        subcategoria: regla.subcategoria,
        es_intragrupo: regla.es_intragrupo,
        confianza: regla.fuente === 'aprendizaje' ? 'alta' : regla.fuente === 'usuario' ? 'alta' : 'media',
        regla_id: regla.id,
      };
    }
  }

  // 3. Sin match → extraordinario
  return {
    categoria: 'extraordinario',
    subcategoria: 'no_clasificado',
    es_intragrupo: false,
    confianza: 'baja',
  };
}

// ── Normalización de concepto ─────────────────────────────────────────────────

export function normalizarConcepto(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(ref|nro?|núm?|num|mandato|id|ref\.?)\s*[:.]\s*[\w\d-]+/gi, '') // elimina refs numéricas
    .replace(/\d{10,}/g, '')           // elimina números largos (cuentas, refs)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Extracción de contraparte ─────────────────────────────────────────────────

export function extraerContraparte(concepto: string): string | null {
  const c = concepto.trim();
  // "Transferencia [de/a] [Nombre]"
  const transf = /transferencia\s+(?:de|a favor de|inmediata a favor de)?\s*(.+?)(?:\s+concepto|\s+ref|\s+nro|$)/i.exec(c);
  if (transf?.[1]) return transf[1].trim();
  // "Recibo [Nombre]"
  const recibo = /recibo\s+([a-zA-ZÀ-ÿ][^\d]{3,}?)(?:\s+nº|\s+ref|\s+mandato|$)/i.exec(c);
  if (recibo?.[1]) return recibo[1].trim();
  // "Pago [a] [Nombre]"
  const pago = /pago\s+(?:puntual\s+)?(?:a\s+)?([a-zA-ZÀ-ÿ][^\d]{3,}?)(?:\s+concepto|\s+ref|$)/i.exec(c);
  if (pago?.[1]) return pago[1].trim();
  return null;
}

// ── Enriquecer movimiento ─────────────────────────────────────────────────────

export function enriquecerMovimiento(
  raw: MovimientoCsvRaw,
  sociedad_id_ref: string,
  iban: string,
  banco: string,
  fuente: string,
  reglasDb: ReglaCategorizacion[] = [],
): Omit<MovimientoBancario, 'id' | 'importado_at' | 'created_at'> {
  const resultado = categorizar(raw.concepto, reglasDb);
  const concepto_normalizado = normalizarConcepto(raw.concepto);
  const entidad_contraparte = extraerContraparte(raw.concepto);

  return {
    sociedad_id_ref,
    iban,
    banco: banco as MovimientoBancario['banco'],
    fecha: raw.fecha,
    fecha_valor: raw.fecha_valor ?? null,
    concepto: raw.concepto,
    concepto_normalizado,
    importe: raw.importe,
    saldo: raw.saldo ?? null,
    categoria: resultado.categoria,
    subcategoria: resultado.subcategoria,
    es_intragrupo: resultado.es_intragrupo,
    entidad_contraparte,
    proyecto_id_ref: null,
    factura_recibida_id: null,
    asiento_borrador_id: null,
    revisado: resultado.confianza === 'alta',
    notas: null,
    fuente,
    // PR F: el orquestador de importación rellena hash y cuenta_bancaria_id;
    // extracto_id lo asigna la RPC. referencia/tipo vienen del parser si existen.
    extracto_id: null,
    hash: null,
    referencia: raw.referencia ?? null,
    tipo_movimiento: raw.tipo_movimiento ?? null,
    cuenta_bancaria_id: null,
  };
}
