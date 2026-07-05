# 03 · Git Workflow

> Protocolo de trabajo con Git y GitHub para Alsari Capital OS.
> **Disciplina notarial:** ningún cambio entra a `main` sin pasar por el flujo completo.

---

## 🎯 Filosofía

> _"Cada commit es un asiento contable: trazable, justificado, irreversible sin proceso."_

`main` es producción. Lo que está en `main` se asume **funcional, probado y aprobado
por Guille**. Si rompemos esa premisa, perdemos la confianza en el sistema.

---

## 🌳 Ramas

### Estructura

```
main                    # ← Producción. Solo merges aprobados por Guille.
└── develop             # ← (Opcional, solo si crecemos a equipo) Integración previa.
    ├── feat/xxx        # ← Nueva funcionalidad
    ├── fix/xxx         # ← Corrección de bug
    ├── chore/xxx       # ← Tareas de mantenimiento (deps, configs)
    ├── docs/xxx        # ← Solo documentación
    ├── refactor/xxx    # ← Refactor sin cambios funcionales
    └── exp/xxx         # ← Experimentos (se borran si no cuajan)
```

**Para el arranque del proyecto (Guille solo):** trabajamos directo sobre `main` con
ramas `feat/...` puntuales. No usamos `develop` hasta que haya más de una persona.

### Nombrado de ramas

```
<tipo>/<modulo-o-area>-<descripcion-corta>
```

Ejemplos:

- `feat/financiero-kpi-cards`
- `fix/host-error-boundary-leak`
- `chore/deps-update-react-19`
- `docs/arquitectura-modulo-facturas`
- `refactor/utils-format-currency`

---

## 💾 Commits

### Formato (Conventional Commits)

```
<tipo>(<scope>): <descripción corta en imperativo>

<cuerpo opcional con más contexto>

<footer opcional: refs, breaking changes>
```

### Tipos permitidos

| Tipo       | Cuándo usar                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | Nueva funcionalidad visible para el usuario             |
| `fix`      | Corrección de bug                                       |
| `chore`    | Mantenimiento (deps, configs, scripts)                  |
| `docs`     | Solo cambios en documentación                           |
| `refactor` | Reorganización de código sin cambios funcionales        |
| `test`     | Añadir o corregir tests                                 |
| `style`    | Formato, espacios, punto y coma (sin cambios de lógica) |
| `perf`     | Mejoras de rendimiento                                  |
| `build`    | Cambios en sistema de build, dependencias               |
| `ci`       | Cambios en CI/CD                                        |

### Scopes recomendados

- `host` → cambios en `apps/host/`
- `financiero` / `facturas` / `proyectos` → módulos
- `ui` / `utils` / `types` / `config` → packages
- `db` → migraciones, cambios en Supabase
- `docs` → documentación maestra

### Ejemplos

✅ Buenos:

```
feat(financiero): añadir cálculo de TIR con tests
fix(host): evitar fuga de memoria en error boundary
chore(deps): actualizar tailwind a v4
docs(arquitectura): documentar registro de módulos
refactor(ui): extraer GlassPanel a componente reutilizable
```

❌ Malos:

```
update                        # ← ¿Qué se actualizó?
fix bug                       # ← ¿Qué bug?
WIP                           # ← Nunca commits WIP en ramas que se mergean
arreglos varios               # ← Mezcla de cosas; sepáralas en commits distintos
```

### Reglas

1. **Un commit = un cambio lógico.** No mezcles refactor con feature.
2. **Imperativo presente** ("añadir", no "añadido" ni "añade").
3. **Línea de asunto ≤ 72 caracteres.**
4. **Cuerpo si hace falta explicar el "por qué".** El "qué" ya está en el diff.

---

## 🔄 Flujo de trabajo paso a paso

### Para una nueva funcionalidad

```powershell
# 1. Asegúrate de partir de main actualizado
git checkout main
git pull origin main

# 2. Crea rama con nombre claro
git checkout -b feat/financiero-kpi-cards

# 3. Trabaja. Haz commits pequeños y atómicos.
git add src/components/KPICard.tsx
git commit -m "feat(financiero): añadir componente KPICard base"

git add src/components/KPICard.test.tsx
git commit -m "test(financiero): tests para KPICard"

# 4. Empuja la rama
git push -u origin feat/financiero-kpi-cards

# 5. Abre un Pull Request en GitHub.
#    Título: "feat(financiero): KPI Cards en el dashboard"
#    Cuerpo: usa la plantilla de PR (auto-rellenada).

# 6. Espera revisión y aprobación de Guille.

# 7. Una vez aprobado, merge a main (squash o merge commit, según el tamaño).

# 8. Borra la rama local y remota.
git checkout main
git pull origin main
git branch -d feat/financiero-kpi-cards
git push origin --delete feat/financiero-kpi-cards
```

---

## 🚦 Reglas innegociables

1. **NUNCA `git push --force` a `main`.** Si hace falta arreglar `main`, se hace
   con `revert`, no con reescritura de historial.
2. **NUNCA merge sin aprobación explícita de Guille.** "Vale, mergea" es suficiente
   como aprobación verbal en chat, pero debe quedar registro.
3. **NUNCA commits con secrets.** Si por error un secret entra al repo, rotar la
   credencial inmediatamente (no basta con borrarla del commit).
4. **NUNCA `.env` al repo.** Solo `.env.example` con placeholders.
5. **Si una rama lleva >7 días sin tocar**, rebase con `main` o ciérrala.

---

## 🔧 Configuración recomendada en local

### `.gitconfig` mínimo

```ini
[user]
    name = Tu Nombre
    email = tu@email.com

[core]
    autocrlf = true                  # Windows: convierte LF↔CRLF
    editor = code --wait

[init]
    defaultBranch = main

[pull]
    rebase = false                   # Merge commits por defecto

[push]
    autoSetupRemote = true           # Crea remote tracking automáticamente
```

### Configuración de Antigravity / Claude Code

Antigravity con Claude Code lee automáticamente `CLAUDE.md` y `.claude/`. Asegúrate de:

- Tener Claude Code activado en el workspace.
- No ignorar `.claude/` en `.gitignore` (esos archivos van al repo).

---

## 📋 Pull Requests

### Plantilla (se carga automáticamente desde `.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## ¿Qué cambia?

<!-- Resumen de 2-3 líneas -->

## ¿Por qué?

<!-- Contexto de negocio o técnico -->

## Cambios principales

- [ ] ...

## Cómo probarlo

1. ...
2. ...

## Capturas / Videos

<!-- Si afecta a UI -->

## Checklist

- [ ] Tests añadidos/actualizados
- [ ] Documentación actualizada (ARQUITECTURA, CHANGELOG)
- [ ] Sin warnings de ESLint/TS
- [ ] Probado en local
- [ ] Lessons learned actualizado si aplica
```

### Tamaño ideal de un PR

- **Pequeño** (< 200 líneas modificadas): se revisa rápido, se mergea sin fricción.
- **Mediano** (200-500 líneas): aceptable si es coherente.
- **Grande** (> 500 líneas): bandera roja. Probablemente debería ser varios PRs.

---

## 🏷️ Tags y versiones

Cuando alcancemos hitos relevantes (primer despliegue, primer módulo en producción),
usamos tags semver:

```powershell
git tag -a v0.1.0 -m "Primer despliegue del Host OS"
git push origin v0.1.0
```

- **MAJOR** (`v1.0.0`): cambios incompatibles.
- **MINOR** (`v0.2.0`): nuevas funcionalidades retrocompatibles.
- **PATCH** (`v0.1.1`): bugfixes.

---

## ⚠️ Recuperación de errores comunes

### "Commiteé en main por error"

```powershell
# Mueve el commit a una rama nueva
git branch feat/lo-que-hice
git reset --hard HEAD~1     # Quita el commit de main (CUIDADO si ya hiciste push)
git checkout feat/lo-que-hice
```

### "Necesito deshacer mi último commit pero ya hice push"

```powershell
git revert HEAD             # Crea un commit que deshace el anterior
git push                    # Push normal (NO force)
```

### "Mi rama está desfasada respecto a main"

```powershell
git checkout feat/mi-rama
git fetch origin
git rebase origin/main      # Reaplica tus commits sobre el main actualizado
# Resuelve conflictos si los hay
git push --force-with-lease # Solo a TU rama, NUNCA a main
```

---

## 📌 Resumen de una línea

> _"Ramas claras, commits semánticos, merges con aprobación, sin force-push a main,
> sin secrets, sin sorpresas."_
