#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# PostToolUse.sh — Acciones tras una tool call exitosa
# ───────────────────────────────────────────────────────────────────────────
# Se ejecuta DESPUÉS de un Edit/Write exitoso. Aprovecha para:
#   - Formatear automáticamente código modificado.
#   - Registrar cambios en archivos críticos en un audit log.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  TOOL=$(echo "$INPUT" | jq -r '.tool // empty')
  FILE_PATH=$(echo "$INPUT" | jq -r '.input.file_path // empty')
else
  TOOL=$(echo "$INPUT" | grep -oE '"tool":\s*"[^"]+"' | sed 's/.*"tool":\s*"\([^"]*\)".*/\1/')
  FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path":\s*"[^"]+"' | sed 's/.*"file_path":\s*"\([^"]*\)".*/\1/' || echo "")
fi

# ─── Auto-format con Prettier ────────────────────────────────────────────
if [ "$TOOL" = "Edit" ] || [ "$TOOL" = "Write" ]; then
  case "$FILE_PATH" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css)
      # Si prettier está disponible localmente, formatea silenciosamente
      if [ -f "node_modules/.bin/prettier" ]; then
        node_modules/.bin/prettier --write --log-level=warn "$FILE_PATH" 2>/dev/null || true
      elif command -v prettier >/dev/null 2>&1; then
        prettier --write --log-level=warn "$FILE_PATH" 2>/dev/null || true
      fi
      ;;
  esac

  # ─── Audit log de cambios críticos ────────────────────────────────────
  LOG_DIR=".claude/.cache"
  LOG_FILE="$LOG_DIR/audit.log"
  mkdir -p "$LOG_DIR"

  case "$FILE_PATH" in
    *CLAUDE.md|*ways-of-working/*|*settings.json|*ARQUITECTURA.md)
      TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
      echo "[$TIMESTAMP] $TOOL → $FILE_PATH" >> "$LOG_FILE"
      ;;
  esac
fi

exit 0
