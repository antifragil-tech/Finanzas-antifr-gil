// Barrel de vistas ejecutivas por tipo de análisis.
// Cada tipo tiene su propia vista (veredicto, calidad del dato, KPIs clave,
// VAN/TIR, escenarios y desglose desplegable). Este archivo solo re-exporta.

export { CompraVentaView as KpisCV } from './CompraVentaView'; // Compra / reforma / venta
export { RentaAnalisisView as KpisRentaView } from './RentaView'; // Patrimonial en renta
export { ExplotacionView as KpisExplotacionView } from './ExplotacionView'; // Negocio operativo
export { PrestamoView as KpisPrestamoView } from './PrestamoView'; // Préstamo / inversión financiera
export { CapexView as KpisCapexView } from './CapexView'; // CAPEX interno
export { AlternativoView as KpisAlternativoView } from './AlternativoView'; // Alternativo
