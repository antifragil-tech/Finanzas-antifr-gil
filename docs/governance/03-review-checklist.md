# 03 — Checklist universal de revisión de PRs · Antifrágil OS

> Se aplica a **todo** PR antes de marcarlo Ready for review. El revisor copia esta checklist
> en un comentario del PR y marca cada punto. Un punto en rojo = el PR vuelve a Draft.

---

## A. Alcance

- [ ] El **diff está acotado** al alcance declarado en el body del PR (1:1, sin archivos colados).
- [ ] No toca `main` ni reescribe historia (sin rebase/force push).
- [ ] Si es docs: no toca código. Si es código: declara qué módulos toca y por qué.

## B. Seguridad

- [ ] **Sin datos reales** (nombres de pacientes/clientes, CIFs, IBANs, teléfonos, emails personales).
- [ ] **Sin datos clínicos** ni terminología clínica en campos, fixtures o ejemplos
      (ver `docs/compliance/00-alcance-administrativo-operativo.md`).
- [ ] **Sin historia clínica** ni enlaces con contenido clínico embebido.
- [ ] **Sin `.env`** ni variantes (`.env.local`, `.env.production`, `.dev.vars`) en el diff.
- [ ] **Sin claves/secrets** (API keys, tokens, service accounts, connection strings, JWTs).
- [ ] **Sin tocar Supabase real** (ni SQL aplicado, ni seeds contra remoto, ni proyecto legacy).
- [ ] **Sin SQL aplicado**: los `.sql` viajan como archivos + runbook, nunca ejecutados.
- [ ] **Sin tocar `packages/supabase-client`**.

## C. Técnico

- [ ] `pnpm lint` limpio en los paquetes tocados.
- [ ] `pnpm type-check` (o `tsc --noEmit` por filtro) limpio en los paquetes tocados.
- [ ] `pnpm build` de los paquetes afectados termina sin errores.
- [ ] **Smoke routes**: las rutas del host responden tras el cambio (suite QA, no destructiva).
- [ ] **Lockfile coherente**: `pnpm-lock.yaml` solo cambia si cambió un `package.json`, y fue
      **regenerado** con pnpm (nunca editado a mano).
- [ ] Sin legacy visible nuevo: no se introduce "Alsari" en UI/strings visibles.

## D. Proceso

- [ ] El PR está (o estuvo hasta ahora) en **Draft**.
- [ ] Usa la plantilla de PR con las confirmaciones explícitas marcadas.
- [ ] Commits semánticos y temáticos.
- [ ] El [master tracker](00-master-tracker.md) refleja este PR (fila actualizada).
- [ ] Si cambia arquitectura/decisiones: `docs/ARQUITECTURA.md` o ADR actualizado.

## E. Compliance (si el PR toca datos, modelos o UI de clientes/citas)

- [ ] Campos libres con regla de contenido administrativo (ver `docs/compliance/00`, §campos libres).
- [ ] Ningún campo nuevo capaz de almacenar contenido clínico sin control.
- [ ] Enlaces a sistemas externos: solo ID/URL de referencia, nunca contenido copiado.

---

**Resultado de la revisión:** ✅ Ready · 🔴 Vuelve a Draft (indicar puntos fallidos) · 🧊 NO MERGE intencional
