# SESSION — Estado actual de trabajo · Antifrágil OS

> **Última actualización:** 2026-07-07 · Rama: `docs/sync-estado-2026-07-07`
> Sustituye al SESSION del 2026-07-04 (pre-integración). Todo lo marcado como mergeado
> está **verificado contra `origin/main` y `gh pr list` el 2026-07-07**. Si el estado
> real diverge de este documento, gana el estado real: verificar con `git log origin/main`
> y `gh pr list` antes de asumir.

---

## 1. Qué es este proyecto (resumen mínimo)

**Antifrágil OS**: sistema operativo interno de Antifrágil (clínica). **v1 es
administrativo-operativo: NUNCA historia clínica** (solo ID/enlace externo controlado).
Detalle del alcance en `docs/compliance/00-alcance-administrativo-operativo.md` y
`docs/compliance/01-frontera-notion-antifragil-os.md`. El operador real único es
**Javi** (single-operator): toda validación manual pasa por él.

---

## 2. 🎯 Objetivo de la rama actual

Sincronizar la documentación humana (`docs/CHANGELOG.md`, `docs/ARQUITECTURA.md`,
`docs/SESSION.md`) con el estado real de `main` tras los merges del 6–7 de julio
(PRs #33–#42): web operativa conectada a datos reales de Supabase.

## 3. ✅ Completado (mergeado en `main`, verificado)

Cadena de PRs mergeados que construyó el MVP web (del más antiguo al más nuevo):

- **#31 + #33** — Reservas canónico montado en el host + **cirugía del runtime MVP**:
  Antifrágil OS sin legado Alsari visible; páginas operativas en
  `apps/host/src/app/(app)/(os)/`.
- **#34–#35** — Dominio `@antifragil/operativa` (`packages/operativa`): motor
  financiero (ingresos, gastos, facturas, Tesorería) + liquidación asociada a
  nómina/factura de autónomo.
- **#36–#38** — Importación segura Excel/CSV, datos de negocio confirmados
  (AFDH, alquiler, Salonized), plantillas CSV (`plantillas-importacion/`),
  importador compatible con el cashflow real + método de pago.
- **#39** — **Web conectada a datos reales**: `apps/host/src/lib/datos/fuenteDatos.ts`
  (PostgREST con service_role **server-only**), contrato «sin env → demo,
  con env → datos reales» (build CI sin secrets sigue verde).
- **#40** — **Liquidaciones** con histórico real (`liquidaciones_mensuales` +
  profesionales + líneas, nov-2024 → dic-2025).
- **#41** — **Entrada manual de datos** en Tesorería (gasto · ingreso+cobro · factura
  recibida) + **emisión de factura operativa serie OPS** con vista imprimible
  `/tesoreria/factura/[id]` (wordmark Antifrágil, exención IVA sanitaria
  art. 20.Uno.3º) + **filtro de mes** en Tesorería/Rentabilidad.
- **#42** — **Importación web de reportes** (`/tesoreria/importar`): plantillas
  `facturas_salonized`, `efectivo` y `extracto_banco` en `@antifragil/operativa`,
  preview con detección de duplicados, aplicación **idempotente** (uuid v5
  determinista) y **conciliación v1** movimientos bancarios ↔ facturas recibidas.
- **Datos**: base Supabase real **poblada** — gastos del Cash Flow, ingresos
  detallados de Salonized, 99 facturas del Drive (88 conciliadas), liquidaciones
  nov-2024 → dic-2025, cobros en efectivo, cuentas por cobrar y proyectos
  CLI-PLY/CENS/MENDRA/9AM. (Estructuras: las cifras no se documentan en el repo.)

Detalle por PR en `docs/CHANGELOG.md` (bloque Unreleased) y estado técnico en
`docs/ARQUITECTURA.md` (sección "Antifrágil OS — capa de datos reales del host").

## 4. 🚧 En progreso / Incompleto

- **`feat/web-cxc-proyectos`** — **en construcción por otro agente**: pantalla de
  cuentas por cobrar + dimensión de proyectos en la web. La base real YA tiene la
  tabla `public.cuentas_por_cobrar` (RLS + policies `authenticated`) y la dimensión
  de proyectos en `gastos_operativos`; **faltan el SQL versionado en el repo y el
  cableado UI**. No duplicar ese trabajo desde otra sesión.
- **PRs Draft abiertos**: #4 (baseline DB, NO APPLY) y #12 (A2 catálogos clínica,
  NO APPLY) — su vigencia debe revisarse ahora que la base real existe y está poblada.

## 5. 📋 Próximos pasos recomendados

1. Revisar y mergear el PR Draft de esta rama (sincronización de docs).
2. Cerrar `feat/web-cxc-proyectos` (agente en curso) incluyendo su SQL versionado.
3. Desbloquear la operativa semanal con los pendientes de Javi (§6): en especial el
   export real del banco (Lidia) para la plantilla `extracto_banco`.
4. Reconciliar los PRs #4/#12 (baseline curado) con el esquema real ya aplicado, para
   que el repo vuelva a ser fuente de verdad del esquema.
5. Rotar credenciales pendientes (§6, seguridad) antes de seguir cargando datos.

## 6. ⚠️ Pendientes de Javi (decisiones / acciones manuales)

- **Export banco de Lidia**: conseguir el formato real del extracto semanal para
  validar/ajustar la plantilla `extracto_banco`.
- **Logo**: la factura imprimible usa hoy el wordmark tipográfico "Antifrágil";
  falta el logo definitivo.
- **Regla de extras de bonos**: criterio pendiente para las liquidaciones.
- **UG/PM**: decisión pendiente (detalle por confirmar; anotado en la sesión
  operativa del 7 de julio — quien lo retome debe pedir contexto a Javi).
- 🔴 **Rotar el token de Supabase `sbp_`** usado en la sesión de carga de datos
  (acción de seguridad manual, fuera del repo).
- 🔴 (Heredado, riesgo R5) **rotar la anon key legacy** hardcodeada en
  `packages/supabase-client` (proyecto Supabase legacy de Alsari).

## 7. 🐛 Bugs conocidos / Deuda técnica detectada

- **Esquema real sin SQL versionado**: `public.cuentas_por_cobrar` y la dimensión de
  proyectos en `gastos_operativos` se aplicaron directamente sobre la base real. El
  directorio `services/supabase/migrations/` es 100 % legacy Alsari y NO refleja la
  base de Antifrágil.
- **Desglose Base/IVA de la factura OPS** viaja en `notas` con formato estable
  (parseado en `fuenteDatos.ts`) porque la tabla no lo persiste — deuda asumida (D2).
- **Lotes de importación en tmpdir**: un reinicio/redeploy del servidor caduca la
  preview (la UI ya avisa "vuelve a subir el archivo").
- **Rebrand global `@alsari/*` diferido** (decisión vigente): solo la marca visible
  es Antifrágil; los scopes de paquetes internos se renombrarán en fase dedicada.

## 8. 📁 Archivos clave (estado actual en `main`)

| Archivo                                                  | Cambio principal                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/host/src/lib/datos/fuenteDatos.ts`                 | Lecturas PostgREST service_role (server-only) + fallback demo sin entorno |
| `apps/host/src/lib/datos/acciones.ts`                    | Server actions de entrada manual + emisión factura OPS                    |
| `apps/host/src/lib/datos/importacionWeb.ts`              | Lotes temporales (tmpdir) + uuid v5 determinista por fila                 |
| `apps/host/src/lib/datos/accionesImportacion.ts`         | Subir/aplicar lote idempotente + conciliación pago→factura                |
| `apps/host/src/lib/datos/periodo.ts`                     | Utilidades puras del filtro de mes `?mes=YYYY-MM`                         |
| `apps/host/src/app/(app)/(os)/tesoreria/`                | Página Tesorería + `importar/` + `factura/[id]/` (vista imprimible)       |
| `apps/host/src/components/os/tesoreria/EntradaDatos.tsx` | Formularios de entrada manual                                             |
| `packages/operativa/src/importacion.ts`                  | 7 plantillas CSV (3 nuevas: facturas_salonized, efectivo, extracto_banco) |
| `docs/CHANGELOG.md` · `docs/ARQUITECTURA.md`             | Sincronizados con este estado (esta rama)                                 |

## 9. 🔗 Contexto necesario para continuar

- **Contrato innegociable del build**: toda página/acción nueva del OS debe funcionar
  sin entorno (demo) y con entorno (datos reales); la service_role key JAMÁS llega al
  cliente. El juez de formato y checks es el CI (Linux; los `.md` van con LF).
- Reglas de siempre: **no tocar `main`**, todo por ramas/worktrees aislados, **todo PR
  empieza como Draft**, no aplicar SQL sin autorización expresa, **no datos clínicos**.
- Otros chats/agentes trabajan en paralelo sobre este repo: verificar ramas y PRs
  (`git fetch` + `gh pr list`) antes de asumir que algo no existe.
