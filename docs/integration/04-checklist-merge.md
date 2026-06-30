# 04 · Checklist universal antes de cualquier merge

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha: 2026-06-30
> Aplica a **todo** PR antes de integrarse a `main`. Si **un** ítem falla → **no se mergea**.

## A. Coordinación (por el `.git` compartido)

- [ ] **Una sola rama en integración** en este momento (no hay otro merge en curso).
- [ ] **Resto de chats pausados para git**: nadie más hace commit/push/rebase mientras dura el merge.
- [ ] Snapshot/checkpoint en disco hecho antes de empezar (por seguridad del working copy compartido).
- [ ] El PR respeta el **orden** de `01-orden-prs.md` (p. ej. reservas **antes** que cualquier pieza host de demo).

## B. Alcance del diff

- [ ] El diff está **acotado** a las rutas esperadas del PR (sin archivos sorpresa).
- [ ] **Sin `.env`** ni `.env.local` (solo se admite `.env.example`).
- [ ] **Sin claves/secretos** (service_role, anon key hardcodeada, JWT largos, passwords, private keys).
- [ ] **Sin datos reales** (clientes, IBAN, CIF, nombres reales). Solo mock/demo.
- [ ] **`packages/supabase-client` NO tocado** (salvo que sea el PR 9 específico, hoy diferido).
- [ ] **Rebranding `@alsari/*` NO incluido** (salvo PR 8 específico, hoy diferido).

## C. Calidad (ejecutar y que pasen)

- [ ] **`pnpm install`** ejecutado → `pnpm-lock.yaml` **regenerado** y coherente (no fusionado a mano).
- [ ] **Lint:** `pnpm lint` (o `turbo run lint`) sin warnings.
- [ ] **Type-check:** `pnpm type-check` limpio.
- [ ] **Build host:** `pnpm build --filter=@alsari/host` ok (Next transpila `@alsari/reservas` si aplica).
- [ ] Si el PR toca un módulo Vite: `pnpm --filter @alsari/<módulo> type-check` ok.

## D. Smoke de rutas (cuando el PR toca host/demo)

- [ ] Con `ANTIFRAGIL_DEMO_MODE=true` y `NODE_ENV≠production`, las rutas responden 200:
      `/`, `/reservas`, `/financiero`, `/rentabilidad`, `/contabilidad`, `/presupuestos`, `/configuracion`, `/facturas`.
- [ ] Banner/etiqueta **"DATOS DE DEMOSTRACIÓN"** visible en modo demo.
- [ ] **Sin legacy visible**: no aparece "Alsari", "Pavier", "Armia", "Rialsa" en pantalla.
- [ ] `/reservas` monta el módulo con `ssr:false` sin error de `window` (DayPilot).
- [ ] **Sin la flag**, el host se comporta **igual que `main`** (auth real intacta, sin shell demo).

## E. Supabase / SQL (en esta fase)

- [ ] **Sin Supabase real** tocado.
- [ ] **Sin SQL aplicado** (las migraciones/baseline son ficheros versionados, no ejecutados).
- [ ] Si el PR es el baseline (PR 6): diff solo bajo `services/supabase/baselines/antifragil_os/`; `SECURITY_CHECKLIST.md` revisado.

## F. Lockfile

- [ ] `pnpm-lock.yaml` **coherente** con los `package.json` del árbol.
- [ ] **Sin marcadores de conflicto** (`<<<<<<<`, `=======`, `>>>>>>>`) en ningún archivo.
- [ ] Ningún cambio de versión inesperado tras `pnpm install` (si lo hay → parar y revisar).

## G. Revisión

- [ ] **PR revisado** por al menos una persona / PM de integración.
- [ ] PR estaba en **Draft**; se pasa a "Ready" solo al cumplir todo lo anterior.
- [ ] Screenshots adjuntos si el PR afecta UI (demo/reservas).
- [ ] `git status` final **limpio o explicado** en el PR.

---

## Resultado
- ✅ **Todos** los ítems aplicables marcados → se puede proponer el merge (lo ejecuta quien tenga ese rol, no este documento).
- ❌ **Cualquier** ítem fallido → **no se mergea**; se devuelve a la rama origen con el motivo.

> Recordatorio de límites de fase: **no push, no force-push, no rebase, no tocar `main` directamente, no Supabase real, no SQL aplicado, no `.env`, no claves, no datos reales.**
