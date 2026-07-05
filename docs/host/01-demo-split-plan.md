# Demo Split Plan — PR #3

> **Estado:** Documental. Sin código, sin SQL, sin Supabase, sin datos reales ni clínicos.
> **Rama:** `docs/host-demo-split-plan`
> **Fecha:** 2026-07-05
> **Propósito:** dejar claro qué piezas del demo (PR #3) se rescatan, cuáles se descartan y en qué orden, para que cualquier chat pueda ejecutar el siguiente split sin re-analizar los 56 archivos.
> **Ubicación:** `docs/host/` (no `docs/integration/`) para no conflictuar con el PR #10, que es dueño de esa carpeta. Cuando #10 se mergee, su orden de PRs debe referenciar este plan.

---

## 1. Estado del PR #3 (`demo/local-antifragil-os`)

### 1.1 Qué incluye (56 archivos, 4 bloques)

| Bloque | Archivos | Qué es |
|---|---|---|
| **Shell demo del host** | `components/demo/` (DemoShell, DemoSidebar, DemoTopbar, DemoContext, demoNav), `EnConstruccion.tsx`, cambios en `(app)/layout.tsx` y `app/layout.tsx` | Cascarón visual con sidebar/topbar y contexto global (proyecto + periodo + rol) |
| **Pantallas mock** | `components/demo/screens/` (6 pantallas + ScreenShell), `components/demo/panel/` (PanelDireccion, PanelKit, panelMock), `mock/demoData.ts`, cambios en las 7 `(app)/*/page.tsx` | Dashboards de demostración parametrizados por proyecto/periodo/rol; cifras marcadas como ilustrativas |
| **Reservas embebido (copia VIEJA)** | ~30 archivos en `apps/modules/reservas/**`, `ReservasClient.tsx`, `(app)/reservas/`, import de `reservas/src/index.css` en el root layout, dep `@alsari/reservas` en `package.json` + `next.config.ts`, `pnpm-lock.yaml` | Una copia **anterior y divergente** del módulo Reservas (la canónica vive en el PR #5) |
| **Demo-mode** | `lib/demo.ts`, bypass en `middleware.ts`, `.env.example` | Salta el gate de auth con `ANTIFRAGIL_DEMO_MODE=true` en local |

### 1.2 Por qué no se puede mergear entero

1. **Duplica Reservas:** arrastra una copia vieja de `apps/modules/reservas` que pisa la fuente canónica (PR #5). Decisión vigente D7/D8: Reservas canónico = PR #5; el demo no lo transporta.
2. **Bypass de auth:** el middleware salta la autenticación por variable de entorno. Aunque tiene doble guarda (`NODE_ENV !== 'production'`), es un mecanismo que no queremos en `main`.
3. **Toca `.env.example`** (prohibido por reglas de integración) y **lockfile + dependencias** por la dep de la copia vieja.
4. **Mezcla demo con producto:** el mismo PR cambia layout raíz, middleware, páginas legacy y añade pantallas mock — imposible de revisar y revertir por piezas.

### 1.3 Conflictos con otros PRs

- **Con PR #5:** conflicto directo en `apps/modules/reservas/**` y `pnpm-lock.yaml` (dos versiones del mismo módulo). Se resuelve NO extrayendo nunca ese bloque: #5 manda.
- **Con PR #16:** conflicto controlado en `app/layout.tsx` (metadata título, 2 líneas) y solapamiento conceptual del shell (resuelto: el shell canónico ya es el de #16).
- **Con PR #9 (rebrand visible):** sin solape de archivos (toca `apps/modules/financiero`), pero misma intención de copy; coordinar textos.

---

## 2. Piezas ya extraídas

### 5A — Host Shell básico → **PR #16 (hecho)**

- **Resolvió:** shell visual limpio (sidebar + topbar + navegación por grupos), route group `(app)/(os)` que no toca rutas legacy, placeholders para Reservas/Tesorería/Rentabilidad/Liquidaciones/Configuración con referencia al PR que alimentará cada módulo, rebrand visible mínimo del root layout (`title`/`description`), y el patrón `ModulePlaceholder` (equivalente limpio del `EnConstruccion` del demo).
- **Dejó fuera (deliberadamente):** todo el bloque Reservas embebido, demo-mode/`.env`/bypass de middleware, contexto global (proyecto/periodo/rol), pantallas mock con cifras, dependencias y lockfile.
- **Validación registrada:** type-check/lint/prettier ✅; `next build` compila y el prerender falla **igual que en main** sin credenciales Supabase (fallo preexistente de entorno).

### 5B — Plan de split/documentación → **este PR**

---

## 3. Piezas pendientes de extraer

| Pieza | Contenido origen (PR #3) | Valor | Condiciones de rescate |
|---|---|---|---|
| **5C — Contexto global mock seguro** | `DemoContext` (proyecto + periodo + rol) sin el demo-mode | Alto: el selector proyecto/periodo/rol es el patrón de navegación del OS real | Renombrar fuera de `demo/`; sin `lib/demo.ts`; el rol simulado debe rotularse "vista, no permisos"; integrarlo en el shell del PR #16 |
| **5D — Componentes visuales reutilizables** | `PanelKit` (tiles, badges, tablas), `ScreenShell`, ajustes de `BootScreen`/`LoginForm` (copy) | Medio-alto: son los átomos de UI Quiet Luxury que usarán los módulos reales | Sin datos incrustados; candidatos a `packages/ui` en vez de `apps/host` (decidir al extraer); copy coordinado con PR #9 |
| **5E — Dashboard mock sin datos reales** | `PanelDireccion` + `panelMock`/`demoData` + pantallas `screens/` | Medio: útil para enseñar el OS y como spec visual de los módulos | Revisar nombres antes de rescatar: el mock usa sociedad y centros reales (`Antifrágil S.C.`, `Clínica Playamar`, `9 A.M.`, `Lido Pro`) y nombres de profesionales; cifras ilustrativas OK, identidades a revisar con Fernando. Montarlo en las rutas placeholder del shell #16, **sin** tocar auth |
| **5F — Integración futura de Reservas desde PR #5** | (nada del PR #3) | Alto | Cuando #5 esté mergeado: dep `@alsari/reservas` + `ReservasClient` + página real montada en `/reservas` del shell. La dep y el lockfile entran AQUÍ, apuntando a la versión canónica, nunca a la copia del demo |
| **5G — Limpieza/cierre del PR #3** | — | — | Cuando 5C-5F estén mergeadas: comentario final en #3 con el mapa "qué pieza fue a qué PR" y **cierre sin merge** (autoriza Fernando; la rama/worktree se archiva, no se borra sin orden) |

Cada pieza = un PR Draft pequeño e independiente, en este orden (5C → 5D → 5E; 5F depende de #5; 5G al final).

---

## 4. Qué se descarta definitivamente del PR #3

1. **La copia antigua de `apps/modules/reservas/**`** (~30 archivos): la canónica es la del PR #5. No se extrae jamás.
2. **La dependencia `@alsari/reservas`** en `package.json`/`next.config.ts` **tal como está en #3** (apunta a la copia vieja). Se re-añadirá limpia en 5F contra la versión canónica.
3. **El demo-mode por variable de entorno** (`lib/demo.ts` + condicional en `(app)/layout.tsx`).
4. **El bypass de middleware/auth**: el gate de autenticación no se salta ni en local. Si hace falta demo sin backend, se decidirá otro mecanismo explícito (p. ej. build separado), nunca una env var sobre el middleware real.
5. **`.env.example`**: prohibido tocarlo desde ramas de integración.
6. **El import de `apps/modules/reservas/src/index.css` en el root layout** (acopla el host al código del módulo por ruta relativa).
7. **Los cambios de `pnpm-lock.yaml`** asociados a todo lo anterior.
8. **Mocks con identidades sin revisar**: cualquier dato que parezca real (nombres de profesionales, clientes, importes atribuibles) se sanea antes de rescatar 5E. Datos clínicos: no hay en #3 (verificado), y así debe seguir.

---

## 5. Criterios para rescatar una pieza (los 8 de la casa)

Una pieza del demo solo se extrae si cumple TODO:

1. Es **pequeña** (revisable en una pasada; orientativo: <15 archivos, sin mezclar bloques).
2. **No toca** el Reservas duplicado ni nada de `apps/modules/reservas`.
3. **No toca** Supabase (ni real ni cliente) ni SQL.
4. **No toca** `.env` / `.env.example`.
5. **No rompe ni rodea el auth** (middleware intacto).
6. **No añade dependencias** innecesarias (si añade alguna, justificada en el body y con lockfile mínimo).
7. **Compila**: `type-check` + `lint --max-warnings 0` + prettier sobre lo nuevo; build al menos igual de sano que main.
8. Nace como **PR Draft** con checklist de seguridad, y no se marca Ready sin orden del cockpit.

---

## 6. Orden recomendado de PRs (después del PR #16)

1. **PR #14** — quitar auto-merge del CI. **GATE absoluto**: nada se pone en verde ni se marca Ready antes (el CI verde dispararía merges automáticos con `--delete-branch`, letal con worktrees locales).
2. **Governance/QA/Integration** — #7 → #8 → #6 → #10 (tanda documental ya verificada sin conflictos cruzados).
3. **PR #16** — Host Shell (5A).
4. **Piezas 5C → 5D → 5E** — un PR Draft cada una, con este doc como spec.
5. **PR #5** — Reservas canónico (tras QA), y después **5F** (montaje en el shell).
6. **5G** — cierre del PR #3 sin merge, cuando todo lo útil esté extraído y mergeado.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Conflicto con PR #5 (Reservas duplicado) | Regla dura: nada de `apps/modules/reservas` sale del PR #3 |
| Conflicto con PR #16 (`app/layout.tsx`, shell) | El shell canónico es #16; 5C/5D/5E se montan SOBRE él, no crean otro |
| Duplicidad de rutas (`/finanzas` vs `/financiero`, `/facturacion` vs `/facturas`) | Convención fijada en #16: se respetan las rutas existentes del host |
| Bypass de auth colándose en un split | Criterio 5.5 + grep de `ANTIFRAGIL_DEMO_MODE`/`isDemoMode` en cada split |
| Dependencia vieja de Reservas reintroducida | `@alsari/reservas` solo entra en 5F, tras merge de #5 |
| Lockfile inflado | Splits 5C/5D/5E no deben tocar `pnpm-lock.yaml` en absoluto |
| Mocks demasiado realistas | Revisión de identidades con Fernando antes de 5E (§4.8) |
| Mezclar demo con producto | Todo lo mock vive rotulado ("Datos de demostración · sin backend") y montado en rutas placeholder, nunca en las legacy |
| CI verde prematuro | La deuda de `format:check` (~227 archivos según CI) la trabaja la línea `ci/quality-gates-hardening`, que debe mergear DESPUÉS de #14; ningún split formatea archivos ajenos a su pieza |

## 8. Checklist copiable para próximos splits (5C/5D/5E/5F)

```markdown
## Checklist split 5X — [nombre]
- [ ] Rama nueva desde main: `feat/host-[pieza]` · worktree propio `wt-host-[pieza]`.
- [ ] Leído docs/host/01-demo-split-plan.md (este doc) y el estado real de PRs (`gh pr list`).
- [ ] Solo archivos del bloque de la pieza; <15 archivos; sin mezclar bloques.
- [ ] 0 archivos en apps/modules/reservas/**.
- [ ] Sin cambios en package.json / next.config.ts / pnpm-lock.yaml (excepción justificada solo en 5F).
- [ ] Sin lib/demo.ts, sin isDemoMode, sin cambios en middleware.ts, sin .env*.
- [ ] Sin Supabase, sin SQL, sin packages/supabase-client, sin services/**.
- [ ] grep -RniE "ANTIFRAGIL_DEMO_MODE|isDemoMode|service_role|anon key" [archivos] → limpio.
- [ ] grep clínico (diagnóstico|lesión|tratamiento|...) → limpio; identidades del mock revisadas.
- [ ] corepack pnpm --filter @alsari/host type-check ✅ · lint ✅ · prettier sobre lo nuevo ✅.
- [ ] build ≥ igual de sano que main (documentar si main ya falla por entorno).
- [ ] Commit semántico + push con workaround de credencial si hace falta.
- [ ] PR **Draft** con body: Estado / Incluye / No incluye / Relación (#3, #5, #16) / Checklist.
- [ ] NO marcar Ready. NO mergear. Reportar al cockpit.
```

---

*Documento de integración visual. No modifica código. El PR #3 permanece DRAFT / NO MERGE hasta completar 5C-5G.*
