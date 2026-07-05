# Subagents — Delegación con contexto aislado

> Claudes hijos especializados con su propia ventana de contexto.
> El padre delega una tarea, el hijo la ejecuta, devuelve UN solo mensaje.

---

## 🎯 Por qué existen

**El problema:** la sesión principal de Claude se contamina con cientos de líneas
de output cuando explora código, corre tests o revisa diffs. Eso quema contexto
útil y hace la sesión menos eficiente.

**La solución:** cada subagent es un Claude hijo con su **propio system prompt,
sus propias tools y su propia ventana de contexto**. El padre lo invoca como si
fuera una herramienta, espera el resultado consolidado, y sigue limpio.

Analogía: como contratar a un especialista para una tarea concreta. El
especialista hace su trabajo y te entrega un informe; tú no tienes que ver
todo el proceso intermedio.

---

## 📋 Subagents disponibles

| Agent                   | Cuándo invocarlo                                                      | Qué devuelve                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code-reviewer`         | Antes de commit/PR                                                    | Revisión contra ways-of-working                                                                                                                           |
| `test-runner`           | Cuando hay cambios significativos                                     | Resultado de tests con failures resumidos                                                                                                                 |
| `migration-checker`     | Al crear/modificar migration SQL                                      | Validación de seguridad y RLS                                                                                                                             |
| `architecture-explorer` | Para entender una zona del monorepo                                   | Mapa estructural y dependencias                                                                                                                           |
| `doc-keeper`            | Tras completar un feature/fix/milestone o cuando el contexto se agota | Actualiza ARQUITECTURA.md, CHANGELOG.md y **produce SESSION.md** — el estado de transferencia que permite a un Claude nuevo continuar sin perder contexto |

Todos son **opcionales**. La sesión principal puede hacer estas tareas; los
subagents son optimización de contexto para tareas largas o repetitivas.

---

## 🚀 Cómo invocar un subagent

Desde la conversación con Claude principal, basta con pedírselo:

> _"Lanza el code-reviewer sobre los cambios en `apps/modules/financiero/`."_

Claude lo invocará, esperará el resultado y te lo presentará consolidado.

---

## 🛠️ Cómo crear un nuevo subagent

1. Crear archivo `.claude/agents/<nombre>.md`.
2. Frontmatter obligatorio:

```yaml
---
name: nombre-del-agente
description: Cuándo invocarlo y qué hace. Sé específico.
tools:
  - Read
  - Bash
  - Grep
---
```

3. Cuerpo del archivo: system prompt completo del subagent. Sé explícito en:
   - Qué tareas SÍ hace.
   - Qué tareas NO hace (delega al padre o pide intervención).
   - Formato exacto del mensaje de retorno.

4. Una vez creado, Claude lo autodetecta. No requiere registro.

---

## 🚫 Reglas para escribir subagents

1. **Una responsabilidad por agent.** Si haces uno que "lee código, corre tests
   y deploya", está mal pensado. Sepáralo en 3.
2. **El retorno es UN mensaje.** Estructurado, conciso, accionable.
3. **Sin diálogo bidireccional.** El padre no negocia con el hijo. Si el hijo
   no puede completar la tarea, devuelve un error claro.
4. **Tools mínimas necesarias.** No des `Bash` a un agent que solo lee archivos.
