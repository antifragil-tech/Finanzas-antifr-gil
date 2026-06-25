import * as XLSX from 'xlsx';

export type BalanceLine = {
  cuenta: string;
  descripcion: string;
  debe: number;
  haber: number;
  saldo_deudor: number;
  saldo_acreedor: number;
};

export type DerivedKpis = {
  caja_disponible: number;
  deuda_bancaria_lp: number;
  deuda_bancaria_cp: number;
  deuda_bancaria: number;
  deuda_socios: number;
  deuda_financiera_neta: number;
  patrimonio_neto: number;
  activo_corriente: number;
  activo_no_corriente: number;
  activo_total: number;
  pasivo_corriente: number;
  pasivo_no_corriente: number;
  pasivo_total: number;
  fondo_maniobra: number;
};

export type BalanceParseResult = {
  lines: BalanceLine[];
  kpis: DerivedKpis;
  sheetUsed: string;
};

// ── Parseo numérico ───────────────────────────────────────────────────────────

function parseNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s/g, '');
    if (!s || s === '-' || s === '—') return 0;
    if (s.includes(',') && s.includes('.')) {
      return s.lastIndexOf(',') > s.lastIndexOf('.')
        ? parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
        : parseFloat(s.replace(/,/g, '')) || 0;
    }
    if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0;
    return parseFloat(s.replace(/,/g, '')) || 0;
  }
  return 0;
}

// ── Normalización ─────────────────────────────────────────────────────────────

function norm(v: unknown): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ── Detección de columnas ─────────────────────────────────────────────────────

type ColMap = {
  cuenta: number;
  desc: number;
  debe: number;
  haber: number;
  saldo_deudor: number;
  saldo_acreedor: number;
  saldo_final: number;   // columna única con saldo positivo/negativo (ej. A3/Sage ES)
};

function detectHeader(rows: unknown[][]): { rowIdx: number; cols: ColMap } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = (rows[i] ?? []).map(norm);

    // Acepta: 'cuenta', 'subcuenta', 'cta', 'cod', 'codigo'
    const cuentaIdx = cells.findIndex(c =>
      c === 'cuenta' || c === 'subcuenta' || c === 'cta' || c === 'cod' ||
      c === 'codigo' || c.startsWith('cta.') || c.startsWith('cod.') ||
      c.includes('subcuenta')
    );
    if (cuentaIdx < 0) continue;

    const descIdx = cells.findIndex(c =>
      c.includes('desc') || c.includes('denominac') || c === 'nombre' ||
      c === 'titulo' || c === 'title'
    );

    // Debe/Haber: acepta 'importe debe', 'mov. debe', 'debe', etc.
    const debeIdx = cells.findIndex(c =>
      c === 'debe' || (c.includes('debe') && !c.includes('saldo'))
    );
    const haberIdx = cells.findIndex(c =>
      c === 'haber' || (c.includes('haber') && !c.includes('saldo'))
    );

    // Saldo Deudor / Saldo Acreedor (formato estándar con dos columnas)
    const sdIdx = cells.findIndex(c =>
      c.includes('deudor') || c === 'sd' || c === 's.deudor'
    );
    const saIdx = cells.findIndex(c =>
      c.includes('acreedor') || c === 'sa' || c === 's.acreedor'
    );

    // Saldo único positivo/negativo (formato A3/Sage ES: última columna 'Saldo')
    // Solo se usa si NO hay columnas separadas de deudor/acreedor
    const saldoFinalIdx = (sdIdx < 0 && saIdx < 0)
      ? cells.findIndex(c =>
          c === 'saldo' ||
          (c.includes('saldo') && !c.includes('inicial') && !c.includes('anterior') &&
           !c.includes('deudor') && !c.includes('acreedor'))
        )
      : -1;

    // Necesita al menos: cuenta + (debe/haber ó saldo deudor/acreedor ó saldo único)
    const hasNumbers = debeIdx >= 0 || sdIdx >= 0 || saldoFinalIdx >= 0;
    if (!hasNumbers) continue;

    return {
      rowIdx: i,
      cols: {
        cuenta:         cuentaIdx,
        desc:           descIdx >= 0 ? descIdx : -1,
        debe:           debeIdx >= 0 ? debeIdx : -1,
        haber:          haberIdx >= 0 ? haberIdx : -1,
        saldo_deudor:   sdIdx >= 0 ? sdIdx : -1,
        saldo_acreedor: saIdx >= 0 ? saIdx : -1,
        saldo_final:    saldoFinalIdx >= 0 ? saldoFinalIdx : -1,
      },
    };
  }
  return null;
}

// ── Validación de fila de cuenta ─────────────────────────────────────────────

function isAccountRow(row: unknown[], cuentaCol: number): boolean {
  const val = String(row[cuentaCol] ?? '').trim().replace(/\.$/, '');
  if (/^\d{3,10}$/.test(val)) return true;
  // Formato punto: XXXX.NNNNNNN con parte decimal toda dígitos (p.ej. ContaPlus/ERP)
  // Excluye filas de resumen como "1000.      " (espacios tras el punto)
  return /^\d{3,4}\.\d+$/.test(val);
}

// ── Eliminación de filas de resumen (padres con hijos en el mismo archivo) ───
// Evita doble conteo cuando el archivo incluye tanto cuentas de 4 dígitos (resumen)
// como de 8 dígitos (detalle). Solo se conservan las cuentas hoja (sin hijos).

function filterLeaves(lines: BalanceLine[]): BalanceLine[] {
  const codes = new Set(lines.map(l => l.cuenta));
  return lines.filter(l =>
    !Array.from(codes).some(other => other !== l.cuenta && other.startsWith(l.cuenta))
  );
}

// ── Parser de respaldo anclado a datos ────────────────────────────────────────
// Para exports con celdas combinadas donde las columnas de datos NO coinciden con
// las etiquetas de cabecera (p.ej. Microsoft Dynamics NAV / Navision, donde la
// cuenta cae en la columna 0 aunque el rótulo "Cuenta" esté en otra). Se ancla a
// los DATOS, no a los rótulos:
//   · Columna de cuenta = la que más códigos de cuenta contiene.
//   · Columna de saldo  = la única columna numérica que cuadra a cero con signos
//     mixtos (un balance suma deudor = acreedor). Saldo con signo: positivo =
//     deudor, negativo = acreedor.
// Solo se invoca cuando el parser principal no encuentra ninguna línea, así que
// no altera el comportamiento de los formatos que ya funcionan.
function extractAnchoredLines(raw: unknown[][]): BalanceLine[] {
  const accountRe = /^\d{3,10}$/;
  const dottedRe  = /^\d{3,4}\.\d+$/;
  const isAcc = (v: unknown) => {
    const s = String(v ?? '').trim().replace(/\.$/, '');
    return accountRe.test(s) || dottedRe.test(s);
  };
  const maxCol = raw.reduce((m, r) => Math.max(m, r.length), 0);
  if (maxCol === 0) return [];

  // 1. Columna de cuenta: la que más códigos contiene
  let accCol = -1, accBest = 0;
  for (let c = 0; c < maxCol; c++) {
    let n = 0;
    for (const r of raw) if (isAcc(r[c])) n++;
    if (n > accBest) { accBest = n; accCol = c; }
  }
  if (accCol < 0 || accBest < 3) return [];

  const accRows = raw.filter(r => isAcc(r[accCol]));

  // 2. Columna de saldo: numérica, suma ≈ 0, con positivos y negativos
  let saldoCol = -1, bestScore = Infinity;
  for (let c = 0; c < maxCol; c++) {
    if (c === accCol) continue;
    let sum = 0, gross = 0, neg = 0, pos = 0, cnt = 0;
    for (const r of accRows) {
      const v = r[c];
      if (typeof v === 'number' && isFinite(v) && v !== 0) {
        sum += v; gross += Math.abs(v);
        if (v < 0) neg++; else pos++;
        cnt++;
      }
    }
    if (cnt >= 3 && neg >= 1 && pos >= 1 && gross > 0) {
      const score = Math.abs(sum) / gross;
      if (score < 0.05 && score < bestScore) { bestScore = score; saldoCol = c; }
    }
  }
  if (saldoCol < 0) return [];

  // 3. Construir líneas
  const lines: BalanceLine[] = [];
  for (const r of accRows) {
    const cuenta = String(r[accCol] ?? '').trim().replace(/\.$/, '');
    let descripcion = '';
    for (let c = 0; c < r.length; c++) {
      if (c === accCol) continue;
      const v = r[c];
      if (typeof v === 'string' && /[a-záéíóúñ]/i.test(v) && v.trim().length > 2) {
        descripcion = v.trim().replace(/^'/, '');
        break;
      }
    }
    const saldo = typeof r[saldoCol] === 'number' ? (r[saldoCol] as number) : 0;
    lines.push({
      cuenta,
      descripcion,
      debe: 0,
      haber: 0,
      saldo_deudor:   saldo > 0 ?  saldo : 0,
      saldo_acreedor: saldo < 0 ? -saldo : 0,
    });
  }
  return lines;
}

// ── Parser principal ──────────────────────────────────────────────────────────

export function parseSumasSaldos(buffer: ArrayBuffer): BalanceParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });

  // Intentar todas las hojas hasta encontrar una con cabecera detectable.
  // Primero se prueban las hojas con nombre relevante ('sumas', 'saldos', 'balance'),
  // luego el resto — necesario para formatos multi-hoja como ContaPlus/ERP donde
  // la hoja principal no tiene cabecera parseable pero hay una hoja "CSV" auxiliar.
  const orderedNames = [...wb.SheetNames].sort((a, b) => {
    const score = (n: string) => {
      const nn = norm(n);
      if (nn.includes('sumas') || nn.includes('saldos') || nn.includes('balance')) return 0;
      if (nn.includes('csv')) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  let sheetName = wb.SheetNames[0] ?? '';
  let raw: unknown[][] = [];
  let found: ReturnType<typeof detectHeader> = null;

  for (const name of orderedNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const candidate = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    const h = detectHeader(candidate);
    if (h) { sheetName = name; raw = candidate; found = h; break; }
  }

  let allLines: BalanceLine[] = [];

  // ── Parser principal: columnas ancladas a las etiquetas de cabecera ─────────
  if (found) {
    const { rowIdx, cols } = found;
    for (let i = rowIdx + 1; i < raw.length; i++) {
      const row = raw[i] ?? [];
      if (!isAccountRow(row, cols.cuenta)) continue;

      const cuenta      = String(row[cols.cuenta] ?? '').trim().replace(/\.$/, '');
      // Algunos exports Excel añaden ' inicial para evitar que la celda se interprete como fórmula
      const descripcion = cols.desc >= 0 ? String(row[cols.desc] ?? '').trim().replace(/^'/, '') : '';
      const debe        = cols.debe >= 0 ? parseNum(row[cols.debe]) : 0;
      const haber       = cols.haber >= 0 ? parseNum(row[cols.haber]) : 0;

      let saldo_deudor: number;
      let saldo_acreedor: number;

      if (cols.saldo_deudor >= 0 && cols.saldo_acreedor >= 0) {
        // Formato con columnas separadas (Saldo Deudor | Saldo Acreedor)
        saldo_deudor   = parseNum(row[cols.saldo_deudor]);
        saldo_acreedor = parseNum(row[cols.saldo_acreedor]);
      } else if (cols.saldo_final >= 0) {
        // Formato A3/Sage ES: una columna 'Saldo' con signo (positivo = deudor, negativo = acreedor)
        const saldo    = parseNum(row[cols.saldo_final]);
        saldo_deudor   = saldo > 0 ? saldo : 0;
        saldo_acreedor = saldo < 0 ? -saldo : 0;
      } else {
        // Fallback: derivar del movimiento debe/haber del período
        const net      = debe - haber;
        saldo_deudor   = net > 0 ? net : 0;
        saldo_acreedor = net < 0 ? -net : 0;
      }

      allLines.push({ cuenta, descripcion, debe, haber, saldo_deudor, saldo_acreedor });
    }
  }

  // ── Respaldo anclado a datos: para exports con columnas descolocadas ────────
  // (celdas combinadas tipo Navision/Dynamics NAV, donde el rótulo "Cuenta" no
  // está sobre los códigos). Solo si el parser principal no sacó nada.
  if (allLines.length === 0) {
    for (const name of orderedNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const candidate = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const anchored = extractAnchoredLines(candidate);
      if (anchored.length > 0) { allLines = anchored; sheetName = name; break; }
    }
  }

  if (allLines.length === 0) {
    throw new Error(
      'No se pudo leer el balance.\n' +
      'Asegúrate de exportar el Balance de Sumas y Saldos en Excel desde tu software contable,\n' +
      'con una columna de cuenta (códigos numéricos) y una de saldo (o Debe / Haber).'
    );
  }

  // Eliminar filas de resumen para evitar doble conteo
  const lines = filterLeaves(allLines);

  return { lines, kpis: deriveKpis(lines), sheetUsed: sheetName };
}

// ── Derivación de KPIs desde PGC ─────────────────────────────────────────────
// Exportada: además del flujo de import, el histórico de KPIs la usa para
// recalcular los KPIs de cualquier período guardado en balance_sumas_saldos.

export type KpiLine = Pick<BalanceLine, 'cuenta' | 'saldo_deudor' | 'saldo_acreedor'>;

export function deriveKpis(rows: KpiLine[]): DerivedKpis {
  const pre = (prefixes: string[]) =>
    rows.filter(r => prefixes.some(p => r.cuenta.startsWith(p)));

  const sumD = (rs: KpiLine[]) => rs.reduce((s, r) => s + r.saldo_deudor, 0);
  const sumA = (rs: KpiLine[]) => rs.reduce((s, r) => s + r.saldo_acreedor, 0);
  const netA = (rs: KpiLine[]) => rs.reduce((s, r) => s + (r.saldo_acreedor - r.saldo_deudor), 0);

  // Tesorería: 57x
  const caja_disponible = sumD(pre(['570', '571', '572', '573', '574', '575', '576']));

  // Deuda bancaria LP: solo 170x (Deudas con entidades de crédito LP)
  // 171-177 son deuda financiera genérica, leasing, proveedores inmovilizado LP, etc. → van al pasivo_no_corriente pero no son "bancarias"
  const deuda_bancaria_lp = sumA(pre(['170']));

  // Deuda bancaria CP: solo entidades de crédito (520x) e intereses bancarios (527x)
  // 523 = Proveedores inmovilizado CP, 524 = Leasing CP, 525-526 = otros → NO son bancarias
  const deuda_bancaria_cp = sumA(pre(['520', '527']));
  const deuda_bancaria    = deuda_bancaria_lp + deuda_bancaria_cp;

  // Deuda con socios y partes vinculadas (en Alsari, las vinculadas también son
  // socios, p.ej. Construcciones Maygar en Perisur):
  //   · Corto plazo: titular y cuentas corrientes con socios/vinculadas (550-553)
  //   · Largo plazo: deudas con partes vinculadas (subgrupo 16) y préstamos de
  //     socios (171 — p.ej. la 1710 de Perisur: Iván, Javier y Maygar)
  // NO incluye la 555 (partidas pendientes de aplicación, no es deuda de socios)
  // ni la 170 (deuda bancaria, ya contada en deuda_bancaria_lp).
  const deuda_socios =
    sumA(pre(['550', '551', '552', '553'])) +
    sumA(pre(['16'])) +
    sumA(pre(['171']));

  const deuda_financiera_neta = deuda_bancaria - caja_disponible;

  // Patrimonio neto: grupos 10-13 (saldo neto acreedor) + resultado del período
  // El grupo 14 (provisiones LP) NO es PN, va a pasivo no corriente.
  // Durante el año, la 12900000 no está cerrada: hay que sumar 7xx ingresos - 6xx gastos.
  const pn_balance = netA(pre(['10', '11', '12', '13']));
  const resultado_periodo =
    rows.filter(r => /^7/.test(r.cuenta)).reduce((s, r) => s + r.saldo_acreedor, 0) -
    rows.filter(r => /^6/.test(r.cuenta)).reduce((s, r) => s + r.saldo_deudor, 0);
  const patrimonio_neto = pn_balance + resultado_periodo;

  // Activo no corriente: grupo 2 — suma con SIGNO para netear amortización acumulada (28x)
  // y deterioros (29x) que tienen saldo acreedor y reducen el valor contable neto.
  const activo_no_corriente = rows
    .filter(r => /^2/.test(r.cuenta))
    .reduce((s, r) => s + r.saldo_deudor - r.saldo_acreedor, 0);

  // Activo corriente: grupos 3, 4, 5 — posición deudora (Max evita que pasivos del grupo
  // 4-5 aporten negativamente; los deterioros de existencias 39x se netean correctamente)
  const activo_corriente = rows
    .filter(r => /^[345]/.test(r.cuenta))
    .reduce((s, r) => s + Math.max(0, r.saldo_deudor - r.saldo_acreedor), 0);

  const activo_total = activo_no_corriente + activo_corriente;

  // Pasivo no corriente: 14x (provisiones), 15x, 16x, 17x, 18x (posición acreedora neta)
  const pasivo_no_corriente = rows
    .filter(r => /^1[45678]/.test(r.cuenta))
    .reduce((s, r) => s + Math.max(0, r.saldo_acreedor - r.saldo_deudor), 0);

  // Pasivo corriente: grupos 4, 5 excepto 57x (posición acreedora neta)
  const pasivo_corriente = rows
    .filter(r => /^[45]/.test(r.cuenta) && !r.cuenta.startsWith('57'))
    .reduce((s, r) => s + Math.max(0, r.saldo_acreedor - r.saldo_deudor), 0);

  const pasivo_total   = pasivo_no_corriente + pasivo_corriente;
  const fondo_maniobra = activo_corriente - pasivo_corriente;

  return {
    caja_disponible,
    deuda_bancaria_lp,
    deuda_bancaria_cp,
    deuda_bancaria,
    deuda_socios,
    deuda_financiera_neta,
    patrimonio_neto,
    activo_corriente,
    activo_no_corriente,
    activo_total,
    pasivo_corriente,
    pasivo_no_corriente,
    pasivo_total,
    fondo_maniobra,
  };
}
