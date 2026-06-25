#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# SessionStart.sh — Contexto inicial al arrancar una sesión
# ───────────────────────────────────────────────────────────────────────────
# Imprime a stdout información útil para Claude:
#   - Rama actual y últimos commits.
#   - Estado del repo (archivos modificados).
#   - Última lección aprendida.
# Todo lo que se imprime se inyecta como contexto inicial.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  ALSARI CAPITAL OS — Estado del proyecto al iniciar sesión"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── Git status ──────────────────────────────────────────────────────────
if [ -d .git ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconocida")
  echo "📍 Rama actual: $BRANCH"

  # Últimos 3 commits
  echo ""
  echo "📝 Últimos 3 commits:"
  git log --oneline -3 2>/dev/null | sed 's/^/   /' || echo "   (sin commits aún)"

  # Estado de archivos
  CHANGED=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$CHANGED" -gt 0 ]; then
    echo ""
    echo "⚠️  Archivos modificados sin commitear: $CHANGED"
    git status --porcelain 2>/dev/null | head -5 | sed 's/^/   /'
    if [ "$CHANGED" -gt 5 ]; then
      echo "   ... y $((CHANGED - 5)) más"
    fi
  else
    echo ""
    echo "✅ Working tree limpio"
  fi
else
  echo "⚠️  Aún no inicializado como repo Git."
fi

# ─── Última lección aprendida ────────────────────────────────────────────
LESSONS_LOG=".claude/skills/lessons-learned/log.md"
if [ -f "$LESSONS_LOG" ]; then
  LESSONS_COUNT=$(grep -c '^## ' "$LESSONS_LOG" 2>/dev/null || echo "0")
  echo ""
  echo "🧠 Lecciones aprendidas registradas: $LESSONS_COUNT"

  if [ "$LESSONS_COUNT" -gt 0 ]; then
    echo ""
    echo "   Última lección:"
    grep -A 1 '^## ' "$LESSONS_LOG" | tail -2 | sed 's/^/   /'
  fi
fi

# ─── Recordatorio ────────────────────────────────────────────────────────
echo ""
echo "📚 Recordatorios:"
echo "   • Lee .claude/CLAUDE.md si no lo has hecho ya."
echo "   • Lee lessons-learned/log.md antes de empezar."
echo "   • Pushback antes de ejecutar peticiones subóptimas."
echo "   • Registra lecciones inmediatamente tras correcciones."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

exit 0
