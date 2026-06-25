import type { RowObject, SheetsResponse, DashboardData } from './types';

/**
 * Financial column keywords to detect numeric fields
 */
const FINANCIAL_KEYWORDS = [
    'caja',
    'deuda',
    'saldo',
    'ingreso',
    'gasto',
    'coste',
    'costo',
    'beneficio',
    'margen',
    'importe',
    'total',
    'precio',
    'valor',
    'activo',
    'pasivo',
    'patrimonio',
    'capital',
    'inversion',
    'inversión',
    'rentabilidad',
    'ebitda',
    'ebit',
    'resultado',
    '%',
    'porcentaje',
    'neto',
    'presupuesto',
];

/**
 * Check if a column name suggests it contains financial/numeric data
 */
function isFinancialColumn(columnName: string): boolean {
    const normalized = columnName.toLowerCase().trim();
    return FINANCIAL_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Parse a value that might be in Excel format (e.g., "1.000,00" or "1,000.00")
 * Returns a number or the original value if not numeric
 */
function parseFinancialValue(value: string, isFinancial: boolean): string | number | null {
    if (!value || value.trim() === '') {
        return null;
    }

    // If not a financial column, return as-is
    if (!isFinancial) {
        return value;
    }

    // Try to parse as number
    let cleaned = value.trim();

    // 1. Remove everything except numbers, dots, commas, and minus sign
    // This removes €, %, spaces, and other text
    cleaned = cleaned.replace(/[^\d.,-]/g, '');

    // Handle European format: 1.000,00 -> 1000.00
    // Detect format: if there's a comma followed by 1-2 digits at the end, it's likely decimal
    const europeanFormat = /^-?[\d.]+,\d{1,2}$/;
    const americanFormat = /^-?[\d,]+\.\d{1,2}$/;

    if (europeanFormat.test(cleaned)) {
        // European: remove dots, replace comma with dot
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (americanFormat.test(cleaned)) {
        // American: remove commas
        cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
        // Only comma: treat as decimal
        cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.') && !cleaned.includes(',')) {
        // Only dot: check if it's a thousand separator (followed by 3 digits) or decimal
        const parts = cleaned.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3 && parts.length > 1) {
            // Likely a thousand separator: 1.000 -> 1000
            cleaned = cleaned.replace(/\./g, '');
        }
        // Otherwise keep the dot as decimal
    } else {
        // Fallback: remove everything that isn't a digit or dot or minus
        // This is a bit risky but handles cases like "1.000.000" without decimals
        // But we already handled the main cases above.
    }

    const num = parseFloat(cleaned);

    // Return number if valid, otherwise return original string
    return !isNaN(num) ? num : value;
}

/**
 * Convert sheet rows to array of objects
 * First row is assumed to be headers
 */
function rowsToObjects(values: string[][]): RowObject[] {
    if (!values || values.length < 2) {
        return [];
    }

    const headers = values[0];
    const rows = values.slice(1);

    // Determine which columns are financial
    const isFinancialCol = headers.map(h => isFinancialColumn(h));

    return rows.map(row => {
        const obj: RowObject = {};

        headers.forEach((header, index) => {
            const value = row[index] || '';
            obj[header] = parseFinancialValue(value, isFinancialCol[index]);
        });

        return obj;
    });
}

/**
 * Transform batch sheet response into structured dashboard data
 */
export function transformSheetData(valueRanges: SheetsResponse[]): DashboardData {
    // Core ranges are always the first 4
    const [
        sociedadesRange,
        proyectosRange,
        finanzasSociedadesRange,
        finanzasProyectosRange,
        ...remainingRanges
    ] = valueRanges;

    // Separate ranges by prefix
    const ponderados: { [key: string]: RowObject[] } = {};
    const fichas: { [key: string]: RowObject[] } = {};
    const bancos: { [key: string]: RowObject[] } = {};

    remainingRanges.forEach(range => {
        const sheetNameMatch = range.range.match(/^'?([^'!]+)'?!/);
        if (sheetNameMatch) {
            const sheetName = sheetNameMatch[1];
            if (sheetName.startsWith('Ponderados_')) {
                const key = sheetName.replace(/^Ponderados_/, '').toLowerCase();
                ponderados[key] = rowsToObjects(range.values || []);
            } else if (sheetName.startsWith('Ficha_')) {
                const key = sheetName.replace(/^Ficha_/, '').toLowerCase().replace(/\s+/g, '_');
                fichas[key] = rowsToObjects(range.values || []);
            } else if (sheetName.startsWith('Bancos_') || sheetName.startsWith('Posiciones_')) {
                const key = sheetName.toLowerCase().replace(/\s+/g, '_');
                bancos[key] = rowsToObjects(range.values || []);
            }
        }
    });

    // Filter out deleted societies
    const sociedadesData = rowsToObjects(sociedadesRange.values || [])
        .filter(sociedad => {
            const nombre = (sociedad['Nombre de la Sociedad'] || '').toString().toLowerCase();
            const idRef = (sociedad['ID-Ref'] || '').toString().toLowerCase();

            // Exclude Empire of the Dunes / 1000 Dunas
            const excludedNames = ['empire of the dunes', '1000 dunas', 'empire'];
            const excludedIds = ['s-1000'];

            return !excludedNames.some(excluded => nombre.includes(excluded)) &&
                !excludedIds.some(excluded => idRef.includes(excluded));
        });

    return {
        sociedades: sociedadesData,
        proyectos: rowsToObjects(proyectosRange.values || []),
        finanzas_sociedades: rowsToObjects(finanzasSociedadesRange.values || []),
        finanzas_proyectos: rowsToObjects(finanzasProyectosRange.values || []),
        fichas,
        ponderados,
        bancos,
    };
}

