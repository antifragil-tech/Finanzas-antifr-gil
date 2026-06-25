/**
 * Robust parser for European CSV format.
 * Handles: "250.000 €", "1.000,00", "12,50%", "50,00%"
 * Returns a clean number (e.g., 250000, 1000, 12.5, 0.5)
 */
export function parseCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const str = value.toString().trim();
  if (!str) return 0;

  // Strip everything except digits, dots, commas, and minus
  let cleaned = str.replace(/[^\d.,-]/g, '');

  if (cleaned.includes('.') && cleaned.includes(',')) {
    // European: "1.000,00" → dots = thousands, comma = decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Comma-only → decimal separator
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Dot-only: treat as thousands separator if last segment is exactly 3 digits
    const parts = cleaned.split('.');
    if (parts.length > 1 && parts[parts.length - 1]?.length === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Alias kept for backward compatibility with legacy code. */
export const cleanNumber = (value: string | number | null | undefined): number =>
  parseCurrency(value);

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

/**
 * Formats a decimal or percentage value.
 * Accepts both representations: 0.25 (raw) or 25 (percentage points).
 * Values > 1 are treated as percentage points and divided by 100.
 */
export function formatPercent(value: number): string {
  const abs = Math.abs(value);
  const normalized = abs > 1 ? value / 100 : value;
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(normalized || 0);
}
