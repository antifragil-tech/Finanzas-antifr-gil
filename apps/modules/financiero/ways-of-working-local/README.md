# Ways of Working — Locales del Módulo `financiero`

> Reglas específicas de este módulo. **No pueden contradecir las globales.**

---

## 📚 Índice

| Nº  | Archivo                              | Propósito |
| --- | ------------------------------------ | --------- |
| —   | (Sin archivos adicionales por ahora) |           |

---

## Reglas específicas del módulo financiero

### Sidebar offset

El `FinancialSidebar` usa `fixed left-16` para respetar los 64px del OSSidebar.
Si el OSSidebar cambia de ancho, actualizar este valor aquí y en `FinancialSidebar.tsx`.

### Fuente de datos

Todos los datos vienen del CF Worker (`/api/data`, `/api/workspace/:year/:week`).
No conectar directamente a Supabase hasta que se decida la migración de datos.

### Modo privado

`isPrivateMode` es estado en `App.tsx`. Se pasa como prop hacia abajo.
No persistir en localStorage ni cookies — diseño intencional para privacidad en demos.
