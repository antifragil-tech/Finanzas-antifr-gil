// Lógica PURA (sin red) de la estructura de carpetas y nombres en Google Drive
// para el archivo documental de facturas (PR D). Es la fuente canónica; la Edge
// Function `archivar-en-drive` replica esta misma lógica en Deno. Estructura:
//   Contabilidad / {Sociedad} / {Año} / {Mes} / {fecha}_{proveedor}_{numero}/
//     ├── factura.pdf
//     └── justificante_NN_YYYY-MM-DD.pdf

// Limpia un nombre de carpeta/archivo: quita acentos y caracteres inválidos,
// colapsa espacios. Mantiene espacios (para nombres de sociedad legibles).
export function clean(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token con guion bajo en vez de espacios (para el nombre de subcarpeta).
export function token(s: string, max = 60): string {
  const c = clean(s).replace(/\s+/g, '_').replace(/_+/g, '_');
  return c.slice(0, max).replace(/_+$/, '') || 'NA';
}

export type FacturaParaPath = {
  sociedadNombre: string;
  fechaFactura: string; // ISO YYYY-MM-DD
  proveedorNombre: string;
  numeroFactura: string | null;
};

// Segmentos de carpeta bajo la raíz (Shared Drive). El Año/Mes salen de la fecha
// de factura; el Mes en 2 dígitos para que ordene bien.
export function carpetaFacturaSegments(f: FacturaParaPath): string[] {
  const fecha = f.fechaFactura || 'sin-fecha';
  const año = fecha.slice(0, 4) || 'sin-fecha';
  const mes = fecha.slice(5, 7) || '00';
  const sub = `${fecha}_${token(f.proveedorNombre)}_${token(f.numeroFactura || 's-n', 30)}`;
  return ['Contabilidad', clean(f.sociedadNombre) || 'Sin sociedad', año, mes, sub];
}

export const NOMBRE_FACTURA_PDF = 'factura.pdf';

export function nombreJustificante(indice: number, fechaPago: string | null): string {
  const n = String(indice).padStart(2, '0');
  const fecha = (fechaPago || '').slice(0, 10) || 'sin-fecha';
  return `justificante_${n}_${fecha}.pdf`;
}
