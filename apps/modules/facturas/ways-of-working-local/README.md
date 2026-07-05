# Ways of Working — Locales del Módulo `facturas`

> Reglas específicas de este módulo. **No pueden contradecir las globales.**

---

## 📚 Índice

| Nº  | Archivo                              | Propósito |
| --- | ------------------------------------ | --------- |
| —   | (Sin archivos adicionales por ahora) |           |

---

## Reglas específicas del módulo facturas

### Endpoint del CF Worker

El endpoint de facturas es `/api/invoices`, no `/api/facturas`.
No cambiar esta ruta sin actualizar el CF Worker (`services/workers/cf-api/src/worker.ts`).

### Estados de factura

El flujo canónico es: `pending` → `en_propiedad` → `en_finanzas` → `paid` → `paid_archived`.
`rejected` puede ocurrir en cualquier etapa. Estos estados están definidos en
`@alsari/types` como `InvoiceStatus` — no duplicar la definición localmente.

### Fuente de datos

Todos los datos vienen del CF Worker. No conectar directamente a Supabase hasta
que se decida la migración de datos.
