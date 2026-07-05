import type { BancoOrigen, MovimientoCsvRaw } from '@alsari/types';

// ── Utilidades comunes ────────────────────────────────────────────────────────

function parseImporte(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
    return parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s.replace(',', '.')) || 0;
}

function parseDate(raw: string): string {
  raw = raw.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mdy) return `${mdy[3]}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`;
  return raw;
}

function parseCsvLines(csv: string): string[][] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (!inQuote && (ch === ';' || ch === ',')) {
        cols.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function detectSeparator(csv: string): ';' | ',' {
  const firstLine = csv.split(/\r?\n/)[0] ?? '';
  return firstLine.split(';').length >= firstLine.split(',').length ? ';' : ',';
}

// ── Santander ─────────────────────────────────────────────────────────────────

export function parseSantander(csv: string): MovimientoCsvRaw[] {
  const sep = detectSeparator(csv);
  const lines = parseCsvLines(csv.replace(/\t/g, sep));
  const results: MovimientoCsvRaw[] = [];

  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = lines[i]!;
    if (row.some((c) => /fecha/i.test(c))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const row = lines[i]!;
    if (!row[0] || !row[2]) continue;
    const fechaRaw = row[0]!;
    if (!/\d/.test(fechaRaw)) continue;
    const item: MovimientoCsvRaw = {
      fecha: parseDate(fechaRaw),
      concepto: (row[2] ?? '').trim(),
      importe: parseImporte(row[3] ?? '0'),
      ...(row[1] ? { fecha_valor: parseDate(row[1]) } : {}),
      ...(row[4] ? { saldo: parseImporte(row[4]) } : {}),
    };
    if (item.concepto && !isNaN(item.importe)) results.push(item);
  }
  return results;
}

// ── BBVA ──────────────────────────────────────────────────────────────────────

export function parseBBVA(csv: string): MovimientoCsvRaw[] {
  const lines = parseCsvLines(csv);
  const results: MovimientoCsvRaw[] = [];

  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = lines[i]!;
    if (row.some((c) => /fecha|date/i.test(c))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const row = lines[i]!;
    if (!row[0] || !row[2]) continue;
    const fechaRaw = row[0]!.trim();
    if (!/\d/.test(fechaRaw)) continue;
    const item: MovimientoCsvRaw = {
      fecha: parseDate(fechaRaw),
      concepto: (row[2] ?? '').trim(),
      importe: parseImporte(row[3] ?? '0'),
      ...(row[1] ? { fecha_valor: parseDate(row[1]) } : {}),
      ...(row[4] ? { saldo: parseImporte(row[4]) } : {}),
    };
    if (item.concepto && !isNaN(item.importe)) results.push(item);
  }
  return results;
}

// ── CaixaBank ─────────────────────────────────────────────────────────────────

export function parseCaixaBank(csv: string): MovimientoCsvRaw[] {
  const lines = parseCsvLines(csv);
  const results: MovimientoCsvRaw[] = [];

  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const row = lines[i]!;
    if (row.some((c) => /fecha/i.test(c)) && row.some((c) => /concepto|descripci/i.test(c))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const row = lines[i]!;
    if (!row[0]) continue;
    const fechaRaw = row[0]!.trim();
    if (!/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(fechaRaw)) continue;
    const item: MovimientoCsvRaw = {
      fecha: parseDate(fechaRaw),
      concepto: (row[1] ?? '').trim(),
      importe: parseImporte(row[2] ?? '0'),
      ...(row[3] ? { saldo: parseImporte(row[3]) } : {}),
    };
    if (item.concepto && !isNaN(item.importe)) results.push(item);
  }
  return results;
}

// ── Caja Rural ────────────────────────────────────────────────────────────────

export function parseCajaRural(csv: string): MovimientoCsvRaw[] {
  return parseCaixaBank(csv);
}

// ── Parser genérico ───────────────────────────────────────────────────────────

export function parseGenerico(csv: string): MovimientoCsvRaw[] {
  const lines = parseCsvLines(csv);
  if (lines.length < 2) return [];

  let headerIdx = -1;
  let colFecha = -1,
    colConcepto = -1,
    colImporte = -1,
    colSaldo = -1,
    colFechaValor = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const row = lines[i]!.map((c) => c.toLowerCase());
    const fIdx = row.findIndex((c) => c.includes('fecha') && !c.includes('valor'));
    const fvIdx = row.findIndex((c) => c.includes('fecha') && c.includes('valor'));
    const cIdx = row.findIndex(
      (c) => c.includes('concepto') || c.includes('descripci') || c.includes('detail'),
    );
    const iIdx = row.findIndex(
      (c) => c.includes('importe') || c === 'amount' || c === 'cargo/abono',
    );
    const sIdx = row.findIndex((c) => c.includes('saldo') || c === 'balance');
    if (fIdx >= 0 && cIdx >= 0 && iIdx >= 0) {
      headerIdx = i;
      colFecha = fIdx;
      colFechaValor = fvIdx >= 0 ? fvIdx : -1;
      colConcepto = cIdx;
      colImporte = iIdx;
      colSaldo = sIdx >= 0 ? sIdx : -1;
      break;
    }
  }

  if (headerIdx < 0) return [];

  const results: MovimientoCsvRaw[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i]!;
    const fechaRaw = row[colFecha]?.trim() ?? '';
    if (!fechaRaw || !/\d/.test(fechaRaw)) continue;
    const item: MovimientoCsvRaw = {
      fecha: parseDate(fechaRaw),
      concepto: (row[colConcepto] ?? '').trim(),
      importe: parseImporte(row[colImporte] ?? '0'),
      ...(colFechaValor >= 0 && row[colFechaValor]
        ? { fecha_valor: parseDate(row[colFechaValor]!) }
        : {}),
      ...(colSaldo >= 0 && row[colSaldo] ? { saldo: parseImporte(row[colSaldo]!) } : {}),
    };
    if (item.concepto && !isNaN(item.importe)) results.push(item);
  }
  return results;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function parsearExtracto(csv: string, banco: BancoOrigen): MovimientoCsvRaw[] {
  switch (banco) {
    case 'santander':
      return parseSantander(csv);
    case 'bbva':
      return parseBBVA(csv);
    case 'caixabank':
      return parseCaixaBank(csv);
    case 'caja_rural':
      return parseCajaRural(csv);
    default:
      return parseGenerico(csv);
  }
}
