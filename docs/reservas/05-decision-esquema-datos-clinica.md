# Decisión — Esquema de datos de Clínica: `public.clinica_*` (prefijo) vs schema `clinica`

> Estado: **PROPUESTA / provisional** · pendiente de revisión en el PR de Fase 1.
> Fecha: 2026-06-26 · Ámbito: módulo Reservas/Clínica (datos maestros, Fase 1).

## ⚠️ Governance de SQL (corrección 2026-07-04)

**Este PR ya NO incluye SQL.** La migración inicial
(`services/supabase/migrations/202606261000_clinica_fase1_catalogos.sql`) se retiró
del PR: las migraciones activas no viajan en PRs de feature. Regla en adelante:

- **Cualquier SQL de Clínica** irá en el **baseline curado**
  (`services/supabase/baselines/antifragil_os/`, como paquete revisable sin aplicar)
  o en un **PR de DB específico**, con sus checks y runbook.
- Este PR queda limitado a **tipos administrativos compartidos + documentación**.
  Los tipos de `packages/types/src/clinica.ts` definen el contrato; el SQL que los
  materialice se revisará por el canal de DB.
- El borrador de la migración retirada queda como referencia en la historia de la
  rama (commit `d08058d`); no debe reintroducirse en `services/supabase/migrations/`.
- Sin datos clínicos: el modelo es administrativo-operativo (agenda, catálogos,
  cliente administrativo). Nada de diagnóstico, lesión ni historia clínica.

## Decisión

Las tablas del dominio Clínica se crean en el esquema **`public`** con **prefijo de
módulo `clinica_`** (`public.clinica_clientes`, `public.clinica_citas`, …), **no** en
un esquema dedicado `clinica`.

## Contexto

Los documentos de diseño 02/03 escribían la notación `clinica.tabla` de forma
conceptual (para agrupar el dominio), pero no como decisión técnica firme de usar un
esquema PostgreSQL separado. El doc 00 (D1) además dudaba entre inglés/español. Hay
que fijarlo antes de construir la cita encima.

## Justificación (puntos solicitados)

### 1. Por qué encaja mejor con el patrón actual del repo
Todo el repo vive en `public` con **prefijo por módulo**: `factura_*`, `presupuesto_*`,
`proyecto_*`, `movimientos_bancarios`, etc. La capa de acceso (`@alsari/supabase-client`:
`req`/`post`, `sbUrl`/`sbHeaders`) y los `*Api.ts` (contabilidad, presupuestos) llaman a
`/rest/v1/<tabla>` **asumiendo el esquema `public`**. Un esquema separado obligaría a
divergir de ese patrón justo en el módulo nuevo. Con prefijo `clinica_`, `clinicaApi.ts`
es idéntico en forma a `contabilidadApi`/`presupuestosApi`.

### 2. Impacto en RLS
**Neutro.** RLS se aplica por tabla, no por esquema. Las políticas son idénticas vivan
las tablas en `public` o en `clinica` (`alter table … enable row level security` +
`create policy …`). La seguridad no mejora ni empeora por la elección de esquema: depende
de las políticas, que aquí son las mismas (v1 permisiva interna; público vía RPC
`SECURITY DEFINER`). La separación de permisos se logra con RLS por rol + RPC, no con el
esquema.

### 3. Impacto en PostgREST / Supabase
Es la diferencia operativa real. PostgREST solo expone por defecto el esquema `public`.
Un esquema `clinica` exigiría:
- añadirlo a **Exposed schemas** en Supabase (Settings → API), y
- que **cada** petición del cliente mandara cabeceras `Accept-Profile`/`Content-Profile:
  clinica` (o `.schema('clinica')` en supabase-js).
Con `public.clinica_*` **no hace falta nada de eso**: funciona con el `sbHeaders` actual,
sin tocar configuración del proyecto Supabase ni la librería compartida.

### 4. Qué perdemos frente a un schema `clinica`
- **Aislamiento de namespace**: con esquema, podrías tener `clinica.clientes` y
  `public.clientes` sin chocar; con prefijo, el nombre largo hace ese trabajo.
- **`grant`/permisos a nivel de esquema** de un golpe (p. ej. revocar todo `clinica` a un
  rol). Con prefijo se hace por tabla/política.
- **Orden visual** en herramientas que agrupan por esquema (con prefijo se agrupan por
  nombre, que para eso sirve el prefijo).
Ninguna de estas pérdidas afecta a funcionalidad ni a seguridad en nuestro caso.

### 5. Qué ganamos en simplicidad
- Cero cambios en `@alsari/supabase-client` ni en el patrón `*Api.ts`.
- Cero configuración extra en Supabase (exposed schemas, profiles).
- Coherencia total con los 60+ migraciones y módulos existentes.
- Menos superficie de error (un olvido de cabecera de esquema = 404 silencioso).

### 6. Reversibilidad
**Reversible, con coste contenido**, mientras no haya datos reales (hoy: sin SQL en
el PR — el borrador vive solo en la historia de la rama, sin aplicar). Migrar `public.clinica_*` → esquema `clinica` sería
`alter table public.clinica_x set schema clinica;` por tabla + exponer el esquema +
ajustar la cabecera en la capa API. No queda “fijado para siempre”, pero **cuanto más
tarde** (con datos, RPCs y FKs externas) **más caro**. Por eso se documenta ahora.

## Conclusión

Para nuestra prioridad —**coherencia con el repo y seguridad/RLS**— `public.clinica_*`
es lo más pragmático: misma RLS, sin fricción PostgREST, sin tocar la librería
compartida. La separación lógica la da el prefijo. Si en el futuro se quisiera un
esquema dedicado, es una migración acotada y se decidiría con datos en la mano.
