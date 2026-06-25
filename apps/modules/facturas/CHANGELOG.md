# Changelog — Módulo `facturas`

Cambios relevantes del módulo. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [Unreleased]

### Added
- (Vacío)

---

## [0.1.0] — 2026-05-16

### Added
- Módulo inicial de gestión de facturas (Fase 1).
- Lista con búsqueda por texto libre y filtros por estado.
- 6 estados: pending, en_propiedad, en_finanzas, paid, paid_archived, rejected.
- KPIs: total, pendientes de revisión (con importe acumulado), pagadas, importe total.
- Panel de detalle inline con importe, fecha, proveedor, proyecto, link a documento
  y motivo de rechazo cuando aplica.
- Integración con `@alsari/types` (Invoice, InvoiceStatus) y `@alsari/utils`.
- `import.meta.env?.['VITE_API_URL']` con optional chaining (fix runtime en host).
- Endpoint corregido a `/api/invoices` (el CF Worker no expone `/api/facturas`).
