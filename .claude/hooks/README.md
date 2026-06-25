# Hooks — Guardrails deterministas

> Scripts shell que se disparan en eventos del agente Claude.
> **No son IA.** Son reglas duras que se ejecutan siempre, sin excepciones.

---

## 🎯 Por qué existen

Las reglas de `ways-of-working/` dependen de la buena voluntad de Claude.
Los hooks las convierten en **imposibles de saltarse**: si un hook devuelve
exit code 2, la acción del agente queda bloqueada antes de ejecutarse.

Analogía: los hooks son a Claude lo que los **git hooks** son al desarrollador.

---

## 📋 Eventos disponibles

| Hook | Cuándo se ejecuta | Qué puede hacer |
|------|-------------------|-----------------|
| `PreToolUse` | Antes de cualquier tool call | Bloquear (exit 2), inyectar contexto |
| `PostToolUse` | Después de tool call exitosa | Lintar, loguear, notificar |
| `SessionStart` | Al iniciar sesión | Imprimir contexto, estado del proyecto |
| `Stop` | Cuando Claude termina turno | Recordar lecciones aprendidas |
| `SubagentStop` | Cuando un subagent termina | Procesar resultado |

---

## 🛡️ Hooks activos en este proyecto

### `PreToolUse.sh`
Bloquea ejecuciones peligrosas antes de que ocurran:
- Comandos destructivos (`rm -rf` masivos, `git push --force` a `main`).
- Acceso a `.env` y archivos con secrets.
- Operaciones que requieren confirmación explícita de Guille.

### `PostToolUse.sh`
Tras editar código:
- Ejecuta Prettier sobre el archivo modificado (auto-format).
- Registra cambios en archivos críticos (CLAUDE.md, ways-of-working) en un log.

### `SessionStart.sh`
Al arrancar una sesión:
- Muestra rama actual, últimos 3 commits, estado del repo.
- Recuerda a Claude leer `lessons-learned/log.md`.

### `Stop.sh`
Al terminar un turno:
- Si hubo correcciones del usuario en la sesión, recuerda registrar lecciones.

---

## 🚫 Reglas para escribir hooks

1. **Exit codes:** `0` = continuar, `2` = bloquear, otro = error pero permite continuar.
2. **Stdout:** se inyecta como contexto a Claude.
3. **Stderr:** se muestra al usuario.
4. **Idempotentes:** no deben tener efectos colaterales acumulativos.
5. **Rápidos:** < 500ms idealmente. Hooks lentos ralentizan toda la sesión.
6. **Compatibles con Windows:** usar `bash` (Git Bash incluido en Windows) y rutas POSIX.

---

## 🧪 Probar un hook manualmente

```bash
# Simular un PreToolUse con un comando de prueba
echo '{"tool":"Bash","input":{"command":"rm -rf /"}}' | bash .claude/hooks/PreToolUse.sh
echo "Exit code: $?"
```

Si devuelve `2`, el hook está bloqueando correctamente.

---

## 🆘 Desactivar un hook temporalmente

Si un hook está dando problemas en una sesión específica, edita
`.claude/settings.json` y comenta la entrada correspondiente.

**No borres los hooks "porque dan guerra".** Si fallan, es señal de que hay una
regla mal definida. Arreglar la regla > eliminar el guardrail.
