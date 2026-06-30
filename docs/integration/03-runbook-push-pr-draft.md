# 03 · Runbook — subir una rama y abrir un PR Draft (paso a paso)

> Plan maestro de integración — Antifrágil OS
> Autor: Chat 4 (Integration PM documental) · Fecha: 2026-06-30
> Pensado para **alguien no experto**. Copia y pega los comandos **en orden** y lee la salida antes de seguir.
> Este runbook **solo sube ramas y abre PR Draft**. **No** mergea, **no** rebasa, **no** toca `main`.

## Antes de empezar (contexto importante)

- Trabajamos con **varios worktrees sobre el mismo repo**. Cada worktree tiene **su** rama.
- **Nunca** trabajes en el worktree de otro chat. Comprueba siempre en qué rama estás.
- Si algo no cuadra (rama equivocada, cambios que no son tuyos, conflicto), **PARA y pregunta**. No improvises con git.

## Paso 0 — Situarte en tu worktree

Abre una terminal **en la carpeta de tu worktree** (ejemplo Chat 1):

```
cd "c:/Users/javiv/Desktop/Antifragil Finanzas/wt-reservas-agenda-hoy"
```

## Paso 1 — Comprobar en qué rama estás

```
git branch --show-current
```

✅ Debe imprimir **tu** rama (ej. `feat/reservas-agenda-hoy`).
❌ Si imprime `main` u otra rama → **PARA**. No sigas.

## Paso 2 — Comprobar el estado del working tree

```
git status
```

Lee con calma:
- ✅ "nothing to commit, working tree clean" → perfecto, puedes subir.
- ⚠️ Hay archivos "modified"/"untracked" que **son tuyos y esperados** → commitéalos primero (Paso 3).
- ❌ Aparecen archivos que **no reconoces**, o `.env`, o claves → **PARA**. No los subas.

## Paso 3 — (Si hace falta) commitear tus cambios

Revisa exactamente qué vas a incluir:

```
git diff --stat
```

Añade **solo** lo que es tuyo y permitido (evita `git add .` a ciegas):

```
git add docs/ apps/modules/reservas/
git status
```

Confirma que **no** hay `.env`, claves ni archivos ajenos en "Changes to be committed". Luego:

```
git commit -m "feat(reservas): ..."
```

## Paso 4 — Revisar qué subes respecto a `main`

```
git log --oneline main..HEAD
git diff --stat main..HEAD
```

✅ Deben aparecer **solo tus commits** y **solo tus archivos**.
❌ Si ves archivos de otra línea o de zonas prohibidas → **PARA**.

## Paso 5 — Buscar secretos antes de subir (obligatorio)

```
git diff main..HEAD | grep -iE "service_role|SUPABASE_SERVICE|DB_PASSWORD|BEGIN .*PRIVATE KEY|eyJhbGciOi" || echo "OK: sin patrones de secreto"
```

✅ "OK: sin patrones de secreto" → sigue.
❌ Si imprime algo → **PARA**, no subas, reporta el hallazgo (sin copiar el secreto).

> Recuerda: el `.gitignore` ya excluye `.env`, `.env.local`, etc. Aun así, comprueba: nunca subas un archivo `.env*` que no sea `.env.example`.

## Paso 6 — Subir (push) tu rama por primera vez

```
git push -u origin HEAD
```

- `HEAD` empuja **la rama actual** con su mismo nombre. Es seguro: no toca `main`.
- Si ya existía en remoto y git pide `--force` → **PARA**. **Nunca** uses `--force` (ver "Qué NO hacer").

## Paso 7 — Abrir el Pull Request en modo Draft

Con GitHub CLI (`gh`):

```
gh pr create --draft --base main --head <tu-rama> --title "<título>" --body "<descripción breve>"
```

Ejemplo:

```
gh pr create --draft --base main --head feat/reservas-agenda-hoy \
  --title "feat(reservas): módulo Agenda Hoy por profesional (canónico)" \
  --body "Módulo @alsari/reservas. Ver docs/integration/01-orden-prs.md (PR 4)."
```

- `--draft` → el PR queda **en borrador**: visible y revisable, pero **no mergeable** por accidente.
- `--base main` → destino correcto.
- Si no tienes `gh`, abre el PR desde la web de GitHub y marca **"Create draft pull request"**.

## Paso 8 — Verificar el PR

```
gh pr view --web
```

Comprueba en la web:
- El PR es **Draft**.
- El diff contiene **solo** tus archivos.
- No hay `.env` ni claves en "Files changed".

---

## ✅ Comandos seguros (resumen)

| Acción | Comando |
|---|---|
| Ver rama actual | `git branch --show-current` |
| Ver estado | `git status` |
| Ver qué subes | `git log --oneline main..HEAD` · `git diff --stat main..HEAD` |
| Subir rama | `git push -u origin HEAD` |
| Abrir PR draft | `gh pr create --draft --base main --head <rama> ...` |

## ⛔ Qué NO hacer (nunca)

- ❌ **No** `git merge` ni `git rebase` (la integración la coordina el PM, una rama a la vez).
- ❌ **No** `git push --force` / `--force-with-lease` (puede borrar trabajo de otros; el `.git` es compartido).
- ❌ **No** `git push origin main` ni hacer push estando en `main`.
- ❌ **No** subir `.env`, `.env.local`, claves, tokens ni datos reales.
- ❌ **No** `git add .` a ciegas: añade rutas concretas y revisa `git status`.
- ❌ **No** trabajar en el worktree de otro chat.
- ❌ **No** marcar "Ready for review" / quitar el Draft sin que el PM lo apruebe.
- ❌ **No** resolver conflictos de `pnpm-lock.yaml` a mano (se regenera, ver `02-matriz-conflictos.md`).

## Si algo falla
- Cualquier mensaje con "merge conflict", "rejected", "non-fast-forward", "force" → **PARA** y reporta. No fuerces.
- Ver `05-registro-riesgos.md` para el contexto de por qué somos tan estrictos con git.
