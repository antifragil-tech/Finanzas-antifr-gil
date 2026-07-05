---
name: git-protocol
description: Protocolo notarial de Git en Alsari Capital OS. Cárgalo antes de hacer cualquier commit, branch, merge o push. Define el flujo estricto que protege main y mantiene historia limpia.
---

# Protocolo Git — Alsari Capital OS

> Disciplina notarial de Git. Cero excepciones.
> Detalle completo en `.claude/docs/ways-of-working/03-git-workflow.md`.

---

## 🛑 Reglas absolutas (memorizar)

1. **NUNCA tocar `main` directamente.** Toda nueva tarea = rama nueva.
2. **NUNCA `git push --force` a `main`.** Si hay que arreglar `main`, `git revert`.
3. **NUNCA mergear sin aprobación explícita de Guille en chat.**
4. **NUNCA commitear `.env` ni secrets.** Si entra por error → rotar credencial.
5. **NUNCA commits WIP en ramas que se van a mergear.** Limpia con squash o rebase.

---

## 🔄 Flujo estándar para una nueva tarea

```powershell
# 1. Sincronizar main
git checkout main
git pull origin main

# 2. Crear rama nueva con naming convention
git checkout -b <tipo>/<area>-<descripcion-corta>
# Ejemplos:
#   feat/financiero-kpi-cards
#   fix/host-error-boundary
#   chore/deps-update-react-19

# 3. Trabajar y commitear con Conventional Commits
git add <archivos>
git commit -m "feat(financiero): añadir cálculo de TIR"

# 4. Push de la rama
git push -u origin <nombre-rama>

# 5. Abrir PR en GitHub con plantilla
# 6. Esperar OK de Guille
# 7. Mergear (squash preferido para ramas pequeñas)
# 8. Limpiar rama local y remota
```

---

## 💬 Formato de commits (Conventional Commits)

```
<tipo>(<scope>): <descripción en imperativo>

[cuerpo opcional]

[footer opcional]
```

**Tipos válidos:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`,
`perf`, `build`, `ci`.

**Scopes habituales:** `host`, `financiero`, `facturas`, `proyectos`, `ui`, `utils`,
`types`, `config`, `db`, `docs`.

**Ejemplos correctos:**

```
feat(financiero): añadir cálculo de TIR con tests
fix(host): evitar fuga de memoria en error boundary
chore(deps): actualizar tailwind a v4
docs(arquitectura): documentar registro de módulos
refactor(ui): extraer GlassPanel a componente reutilizable
```

---

## 🚦 Cuándo NO commitear

- Sin haber probado en local que arranca.
- Con tests rojos (a menos que el propio commit corrija los tests).
- Con `console.log` de debug olvidados.
- Con `it.only` o `describe.only` activos.
- Con secrets en el diff.
- Con mensajes vagos (`fix`, `update`, `WIP`).

---

## 🧹 Antes de pedir merge

Checklist mental:

- [ ] He probado en local que arranca.
- [ ] Tests pasan (`pnpm test`).
- [ ] Type-check pasa (`pnpm type-check`).
- [ ] Lint pasa (`pnpm lint`).
- [ ] No hay secrets en el diff.
- [ ] CHANGELOG.md actualizado.
- [ ] ARQUITECTURA.md actualizado si aplica.
- [ ] PR tiene descripción clara y referencia a issues si las hay.

---

## 🆘 Recuperación de errores comunes

### "Commiteé en main por error"

```powershell
git branch feat/lo-que-hice            # Salvaguarda el cambio
git reset --hard HEAD~1                # Saca el commit de main (¡cuidado si ya pusheaste!)
git checkout feat/lo-que-hice
```

### "Push rechazado por estar desfasado"

```powershell
git fetch origin
git rebase origin/main
# Resolver conflictos si hay
git push --force-with-lease            # Solo a TU rama, NUNCA main
```

### "Necesito deshacer último commit ya pusheado"

```powershell
git revert HEAD                        # Crea commit que deshace
git push
```

---

## 📌 Nota sobre Guille trabajando solo

Mientras Guille sea el único contribuidor activo:

- Las ramas `feat/` se pueden mergear con commits normales (sin squash obligatorio).
- No usamos `develop` intermedio; `main` ↔ ramas de feature directamente.
- Los PRs son ligeros pero **siguen siendo obligatorios** para mantener disciplina
  y trazabilidad.

Cuando se sume otra persona, revisamos el flujo y añadimos `develop` + revisiones
formales.
