---
description: Invocar el subagent code-reviewer sobre los cambios actuales (staged o respecto a main).
argument-hint: "[staged | main | <commit-hash>]"
---

# Tarea: Revisar cambios con code-reviewer

El usuario quiere una revisión técnica del código modificado. Sigue este flujo:

## 1. Determinar el alcance del diff

- Si `$ARGUMENTS` = `staged` → `git diff --cached`
- Si `$ARGUMENTS` = `main` → `git diff main...HEAD`
- Si `$ARGUMENTS` es un hash → `git diff <hash>...HEAD`
- Si no hay argumento → `git diff` (cambios no stageados)

## 2. Verificación previa

- Ejecuta `git status` para mostrar al usuario el contexto.
- Si NO hay cambios en el rango pedido, dilo y detente.

## 3. Invocar el subagent code-reviewer

Pasa al subagent:
- El rango del diff a revisar.
- Una nota: "Aplica TODAS las checks definidas en tu system prompt."

Espera el informe consolidado.

## 4. Presentar resultado

Muestra el informe del code-reviewer **tal cual** lo devolvió.

Si hay bloqueantes (`❌ Requiere cambios`):
- Pregunta al usuario si quiere que arregles los puntos automáticamente.
- Si dice sí, arregla uno por uno y vuelve a invocar el reviewer.

Si está apto (`✅` o `⚠️`):
- Sugiere los siguientes pasos: commit + push + PR.
- Recuerda el formato de Conventional Commits.
