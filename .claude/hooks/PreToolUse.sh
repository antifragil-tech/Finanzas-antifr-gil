#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# PreToolUse.sh — Guardrail antes de cada tool call de Claude
# ───────────────────────────────────────────────────────────────────────────
# Recibe por stdin un JSON con {tool, input}.
# Exit 0  = permitir
# Exit 2  = bloquear (Claude verá stderr como razón)
# Exit !0 = error pero continuar
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Leer input JSON
INPUT=$(cat)

# Extraer tool y comando (asumimos jq instalado; si no, usamos grep)
if command -v jq >/dev/null 2>&1; then
  TOOL=$(echo "$INPUT" | jq -r '.tool // empty')
  COMMAND=$(echo "$INPUT" | jq -r '.input.command // empty')
  FILE_PATH=$(echo "$INPUT" | jq -r '.input.file_path // empty')
else
  TOOL=$(echo "$INPUT" | grep -oE '"tool":\s*"[^"]+"' | sed 's/.*"tool":\s*"\([^"]*\)".*/\1/')
  COMMAND=$(echo "$INPUT" | grep -oE '"command":\s*"[^"]+"' | sed 's/.*"command":\s*"\([^"]*\)".*/\1/' || echo "")
  FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path":\s*"[^"]+"' | sed 's/.*"file_path":\s*"\([^"]*\)".*/\1/' || echo "")
fi

# ─── Reglas Bash ─────────────────────────────────────────────────────────
if [ "$TOOL" = "Bash" ]; then

  # 1. Bloquear rm -rf peligrosos
  if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+(/|~|\$HOME|\*)'; then
    echo "❌ BLOQUEADO: rm -rf en raíz, home o glob. Si es intencionado, pide confirmación a Guille." >&2
    exit 2
  fi

  # 2. Bloquear git push --force a main
  if echo "$COMMAND" | grep -qE 'git\s+push.*(-f|--force).*main'; then
    echo "❌ BLOQUEADO: git push --force a main. Usa git revert en su lugar." >&2
    exit 2
  fi

  # 3. Bloquear curl/wget directo a bash
  if echo "$COMMAND" | grep -qE '(curl|wget).*\|\s*(bash|sh)'; then
    echo "❌ BLOQUEADO: pipe de curl/wget a shell. Descarga, inspecciona, y ejecuta como pasos separados." >&2
    exit 2
  fi

  # 4. Bloquear edición/lectura de .env reales (no .env.example)
  if echo "$COMMAND" | grep -qE '(cat|less|more|head|tail|nano|vi|vim|code)\s+\.env(\s|$|\.local|\.production)'; then
    echo "❌ BLOQUEADO: acceso a .env. Los secrets no se inspeccionan desde el agente." >&2
    exit 2
  fi

  # 5. Avisar (no bloquear) sobre commits con secrets potenciales
  if echo "$COMMAND" | grep -qE 'git\s+commit' && [ -f .env ]; then
    if git status --porcelain 2>/dev/null | grep -qE '^\s*[AM]\s+\.env$'; then
      echo "⚠️  ADVERTENCIA: parece que .env está stageado. Verifica que está en .gitignore." >&2
      # No bloqueamos porque puede ser .env.example; solo avisamos
    fi
  fi
fi

# ─── Reglas Edit/Write ──────────────────────────────────────────────────
if [ "$TOOL" = "Edit" ] || [ "$TOOL" = "Write" ]; then

  # 1. Bloquear escritura directa en .env reales
  case "$FILE_PATH" in
    *.env|*.env.local|*.env.production)
      echo "❌ BLOQUEADO: edición de archivos .env. Solo .env.example puede modificarse." >&2
      exit 2
      ;;
  esac

  # 2. Avisar al editar archivos críticos
  case "$FILE_PATH" in
    *CLAUDE.md|*ways-of-working/*|*ARQUITECTURA.md)
      echo "ℹ️  Editando archivo crítico ($FILE_PATH). Recuerda actualizar CHANGELOG.md." >&2
      ;;
  esac
fi

# Todo OK
exit 0
