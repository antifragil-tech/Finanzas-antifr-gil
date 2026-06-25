# ═══════════════════════════════════════════════════════════════════════════
# Alsari Capital OS — Script de Validación de Estructura (v0.2)
# ───────────────────────────────────────────────────────────────────────────
# Verifica que todas las carpetas y archivos clave del monorepo estén en su
# sitio. Útil tras descomprimir el paquete inicial o tras cambios estructurales.
#
# Uso (desde la raíz del proyecto):
#   .\scripts\setup-alsari-os.ps1
#
# Si Windows bloquea el script:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ─── Colores ─────────────────────────────────────────────────────────────
function Write-Success { param($Message) Write-Host "  OK  $Message" -ForegroundColor Green }
function Write-Missing { param($Message) Write-Host "  XX  $Message" -ForegroundColor Red }
function Write-Info    { param($Message) Write-Host "  ii  $Message" -ForegroundColor Cyan }
function Write-Section { param($Message) Write-Host ""; Write-Host "=== $Message ===" -ForegroundColor Yellow }

# ─── Detectar raíz ──────────────────────────────────────────────────────
$projectRoot = Get-Location
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  ALSARI CAPITAL OS v0.2 - Validacion de estructura" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Info "Raiz detectada: $projectRoot"

$missingCount = 0
$presentCount = 0

# ─── Función de chequeo ──────────────────────────────────────────────────
function Test-Required {
    param(
        [string]$RelativePath,
        [ValidateSet("File", "Directory")]
        [string]$Type
    )

    $fullPath = Join-Path $projectRoot $RelativePath
    $exists = if ($Type -eq "File") {
        Test-Path $fullPath -PathType Leaf
    } else {
        Test-Path $fullPath -PathType Container
    }

    if ($exists) {
        Write-Success $RelativePath
        $script:presentCount++
    } else {
        Write-Missing "$RelativePath  (FALTA)"
        $script:missingCount++
    }
}

# ─── Validaciones ────────────────────────────────────────────────────────

Write-Section "Archivos raiz (cimientos)"
Test-Required "CLAUDE.md"                          "File"
Test-Required "README.md"                          "File"
Test-Required "package.json"                       "File"
Test-Required "pnpm-workspace.yaml"                "File"
Test-Required "turbo.json"                         "File"
Test-Required "tsconfig.json"                      "File"
Test-Required ".gitignore"                         "File"
Test-Required ".nvmrc"                             "File"
Test-Required ".env.example"                       "File"
Test-Required ".prettierrc"                        "File"
Test-Required ".editorconfig"                      "File"

Write-Section ".claude/ (Configuracion completa del agente)"
Test-Required ".claude\CLAUDE.md"                       "File"
Test-Required ".claude\settings.json"                   "File"

Write-Section ".claude/skills/ (5 skills)"
Test-Required ".claude\skills\corporate-context\SKILL.md"     "File"
Test-Required ".claude\skills\financial-formulas\SKILL.md"    "File"
Test-Required ".claude\skills\git-protocol\SKILL.md"          "File"
Test-Required ".claude\skills\ui-quiet-luxury\SKILL.md"       "File"
Test-Required ".claude\skills\lessons-learned\SKILL.md"       "File"
Test-Required ".claude\skills\lessons-learned\log.md"         "File"

Write-Section ".claude/hooks/ (Guardrails deterministas)"
Test-Required ".claude\hooks\README.md"                  "File"
Test-Required ".claude\hooks\PreToolUse.sh"              "File"
Test-Required ".claude\hooks\PostToolUse.sh"             "File"
Test-Required ".claude\hooks\SessionStart.sh"            "File"
Test-Required ".claude\hooks\Stop.sh"                    "File"

Write-Section ".claude/agents/ (Subagents especializados)"
Test-Required ".claude\agents\README.md"                 "File"
Test-Required ".claude\agents\code-reviewer.md"          "File"
Test-Required ".claude\agents\test-runner.md"            "File"
Test-Required ".claude\agents\migration-checker.md"      "File"
Test-Required ".claude\agents\architecture-explorer.md"  "File"

Write-Section ".claude/commands/ (Slash commands)"
Test-Required ".claude\commands\README.md"               "File"
Test-Required ".claude\commands\nueva-leccion.md"        "File"
Test-Required ".claude\commands\nuevo-modulo.md"         "File"
Test-Required ".claude\commands\reporte-semana.md"       "File"
Test-Required ".claude\commands\revisar-cambios.md"      "File"

Write-Section ".claude/docs/ways-of-working/ (Reglas para Claude)"
Test-Required ".claude\docs\ways-of-working\README.md"                       "File"
Test-Required ".claude\docs\ways-of-working\00-rol-y-autoridad.md"           "File"
Test-Required ".claude\docs\ways-of-working\01-arquitectura.md"              "File"
Test-Required ".claude\docs\ways-of-working\02-codigo.md"                    "File"
Test-Required ".claude\docs\ways-of-working\03-git-workflow.md"              "File"
Test-Required ".claude\docs\ways-of-working\04-ui-ux.md"                     "File"
Test-Required ".claude\docs\ways-of-working\05-seguridad.md"                 "File"
Test-Required ".claude\docs\ways-of-working\06-testing.md"                   "File"
Test-Required ".claude\docs\ways-of-working\07-documentacion.md"             "File"
Test-Required ".claude\docs\ways-of-working\08-glosario.md"                  "File"
Test-Required ".claude\docs\ways-of-working\09-protocolo-aprendizaje.md"     "File"

Write-Section "docs/ (Documentacion para humanos)"
Test-Required "docs\ARQUITECTURA.md"                          "File"
Test-Required "docs\CHANGELOG.md"                             "File"
Test-Required "docs\ROADMAP.md"                               "File"
Test-Required "docs\GETTING-STARTED.md"                       "File"
Test-Required "docs\decisiones\0001-stack-tecnico.md"         "File"

Write-Section "apps/ (Aplicaciones)"
Test-Required "apps"                                          "Directory"
Test-Required "apps\host"                                     "Directory"
Test-Required "apps\host\README.md"                           "File"
Test-Required "apps\modules"                                  "Directory"
Test-Required "apps\modules\README.md"                        "File"
Test-Required "apps\modules\_template"                        "Directory"

Write-Section "apps/modules/_template/ (Plantilla)"
Test-Required "apps\modules\_template\CLAUDE.md"              "File"
Test-Required "apps\modules\_template\README.md"              "File"
Test-Required "apps\modules\_template\ARQUITECTURA.md"        "File"
Test-Required "apps\modules\_template\CHANGELOG.md"           "File"
Test-Required "apps\modules\_template\package.json"           "File"
Test-Required "apps\modules\_template\vite.config.ts"         "File"
Test-Required "apps\modules\_template\tsconfig.json"          "File"
Test-Required "apps\modules\_template\tailwind.config.ts"     "File"
Test-Required "apps\modules\_template\index.html"             "File"
Test-Required "apps\modules\_template\src\App.tsx"            "File"
Test-Required "apps\modules\_template\src\main.tsx"           "File"
Test-Required "apps\modules\_template\src\index.css"          "File"
Test-Required "apps\modules\_template\.claude\skills\lessons-learned\SKILL.md" "File"
Test-Required "apps\modules\_template\.claude\skills\lessons-learned\log.md"   "File"
Test-Required "apps\modules\_template\ways-of-working-local\README.md"         "File"

Write-Section "packages/ (Librerias internas)"
Test-Required "packages\README.md"                            "File"
Test-Required "packages\ui"                                   "Directory"
Test-Required "packages\utils"                                "Directory"
Test-Required "packages\types"                                "Directory"
Test-Required "packages\config"                               "Directory"
Test-Required "packages\supabase-client"                      "Directory"

Write-Section "services/ (Backend)"
Test-Required "services\README.md"                            "File"
Test-Required "services\supabase\migrations"                  "Directory"
Test-Required "services\supabase\functions"                   "Directory"
Test-Required "services\integrations"                         "Directory"

Write-Section "GitHub y CI"
Test-Required ".github\PULL_REQUEST_TEMPLATE.md"              "File"
Test-Required ".github\workflows\ci.yml"                      "File"
Test-Required ".github\ISSUE_TEMPLATE\bug.md"                 "File"
Test-Required ".github\ISSUE_TEMPLATE\feature.md"             "File"

Write-Section "Configuracion del IDE"
Test-Required ".vscode\settings.json"                         "File"
Test-Required ".vscode\extensions.json"                       "File"

# ─── Resumen ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "                          RESUMEN" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Presentes : " -NoNewline; Write-Host "$presentCount" -ForegroundColor Green
Write-Host "  Faltantes : " -NoNewline
if ($missingCount -eq 0) {
    Write-Host "$missingCount" -ForegroundColor Green
} else {
    Write-Host "$missingCount" -ForegroundColor Red
}
Write-Host ""

if ($missingCount -eq 0) {
    Write-Host "  OK - ESTRUCTURA COMPLETA. Todo en orden." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Proximo paso:" -ForegroundColor Cyan
    Write-Host "    1. git init && git add . && git commit -m ""chore: setup inicial v0.2""" -ForegroundColor Gray
    Write-Host "    2. Crear repositorio privado en GitHub" -ForegroundColor Gray
    Write-Host "    3. git remote add origin <url> && git push -u origin main" -ForegroundColor Gray
    Write-Host "    4. Abrir Antigravity en esta carpeta" -ForegroundColor Gray
    Write-Host "    5. Pedir a Claude el siguiente paso del ROADMAP" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "  AVISO - Faltan archivos. Revisa el paquete o re-descomprime." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
