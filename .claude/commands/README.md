# Slash Commands — Atajos personalizados

> Comandos `/nombre` que disparan flujos predefinidos en Claude Code.
> Te ahorran tener que recordar la prompt completa cada vez.

---

## 🎯 Qué son

Un slash command es un archivo `.md` con frontmatter + un prompt-plantilla.
Cuando escribes `/nombre arg1 arg2` en el chat, Claude Code lo expande al prompt
completo y lo ejecuta.

Analogía: como aliases en shell, pero para prompts.

---

## 📋 Commands disponibles

| Comando                      | Para qué sirve                                   |
| ---------------------------- | ------------------------------------------------ |
| `/nueva-leccion`             | Registrar una lección aprendida en el log        |
| `/nuevo-modulo <nombre>`     | Crear un módulo nuevo desde `_template`          |
| `/reporte-semana`            | Generar un Reporte de Semana siguiendo plantilla |
| `/revisar-cambios`           | Invocar code-reviewer sobre el diff actual       |
| `/migrar [origen] [destino]` | Asistente de migración de código entre paths     |

---

## 🛠️ Cómo crear un command

Crea `.claude/commands/nombre.md`:

```markdown
---
description: Una línea explicando qué hace.
argument-hint: '[arg1] [arg2]'
---

Aquí va el prompt-plantilla. Puedes usar:

- $ARGUMENTS → todos los argumentos pasados.
- $1, $2, ... → argumentos individuales.
- !`comando bash` → resultado de ejecutar bash.
- @ruta/archivo → contenido del archivo se inyecta.
```

Una vez creado, Claude lo autodetecta. No requiere registro.

---

## 🚫 Reglas para buenos commands

1. **Un comando = un flujo claro.** No mezcles tareas dispares.
2. **Argumentos opcionales documentados** en `argument-hint`.
3. **Sin efectos colaterales silenciosos.** Si el comando crea/borra archivos,
   debe pedir confirmación.
4. **Reusables.** Si solo lo vas a usar una vez, no merece ser comando.
