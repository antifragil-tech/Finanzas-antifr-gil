# SESSION — Estado actual de trabajo · Antifrágil OS

> **Última actualización:** 2026-07-16 · Rama: `docs/reconciliacion-estado-2026-07-16`
> Sustituye al SESSION del 2026-07-07. Todo lo marcado como mergeado está
> **verificado contra `origin/main` y `gh pr list` el 2026-07-16**. Si el estado
> real diverge de este documento, gana el estado real: verificar con
> `git log origin/main` y `gh pr list` antes de asumir.

---

## 1. Qué es este proyecto (resumen mínimo)

**Antifrágil OS**: sistema operativo interno de Antifrágil (clínica). **v1 es
administrativo-operativo: NUNCA historia clínica** (solo ID/enlace externo controlado).
Detalle del alcance en `docs/compliance/00-alcance-administrativo-operativo.md` y
`docs/compliance/01-frontera-notion-antifragil-os.md`. El operador real único es
**Javi** (single-operator): toda validación manual pasa por él.

---

## 2. ✅ Completado (mergeado en `main`, verificado 2026-07-16)

Sobre lo ya descrito en el CHANGELOG (PRs #31–#45, web operativa con datos reales):

- **#46 — Jerarquía visual del OS**: el **Panel (`/dashboard`) dejó de ser mock**
  (lee ingresos/gastos/CxC/liquidaciones reales; banda héroe "Resultado del mes",
  tendencia 6 meses, avisos reales "Requiere atención"); nav reorganizado en
  Dirección / Dinero / Operación / Sistema; héroe M3 en Rentabilidad con delta
  mensual; héroe de saldo Caja/Banco en Tesorería; topbar "MVP operativo".
  (Rescate del trabajo del 8-jul que quedó sin commitear en `wt-ux-jerarquia`.)
- **#47 — Esquema real versionado**: `services/supabase/esquema-real/` contiene la
  foto fiel del esquema `public` de la base real (58 tablas · 21 enums · 12 vistas ·
  74 políticas RLS · 256 constraints), generada por reflexión de solo lectura y
  regenerable con `scripts/db/reflejar-esquema.py`. **Cierra el drift repo↔producción.**
- **PRs #4 y #12 cerrados** (2026-07-16): superados por la realidad — su contenido
  está aplicado y ampliado en la base. Referencia canónica: `esquema-real/`.
- **No queda ningún PR abierto.**

## 3. 🔎 Hallazgos clave del reflejo de la base (2026-07-16)

- La base contiene **mucho más de lo que el repo/documentación conocía**: existe
  `clinica_citas` (con **constraint de exclusión anti-solapes** por profesional),
  el ledger completo de bonos (`ventas/consumos/caducidades/devoluciones_bono`),
  el motor de liquidaciones (reglas/evidencias/ajustes/pagos) y una **capa de
  roles operativos en BD** (`rol_operativo_actual()`, `es_direccion()`,
  `perfiles_operativos`; roles direccion/coordinacion/recepcion/profesional).
- **RLS activado en las 58 tablas**; buckets `facturas` y `documentos-operativos`
  privados. 41/74 políticas siguen siendo la base permisiva (`authenticated` +
  `using (true)`): endurecerlas donde toque sigue en backlog.
- **Datos reales intactos**: 514 gastos · 158 ingresos · 99 facturas recibidas ·
  71 liquidaciones · 21 facturas OPS · 37 cobros · 11 CxC · 10 profesionales.
  `movimientos_bancarios` **a 0** (falta el export real del banco) y
  `clinica_citas` **a 0** (Reservas sigue mock, sin conectar).
- `gastos_operativos` **no tiene** la columna `cuenta_tesoreria` que la UI del
  PR #46 lee de forma tolerante: el desglose Caja/Banco es parcial hasta añadirla
  (candidata a paquete A1b) o derivarla de `medio_pago`.

## 4. ⚠️ Operativa de la base: pausas del plan free

El proyecto Supabase `antifragil-os` **estaba pausado** desde ~8-jul (plan free:
pausa automática tras ~1 semana sin uso; el DNS del proyecto deja de resolver y
la web desplegada no puede leer datos). Se reactivó el 2026-07-16 vía Management
API. **Decisión pendiente de Guille:** subir a plan de pago o asumir
reactivaciones manuales periódicas.

## 5. 📋 Plan vigente (acordado con Guille el 2026-07-16: "haremos todas")

| Bloque | Qué es                                                                                                                | Estado                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A      | Deuda BD: versionar esquema, RLS, cerrar #4/#12                                                                       | ✅ Hecho (queda endurecer políticas permisivas + identidad de escritor real + rotar token) |
| B      | **Reservas con backend** (conectar módulo a `clinica_citas`/catálogos reales, cobros/bonos; flujo cliente público)    | ⏭️ Siguiente — prioridad nº1 de negocio                                                    |
| C      | Ingesta Salonized + export banco (desbloquea rentabilidad por profesional/servicio, liquidaciones del mes, caja real) | Bloqueado por exports reales (Javi/Lidia)                                                  |
| D      | Configuración real (usuarios/roles/centros) — Panel ya es real                                                        | Pendiente                                                                                  |
| E      | Serie FOP (docs finanzas 04–14): liquidaciones automáticas, bonos/devengo, CxC/CxP, imputación, forecast              | Diseño hecho; parte del modelo ya existe en BD; bloqueado por decisiones §6                |
| F      | Decisiones humanas (ver §6)                                                                                           | En curso                                                                                   |
| G      | Higiene: docs (este PR), tests host/reservas, E2E, rebrand `@alsari/*`                                                | Este PR es la parte docs                                                                   |

## 6. ⚠️ Pendientes de humanos (decisiones / acciones manuales)

- 🔴 **Rotar el token de Supabase `sbp_`** usado en las sesiones de carga y
  reflexión (Javi; acción manual en el Dashboard, fuera del repo).
- **Plan de pago Supabase** vs pausas semanales del free (Guille, ver §4).
- **Export banco de Lidia**: formato real del extracto semanal para validar la
  plantilla `extracto_banco` (`movimientos_bancarios` sigue a 0).
- **Primer export real de Salonized** para validar la plantilla `facturas_salonized`.
- **Logo definitivo** (la factura imprimible usa el wordmark tipográfico).
- **Regla de extras de bonos** en liquidaciones (Guille/Fernando).
- **UG/PM**: decisión pendiente (contexto en la sesión operativa del 7-jul).
- Decisiones de negocio de la serie FOP (costes generales, recepción compartida,
  partners Lidomare/Vivofácil/Oasis, devengo/caducidad de bonos, política CxC,
  forecast): listadas doc a doc en `docs/finanzas/04`–`13`.
- ✅ ~~Anon key legacy hardcodeada~~ — eliminada del código en la cirugía del
  2026-07-05 (`packages/supabase-client` usa fallbacks inertes). Rotarla en el
  proyecto legacy sigue siendo prudente, pero ya no hay exposición en el repo.

## 7. 🐛 Deuda técnica vigente

- **41/74 políticas RLS permisivas** (`authenticated using(true)`) — endurecer
  por rol donde aplique (la capa de roles ya existe en BD).
- **Identidad del escritor**: las escrituras del host registran
  `'entrada-manual-web'`/`'importacion-web'` en vez del usuario real.
- **Desglose Base/IVA de la factura OPS** viaja en `notas` (deuda D2 asumida).
- **Lotes de importación en tmpdir**: un reinicio/redeploy caduca la preview.
- **0 tests en `apps/host` y `apps/modules/reservas`** (el dominio `operativa`
  sí tiene ~53); E2E desactivado en CI.
- **Rebrand global `@alsari/*` diferido** (decisión vigente: solo marca visible).
- `docs/integration/*` y `docs/governance/00` describen el estado pre-MVP
  (PRs #1–#22) y no se han reconciliado; tratarlos como históricos.

## 8. 📁 Referencias clave

| Qué                                                   | Dónde                                                    |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Esquema real versionado (fuente de verdad)            | `services/supabase/esquema-real/`                        |
| Regenerar el reflejo tras un cambio de esquema        | `scripts/db/reflejar-esquema.py`                         |
| Checks de paridad repo↔base                           | `services/supabase/esquema-real/post_reflejo_checks.sql` |
| Capa de datos del host                                | `apps/host/src/lib/datos/`                               |
| Dominio operativo (motor financiero + plantillas CSV) | `packages/operativa/src/`                                |
| Derivaciones del Panel                                | `apps/host/src/components/os/dashboard/panel.ts`         |

## 9. 🔗 Contexto necesario para continuar

- **Contrato innegociable del build**: toda página/acción nueva del OS funciona
  sin entorno (demo) y con entorno (datos reales); la service_role key JAMÁS
  llega al cliente. El juez de formato y checks es el CI (Linux; `.md` con LF).
- Reglas de siempre: **no tocar `main`**, todo por ramas/worktrees aislados,
  **todo PR empieza como Draft**, no aplicar SQL sin autorización expresa,
  **no datos clínicos**.
- Tras cualquier cambio de esquema en la base real: regenerar el reflejo
  (`scripts/db/reflejar-esquema.py`) y commitearlo en el mismo PR.
