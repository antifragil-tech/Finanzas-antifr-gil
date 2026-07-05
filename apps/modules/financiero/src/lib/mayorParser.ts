export interface ParsedEntry {
  subcuenta: string;
  subcuentaNombre: string;
  asiento: number;
  fecha: string; // ISO date YYYY-MM-DD
  concepto: string;
  debe: number;
  haber: number;
}

export interface ParsedMayor {
  entityName: string;
  periodStart: string; // DD/MM/YYYY as in the file
  periodEnd: string;
  entries: ParsedEntry[];
  _debug: {
    totalRows: number;
    firstRows: (string | number | null)[][];
    detectedStartRow: number;
    colOffset: number;
  };
}

// Returns true if a cell value is "empty" in the accounting-header sense:
// null, empty string, or a numeric zero (some exports write 0.00 in empty cells)
function isEmpty(v: string | number | null | undefined): boolean {
  return v === null || v === undefined || v === '' || v === 0;
}

export async function parseMayor(file: File): Promise<ParsedMayor> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });
  const wsRaw = wb.Sheets[wb.SheetNames[0]!];
  if (!wsRaw) throw new Error('El archivo no contiene hojas');
  const ws = wsRaw;
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Row 0: entity name in col A
  const entityName = String(rows[0]?.[0] ?? '').trim();

  // Row 1: "Desde la SUBCUENTA X a la Y En el PERIODO del DD/MM/YYYY al DD/MM/YYYY"
  const periodRow = String(rows[1]?.[0] ?? '');
  const periodMatch = periodRow.match(/del (\d{2}\/\d{2}\/\d{4}) al (\d{2}\/\d{2}\/\d{4})/);
  const periodStart = periodMatch?.[1] ?? '';
  const periodEnd = periodMatch?.[2] ?? '';

  // Auto-detect where data starts and which column holds the account code.
  // Scan from row 2 onward looking for the first account-header row:
  //   - colOffset=0: code in A(0), name in B(1), concept in C(2), debe in D(3), haber in E(4)
  //   - colOffset=1: code in B(1), name in C(2), concept in D(3), debe in E(4), haber in F(5)
  let detectedStartRow = 6;
  let colOffset = 0;

  for (let i = 2; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;

    for (const offset of [0, 1]) {
      const code = String(row[0 + offset] ?? '').trim();
      const colD = row[3 + offset];
      const colE = row[4 + offset];
      // Acepta tanto "10000000" como "10000000 CAPITAL SOCIAL" (código+nombre en misma celda)
      if (/^\d{4,8}(\s|$)/.test(code) && isEmpty(colD) && isEmpty(colE)) {
        detectedStartRow = i;
        colOffset = offset;
        break;
      }
    }
    if (detectedStartRow !== 6 || (detectedStartRow === 6 && i === 6)) break;
  }
  // Si el scan no encontró nada antes de la fila 6, comprobar la fila 6 por defecto
  if (detectedStartRow === 6) {
    for (const offset of [0, 1]) {
      const row = rows[6];
      if (!row) break;
      const code = String(row[0 + offset] ?? '').trim();
      if (/^\d{4,8}(\s|$)/.test(code)) {
        colOffset = offset;
        break;
      }
    }
  }

  const entries: ParsedEntry[] = [];
  let currentSubcuenta = '';
  let currentNombre = '';

  for (let i = detectedStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === '')) continue;

    const colA = row[0 + colOffset];
    const colB = row[1 + colOffset];
    const colC = row[2 + colOffset];
    const colD = row[3 + colOffset];
    const colE = row[4 + colOffset];

    // Skip TOTAL rows
    const cStr = String(colC ?? colB ?? '');
    if (cStr.includes('TOTAL') || cStr.includes('T O T A L')) continue;

    const colAStr = String(colA ?? '').trim();

    // Account header row: colA contains "XXXXXXXX Nombre" (código y nombre en la misma celda)
    // o solo el código con el nombre en colB (depende del software contable)
    const headerMatch = colAStr.match(/^(\d{4,8})(?:\s+(.+))?$/);
    if (headerMatch && isEmpty(colD) && isEmpty(colE)) {
      currentSubcuenta = headerMatch[1] ?? colAStr;
      currentNombre = (headerMatch[2] ?? String(colB ?? '')).trim();
      continue;
    }

    // Transaction row: has a date in colB and a current account context
    if (!currentSubcuenta || colB === null || colB === undefined) continue;
    const fecha = parseDate(colB as string | number | null);
    if (!fecha) continue;

    const debe = toNum(colD);
    const haber = toNum(colE);
    // Skip rows with no movement
    if (debe === 0 && haber === 0) continue;

    entries.push({
      subcuenta: currentSubcuenta,
      subcuentaNombre: currentNombre,
      asiento: typeof colA === 'number' ? Math.round(colA) : parseInt(colAStr) || 0,
      fecha,
      concepto: String(colC ?? '').trim(),
      debe,
      haber,
    });
  }

  return {
    entityName,
    periodStart,
    periodEnd,
    entries,
    _debug: {
      totalRows: rows.length,
      firstRows: rows.slice(0, 12) as (string | number | null)[][],
      detectedStartRow,
      colOffset,
    },
  };
}

function parseDate(val: string | number | null): string | null {
  if (val === null || val === '') return null;

  // Excel serial number (Jan 1, 1900 = 1, with the 1900 leap-year bug offset)
  if (typeof val === 'number' && val > 1000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Text date in DD/MM/YYYY
  if (typeof val === 'string') {
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m && m[1] && m[2] && m[3])
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  return null;
}

function toNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  // Handle Spanish format "1.234,56"
  const n = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
