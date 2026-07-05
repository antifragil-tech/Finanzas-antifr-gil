# 05 — Protección de la rama `main`

> Política de protección de `main` y runbook para configurarla en GitHub.
> Complementa la regla suprema del proyecto: **ningún merge sin autorización
> explícita de Guille**.

---

## 1. Política

1. **`main` no acepta pushes directos.** Todo cambio entra por Pull Request.
2. **Require pull request before merging.** Sin excepciones, ni para admins.
3. **Require 1 approval** como mínimo antes de poder mergear.
4. **Block force pushes.** Nadie reescribe la historia de `main`.
5. **Require conversation resolution.** No se mergea con hilos de revisión
   abiertos.
6. **No auto-merge.** El auto-merge de GitHub queda deshabilitado a nivel de
   repositorio, y el CI no debe contener jobs que mergeen PRs (eliminado en
   PR #14).
7. **No borrado automático de ramas al mergear.** Mientras existan worktrees
   locales apuntando a esas ramas, el borrado automático rompe los worktrees.
   Las ramas se borran manualmente cuando su worktree se haya retirado.
8. **Merges manuales y explícitos.** Squash merge ejecutado por una persona,
   tras autorización expresa, nunca por un bot o un workflow.

## 2. Runbook — configurar en GitHub (UI clásica)

1. Ir a `Settings` → `Branches`.
2. Pulsar `Add branch protection rule` (o `Add classic branch protection rule`
   si la UI ofrece Rulesets como opción principal).
3. En **Branch name pattern**: `main`.
4. Activar:
   - ✅ `Require a pull request before merging`
     - `Required approvals`: **1**
   - ✅ `Require conversation resolution before merging`
   - ✅ `Require status checks to pass before merging` → seleccionar
     `Quality Gates` (job del workflow CI) cuando el CI esté en verde.
   - ✅ `Do not allow bypassing the above settings`
5. Verificar que quedan **desactivados**:
   - ❌ `Allow force pushes`
   - ❌ `Allow deletions`
6. Guardar con `Create` / `Save changes`.

### 2b. Si la UI usa Rulesets

1. `Settings` → `Rules` → `Rulesets` → `New ruleset` → `New branch ruleset`.
2. `Ruleset name`: `proteccion-main`. `Enforcement status`: **Active**.
3. `Target branches` → `Add target` → `Include default branch`.
4. Activar las reglas:
   - ✅ `Restrict deletions`
   - ✅ `Require a pull request before merging` (1 approval, conversation
     resolution)
   - ✅ `Require status checks to pass` → `Quality Gates`
   - ✅ `Block force pushes`
5. No añadir bypasses (lista de bypass vacía, tampoco para admins).

### 2c. Ajustes generales del repositorio

En `Settings` → `General` → `Pull Requests`:

- ❌ Desactivar `Allow auto-merge`.
- ❌ Desactivar `Automatically delete head branches` (rompería los worktrees
  locales activos).
- ✅ Mantener habilitado solo `Allow squash merging` (historia limpia).

## 3. Orden recomendado de integración — tanda 1

Con todos los PRs en Draft, el orden seguro de merge (uno a uno, verificando
CI y worktrees tras cada merge) es:

1. **PR #14** — `ci/disable-auto-merge` (elimina el job auto-merge del CI).
2. **PR #7** — Governance.
3. **PR #8** — Lessons.
4. **PR #6** — QA smoke suite.
5. **PR #10** — Integration master plan.

Después de la tanda 1, el PR de saneo de formato (este) se mergea **antes**
de reanudar trabajo de features, y las ramas de features abiertas se rebasan
o se regeneran para absorber el reformateo y evitar conflictos.

## 4. Deuda registrada

- `packages/supabase-client/` y `services/supabase/` mantienen deuda de
  formato y están excluidos temporalmente en `.prettierignore` porque son
  zonas intocables sin autorización expresa. Al formatearlos en un PR
  autorizado, eliminar sus entradas del `.prettierignore`.

---

**Última actualización:** 2026-07-05 (rama `ci/quality-gates-hardening`).
