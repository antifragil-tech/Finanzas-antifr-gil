#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Stop.sh — Recordatorio al terminar un turno de Claude
# ───────────────────────────────────────────────────────────────────────────
# Si en la sesión actual Claude ha sido corregido por el usuario, recordamos
# registrar las lecciones aprendidas antes de cerrar.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Comprobamos si el log de lecciones ha cambiado en las últimas 2 horas
LESSONS_LOG=".claude/skills/lessons-learned/log.md"

if [ -f "$LESSONS_LOG" ]; then
  # Tiempo desde última modificación (en segundos)
  if [ "$(uname)" = "Darwin" ]; then
    LAST_MOD=$(stat -f %m "$LESSONS_LOG" 2>/dev/null || echo "0")
  else
    LAST_MOD=$(stat -c %Y "$LESSONS_LOG" 2>/dev/null || echo "0")
  fi
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_MOD))

  # Si lleva > 1h sin actualizarse Y hay archivos modificados en .git
  if [ "$DIFF" -gt 3600 ] && [ -d .git ]; then
    CHANGED=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$CHANGED" -gt 0 ]; then
      echo ""
      echo "💡 Recordatorio: Si en esta sesión Guille te ha corregido, registra la lección"
      echo "   en .claude/skills/lessons-learned/log.md antes de cerrar."
      echo ""
    fi
  fi
fi

exit 0
