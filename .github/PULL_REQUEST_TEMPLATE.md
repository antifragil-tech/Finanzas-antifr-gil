<!-- ────────────────────────────────────────────────────────────────────
     Pull Request — Antifrágil OS
     Rellena cada sección. Si una no aplica, escribe "N/A".
     Proceso: docs/governance/02-pr-draft-process.md
     ──────────────────────────────────────────────────────────────────── -->

## Tipo de PR

- [ ] `docs` — documentación / governance
- [ ] `feat` — funcionalidad nueva
- [ ] `fix` — corrección
- [ ] `refactor` — cambio interno sin afectar comportamiento
- [ ] `chore` — mantenimiento (deps, configs, infraestructura)
- [ ] `qa` / `test` — tests / smoke / checklists
- [ ] `demo` — demo / mock (por defecto **NO MERGE**)

## Rama

<!-- Nombre de la rama y de qué rama nace (normalmente main). -->

## Resumen

<!-- Qué hace este PR y por qué, en 3-5 líneas. Lo que verá Guille en la lista de PRs. -->

## Alcance

<!-- Lista exacta de carpetas/archivos que toca y qué cambia en cada uno. -->

## Fuera de alcance

<!-- Qué NO hace este PR aunque esté relacionado (y dónde/cuándo se hará). -->

## Cómo probarlo

<!-- Pasos. Si es solo docs: N/A. Si afecta a UI: capturas o vídeo corto. -->

---

## Checklist técnico

- [ ] Diff acotado 1:1 al alcance declarado.
- [ ] `pnpm lint` limpio en los paquetes tocados (o N/A si solo docs).
- [ ] `pnpm type-check` limpio en los paquetes tocados (o N/A si solo docs).
- [ ] `pnpm build` de lo afectado sin errores (o N/A si solo docs).
- [ ] Smoke routes OK (o N/A si solo docs).
- [ ] `pnpm-lock.yaml`: sin cambios, o **regenerado** con pnpm (nunca editado/resuelto a mano).
- [ ] Commits semánticos.
- [ ] Sin `console.log`, `it.only`, ni TODOs sin issue asociada.

## Checklist seguridad

- [ ] Sin claves, tokens, service accounts ni connection strings.
- [ ] Sin `.env` ni variantes en el diff.
- [ ] Sin SQL aplicado a ninguna base de datos (los `.sql` viajan como archivos + runbook).
- [ ] Sin tocar el Supabase real (ni legacy ni futuro).
- [ ] Sin tocar `packages/supabase-client`.

## Checklist compliance

- [ ] Sin datos reales (personas, CIFs, IBANs, teléfonos, emails personales).
- [ ] Sin datos clínicos ni terminología clínica (ver `docs/compliance/00`).
- [ ] Sin historia clínica ni contenido clínico copiado/embebido.
- [ ] Campos libres nuevos (si los hay): naming no clínico + microcopy de aviso.
- [ ] Enlaces externos: solo ID/URL de referencia, sin contenido.

## Checklist QA / proceso

- [ ] Checklist de revisión (`docs/governance/03-review-checklist.md`) pasada.
- [ ] Checklist específica del tipo de PR (demo/reservas/baseline) pasada, si aplica.
- [ ] Master tracker (`docs/governance/00-master-tracker.md`) actualizado con este PR.
- [ ] `docs/CHANGELOG.md` actualizado bajo `[Unreleased]` (si aplica).
- [ ] `docs/ARQUITECTURA.md` actualizado si cambia arquitectura.
- [ ] Si hubo error/corrección durante la sesión: entrada en `lessons-learned/log.md`.
- [ ] ¿Requiere ADR? — [ ] No · [ ] Sí, añadido en `docs/decisiones/NNNN-titulo.md`.

---

## Confirmaciones explícitas (obligatorias)

- [ ] **Sin datos reales.**
- [ ] **Sin datos clínicos.**
- [ ] **Sin historia clínica.**
- [ ] **Sin `.env`.**
- [ ] **Sin claves.**
- [ ] **Sin SQL aplicado.**
- [ ] **Sin Supabase real.**
- [ ] **No toca `main`.**
- [ ] **Este PR está en Draft** si no está listo (Ready solo tras revisión + QA; merge solo
      con autorización explícita de Guille).

---

<!-- Espacio para discusión con Guille -->
