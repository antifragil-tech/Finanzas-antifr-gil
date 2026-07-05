# Services — Backend e Integraciones

> Capa de backend del Alsari Capital OS.
> Esto NO se ejecuta en el navegador. Vive en Supabase u otros servicios externos.

---

## 📂 Estructura

| Carpeta                | Propósito                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `supabase/migrations/` | Migraciones SQL versionadas (`YYYYMMDDHHmm_descripcion.sql`) |
| `supabase/functions/`  | Edge Functions (TypeScript, Deno runtime)                    |
| `integrations/`        | MCPs, conectores externos (Gmail, Drive, …)                  |

---

## 🗄️ Supabase

### Migraciones

**Nombrado:** `YYYYMMDDHHmm_descripcion-corta.sql`

Ejemplos:

- `202605141030_crear-schema-financiero.sql`
- `202605141500_anadir-tabla-facturas.sql`
- `202605160900_rls-policies-entidades.sql`

**Reglas:**

- Cada migración es **irreversible** en producción. Si te equivocas, escribes
  otra migración que corrige.
- Cada migración debe ser **idempotente** cuando es posible (`IF NOT EXISTS`).
- Cada tabla nueva debe activar RLS y definir al menos una policy.

### Edge Functions

**Nombrado:** kebab-case por carpeta:

```
supabase/functions/
├── crear-factura/
│   └── index.ts
├── enviar-reporte-semanal/
│   └── index.ts
```

**Reglas:**

- Validación de input con Zod (importado desde `@alsari/types` si aplica).
- Manejo de errores explícito (devolver status correctos).
- CORS configurado estrictamente al dominio del Host OS.
- Secrets vía variables de entorno de Supabase, nunca hardcoded.

---

## 🔌 Integraciones

Aquí vivirán los MCPs y conectores externos cuando se construyan:

- Conector Gmail (clasificación de facturas en correos).
- Conector Google Drive (sincronización de documentos).
- Conector AEAT (largo plazo).
- MCP propio del OS (para consultar desde Claude.ai).

(Vacío por ahora.)
