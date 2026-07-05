# 05 · Seguridad

> Reglas de seguridad para proteger los datos del holding Alsari Capital.
> **Innegociables.** Los datos que manejamos (CIFs, IBANs, importes, contactos, contratos)
> son sensibles y su exposición tiene consecuencias legales y reputacionales.

---

## 🎯 Principios

1. **Defense in depth:** múltiples capas de protección. Si una falla, otra contiene.
2. **Least privilege:** cada componente accede solo a lo que necesita.
3. **Secrets fuera del código.** Siempre. Sin excepciones.
4. **Confianza cero:** validar todo input, incluso el que viene de "dentro".
5. **Auditable:** quién hizo qué y cuándo debe poder reconstruirse.

---

## 🔐 Gestión de secrets

### Reglas absolutas

1. **`.env` NUNCA se commitea.** Está en `.gitignore`.
2. **Solo `.env.example` va al repo** con placeholders sin valores reales.
3. **Si un secret entra al repo por error → rotar la credencial inmediatamente.**
   Borrarlo del historial no es suficiente; asume que ya está comprometido.
4. **Secrets de producción jamás en local sin necesidad.** Para desarrollo, usa
   instancias separadas de Supabase (dev/staging/prod).

### Variables de entorno

#### Estructura

```bash
# .env.example (esto SÍ va al repo)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-publica]
SUPABASE_SERVICE_ROLE_KEY=[service-role-NUNCA-en-cliente]

# Anthropic API (para Claude in apps)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (emails transaccionales, si aplica)
RESEND_API_KEY=re_...
```

#### Reglas de naming

- **`NEXT_PUBLIC_*`** → se exponen al cliente. Solo claves públicas (anon keys).
- **Sin prefijo** → solo backend / server-side. Service roles, API keys privadas.
- **Mayúsculas + snake_case.**

#### Validación

Todas las env vars críticas se validan con Zod al arranque:

```typescript
// packages/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

export const env = EnvSchema.parse(process.env);
```

Si una variable obligatoria falta, la app **NO ARRANCA**. Es preferible a fallar
silenciosamente en producción.

---

## 🛡️ Supabase: Row Level Security (RLS)

### Regla #1: TODAS las tablas tienen RLS activado

```sql
-- Por defecto en cada migration
ALTER TABLE financiero.monthly_revenue ENABLE ROW LEVEL SECURITY;
```

Una tabla sin RLS es **una brecha de seguridad**. Si por alguna razón necesitas una
tabla sin RLS (caso muy raro), debe estar:

1. Justificado en un ADR.
2. Documentado en la propia migration con comentario `-- RLS_OFF_JUSTIFICATION: ...`.
3. Restringida a schema interno (no `public`).

### Patrones de policies

**Acceso solo a admins:**

```sql
CREATE POLICY "Solo admins leen monthly_revenue"
  ON financiero.monthly_revenue
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

**Acceso por entidad pertenecida:**

```sql
CREATE POLICY "Usuarios ven solo facturas de sus entidades"
  ON facturas.invoices
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id FROM user_entities
      WHERE user_id = auth.uid()
    )
  );
```

---

## 🔑 Autenticación

### Stack

- **Supabase Auth** como proveedor.
- **Métodos permitidos:** email + password con MFA, magic link, OAuth Google (para
  cuentas corporativas).
- **JWT** como token de sesión, refrescado automáticamente.

### Reglas

1. **MFA obligatorio para admins.** Configurar en Supabase Dashboard.
2. **Sesiones expiran en 7 días.** Refresh tokens en cookies httpOnly.
3. **Cierre de sesión limpio:** elimina tokens locales + invalida en servidor.
4. **Rate limit en login:** máximo 5 intentos en 15 minutos por IP.

### Manejo de roles

Roles iniciales:

- `admin` → Guille y socios. Acceso total.
- `operator` → Personal de confianza (asesores externos, contables). Acceso a módulos
  específicos.
- `viewer` → Solo lectura (auditorías, revisiones puntuales).

Los roles se almacenan en `user_metadata.role` en Supabase Auth y se leen en JWT.

---

## 🧪 Validación de inputs

### En el cliente

Todo formulario valida con Zod **antes de enviar**:

```typescript
const InvoiceSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  vatNumber: z.string().regex(/^[A-Z]\d{8}$/, 'CIF inválido'),
  date: z.coerce.date(),
  entityId: z.string().uuid(),
});
```

### En el servidor (Edge Functions)

**No confíes en la validación del cliente.** Revalida en el servidor con el mismo
schema (importado desde `packages/types`).

```typescript
// services/supabase/functions/create-invoice/index.ts
const body = await req.json();
const validated = InvoiceSchema.parse(body); // lanza si inválido
```

### Sanitización

- **HTML/Markdown de usuario:** sanitizar con DOMPurify antes de renderizar.
- **SQL:** Supabase usa prepared statements; no se hacen queries crudas con
  concatenación de strings.
- **Paths/filenames:** validar con regex estricta. Nunca concatenar paths del usuario.

---

## 🌐 Comunicaciones

### HTTPS siempre

- Todas las llamadas externas: HTTPS obligatorio.
- En desarrollo local: aceptable HTTP en `localhost` solo.

### CORS

- Edge Functions configuran CORS estrictamente con dominio del Host OS.
- Nunca `Access-Control-Allow-Origin: *` en endpoints que tocan datos sensibles.

### Headers de seguridad

El Host OS (Next.js) debe configurar:

```javascript
// next.config.ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ],
  }];
}
```

---

## 📝 Logging y auditoría

### Reglas de logging

1. **Nunca logees secrets, passwords, tokens, ni datos personales completos** (DNIs,
   IBANs completos). Si necesitas trazar, usa últimos 4 dígitos.
2. **Logs estructurados** (JSON) en producción, no `console.log` plano.
3. **Niveles:** `debug` (solo dev), `info`, `warn`, `error`.

### Auditoría de cambios en BD

Tablas críticas (`monthly_revenue`, `invoices`, `contracts`) deben tener triggers
que registren en una tabla `audit_log` cada INSERT/UPDATE/DELETE con:

- Usuario que hizo el cambio (`auth.uid()`).
- Timestamp.
- Valores antiguos y nuevos (JSON).

---

## 🚫 Cosas que NUNCA hacemos

1. ❌ Guardar passwords en BD (Supabase Auth ya gestiona el hashing).
2. ❌ Tokens JWT en `localStorage`. Usa cookies httpOnly + secure.
3. ❌ Enviar emails con datos sensibles en el cuerpo (números completos de cuenta).
4. ❌ Endpoints públicos que devuelvan listas completas de entidades.
5. ❌ Permisos `service_role` en código cliente. Solo en Edge Functions / backend.
6. ❌ Subir archivos sin validar tipo MIME y tamaño máximo.
7. ❌ Ejecutar SQL crudo con strings concatenados.
8. ❌ Hacer despliegues a producción sin pasar por staging.

---

## ✅ Checklist de seguridad antes de cada release

- [ ] Todas las tablas tienen RLS activado.
- [ ] Variables de entorno validadas con Zod.
- [ ] Ningún secret en el repo (revisar con `git-secrets` o similar).
- [ ] Headers de seguridad configurados.
- [ ] CORS restringido a dominios autorizados.
- [ ] Dependencias auditadas (`pnpm audit`).
- [ ] No hay `console.log` con datos sensibles.
- [ ] MFA activo en cuentas admin.
- [ ] Backups de Supabase verificados.

---

## 🆘 Protocolo ante una brecha

Si se detecta una posible filtración:

1. **Aislar inmediatamente** el componente afectado (revocar credenciales, bajar
   módulo si hace falta).
2. **Rotar todos los secrets** relacionados.
3. **Avisar a Guille** sin esperar a tener todos los detalles.
4. **Documentar en `docs/incidentes/YYYY-MM-DD-descripcion.md`** qué pasó, cómo se
   detectó, qué se hizo y qué se aprendió.
5. **Registrar en `lessons-learned/log.md`** para que no vuelva a pasar.
