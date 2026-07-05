# Arquitectura — Módulo `facturas`

> Documento vivo. Estado técnico actual del módulo.

**Última actualización:** 2026-05-17
**Versión del módulo:** 0.1.0

---

## 🗺️ Visión general

Módulo de una sola vista. Toda la lógica (fetch, filtros, renderizado de tabla y
panel de detalle) vive en `App.tsx`. Consume el endpoint `/api/invoices` del
CF Worker y aplica filtros en cliente (sin paginación server-side).

---

## 🧱 Estructura interna

```
src/
├── App.tsx    # Componentes: FacturasApp (main) + StatusBadge (helper inline)
├── index.ts
├── main.tsx
└── styles.css
```

---

## 🔄 Flujos clave

### Carga inicial

```
FacturasApp monta
  → fetchInvoices() → GET /api/invoices
  → { success: true, data: Invoice[] }
  → setInvoices() → filtrado por useMemo → render tabla
```

### Filtrado en cliente

```
Usuario escribe en búsqueda o cambia estado
  → useMemo recalcula filtered[]
  → Tabla re-renderiza sin fetch adicional
```

### Detalle de factura

```
Click en fila
  → setSelected(inv) o setSelected(null) si ya estaba seleccionada
  → Panel de detalle aparece debajo de la tabla (inline, no modal)
```

---

## 📊 Fuente de datos

| Endpoint            | Propósito                              |
| ------------------- | -------------------------------------- |
| `GET /api/invoices` | Lista completa de facturas del holding |

Respuesta: `{ success: boolean, data: Invoice[] }`.
No usa Supabase para datos (trabajo de Fase futura).

---

## 🔐 Permisos

Solo accesible tras autenticación en el Host OS. No implementa control de acceso
propio a nivel de factura.

---

## 🎯 Decisiones técnicas locales

- **Todo en App.tsx:** módulo suficientemente simple para no necesitar separación.
  Umbral de extracción: si supera 300 líneas o añadimos vistas adicionales.
- **Filtrado en cliente:** las facturas son pocas (< 500 típicamente). Si crece,
  mover filtros al CF Worker como query params.
- **Detalle inline:** sin modal ni drawer lateral. Aparece debajo de la fila
  seleccionada. Si se añaden acciones (aprobar, rechazar), reconsiderar.

---

## 🚧 Deuda técnica

- Sin paginación: carga todas las facturas en un fetch. Aceptable hasta ~500 registros.
- Sin acciones de mutación: solo lectura. Cambio de estado de facturas es trabajo futuro.
