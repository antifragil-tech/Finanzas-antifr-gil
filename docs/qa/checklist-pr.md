# Checklist QA · Revisión de un PR

> Rellenar a mano por quien revisa el PR antes de aprobarlo. Complementa `docs/integration/04-checklist-merge.md`.

**PR:** \***\*\_\_\_\_\*\*** **Rama origen:** \***\*\_\_\_\_\*\*** **Destino:** `main` **Revisor:** \***\*\_\_\_\_\*\***

## Alcance del diff

- [ ] **Diff acotado**: solo las rutas esperadas para este PR (sin archivos sorpresa)
- [ ] El PR es **Draft** mientras se revisa
- [ ] Respeta el orden de `docs/integration/01-orden-prs.md`

## Seguridad / datos

- [ ] **Sin `.env`** ni `.env.local` (solo `.env.example` permitido)
- [ ] **Sin claves** (service_role, anon key hardcodeada, JWT, DB_PASSWORD, private keys)
- [ ] **Sin datos reales** (clientes, IBAN, CIF, importes reales)
- [ ] **Sin datos clínicos** (diagnósticos, lesiones, tratamientos, historia clínica — ni en mocks)
- [ ] `packages/supabase-client` **no tocado** (salvo PR específico autorizado)
- [ ] Rebranding `@alsari/*` **no incluido** (salvo PR 8 específico)
- [ ] Pasó `node scripts/qa/check-no-secrets.mjs` sobre el diff/rama → sin hallazgos
- [ ] Pasó `node scripts/qa/check-legacy-strings.mjs` → sin legacy **visible** nuevo
- [ ] Pasó `node scripts/qa/check-no-clinical-data.mjs` → sin términos clínicos en código/mocks
- [ ] Pasó `node scripts/qa/check-pr-scope.mjs` (en la rama del PR) → sin rutas peligrosas inesperadas

## Calidad (ejecutadas y en verde)

- [ ] **Lint** ok (`pnpm lint`)
- [ ] **Type-check** ok (`pnpm type-check`)
- [ ] **Build host** ok (`pnpm build --filter=@alsari/host`) si aplica
- [ ] **Lockfile** coherente y **regenerado** con `pnpm install` (no fusionado a mano)
- [ ] Sin marcadores de conflicto en ningún archivo

## Producto (no rompe lo que ya funciona)

- [ ] **No rompe la navegación** del host (sidebar/topbar/rutas)
- [ ] **No rompe el demo** (`checklist-demo.md` sigue en verde)
- [ ] **No rompe reservas** (`checklist-reservas.md` sigue en verde)
- [ ] **No rompe el baseline** de DB (`checklist-db-baseline.md` si aplica)
- [ ] Supabase **no tocado** salvo que sea el PR específico de Supabase

## Funcional

- [ ] **Rutas** afectadas responden (ver `smoke-routes.mjs` y `checklist-demo.md`)
- [ ] Si es reservas/demo: **screenshots** adjuntos al PR

## Resultado

- [ ] **APROBADO para salir de Draft** (todos los aplicables en verde)
- [ ] **DEVUELTO** a la rama origen — motivo: **\*\*\*\***\*\*\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\*\*\***\*\*\*\***
