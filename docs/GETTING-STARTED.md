# Getting Started — Alsari Capital OS (v0.2)

> Guía paso a paso para arrancar el proyecto desde cero en Windows con Antigravity
> y Claude Code.

---

## 🎯 Punto de partida

Acabas de descomprimir el paquete inicial en tu carpeta del escritorio:

```
C:\Users\[tu-usuario]\Desktop\Alsari Capital OS\
```

Dentro tienes toda la estructura del monorepo:
- `.claude/` con constitución, skills, hooks, agents, commands y ways-of-working.
- `apps/` con el Host y la plantilla de módulo.
- `packages/`, `services/`, `docs/`, `scripts/`.
- Configs raíz y los archivos del Host OS aún pendientes de migrar.

Ahora vamos a:
1. Verificar que tienes el entorno listo.
2. Abrir el proyecto en Antigravity.
3. Inicializar Git y conectar a GitHub.
4. Validar que Claude Code lee correctamente la configuración.
5. Empezar la **Fase 1** del ROADMAP (migración de la app actual).

---

## 1️⃣ Verificar entorno

### Node.js ≥ 20

Abre PowerShell y ejecuta:
```powershell
node --version
```

Deberías ver `v20.x.x` o superior. Si no, instala desde [nodejs.org](https://nodejs.org/)
o, mejor, usa [nvm-windows](https://github.com/coreybutler/nvm-windows):

```powershell
nvm install 20
nvm use 20
```

### pnpm ≥ 9

```powershell
pnpm --version
```

Si no lo tienes:
```powershell
npm install -g pnpm
```

### Git

```powershell
git --version
```

Si no lo tienes, descarga desde [git-scm.com](https://git-scm.com/).

### Bash (para los hooks de Claude)

Los hooks de Claude (`.claude/hooks/*.sh`) son scripts shell. En Windows, Git
Bash (incluido con Git for Windows) los ejecuta sin problema. **No hace falta
WSL.**

### Antigravity + extensión Claude Code

- Antigravity debería estar ya instalado (ya lo usas).
- Asegúrate de tener la extensión **Claude Code** activa.

---

## 2️⃣ Abrir el proyecto en Antigravity

1. Abre Antigravity.
2. **File → Open Folder…**
3. Selecciona `C:\Users\[tu-usuario]\Desktop\Alsari Capital OS`.

Al abrirlo, Antigravity te ofrecerá instalar las extensiones recomendadas
(`extensions.json`). Acepta. Son las que necesitas para trabajar cómodo.

---

## 3️⃣ Validar la estructura

```powershell
cd "$env:USERPROFILE\Desktop\Alsari Capital OS"
.\scripts\setup-alsari-os.ps1
```

Si Windows lo bloquea con "execution policy", ejecuta primero:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Debe salir **OK - ESTRUCTURA COMPLETA**.

---

## 4️⃣ Inicializar Git y conectar a GitHub

### Inicializar repositorio local

```powershell
cd "$env:USERPROFILE\Desktop\Alsari Capital OS"
git init
git add .
git commit -m "chore: setup inicial v0.2 del monorepo Alsari Capital OS"
```

### Crear repositorio privado en GitHub

1. Ve a [github.com/new](https://github.com/new).
2. **Repository name:** `alsari-capital-os` (o el que prefieras).
3. **Privacy:** ⚠️ **Private** (obligatorio — datos sensibles).
4. **NO** inicialices con README, .gitignore ni licencia (ya los tienes).
5. Click "Create repository".

### Conectar y subir

```powershell
git remote add origin https://github.com/[tu-usuario]/alsari-capital-os.git
git branch -M main
git push -u origin main
```

---

## 5️⃣ Validar que Claude Code lee la configuración

1. En Antigravity, abre la paleta de comandos (`Ctrl+Shift+P`).
2. Busca "Claude Code" y abre el chat de Claude.
3. **Test 1 — Constitución:** *"¿Qué dice `.claude/CLAUDE.md` sobre mi rol?"*

   Claude debería responder describiendo la división Claude/Guille.

4. **Test 2 — Skill corporate:** *"Carga el skill `corporate-context` y dime
   quién es Iván Alarcón Rivera."*

   Respuesta esperada: *"Iván Alarcón Rivera es socio principal del holding,
   propietario de Armia Group S.L."*

5. **Test 3 — Slash command:** Escribe `/` en el chat. Debes ver:
   - `/nueva-leccion`
   - `/nuevo-modulo`
   - `/reporte-semana`
   - `/revisar-cambios`

6. **Test 4 — Hooks:** Pídele a Claude *"Ejecuta `rm -rf /`"*. El hook
   `PreToolUse.sh` debe bloquearlo con un mensaje rojo.

Si algún test falla, revisa que `.claude/settings.json` está bien y que los
hooks tienen permisos de ejecución (`chmod +x .claude/hooks/*.sh` desde Git Bash).

---

## 6️⃣ Próximos pasos: Fase 1 del ROADMAP

Ahora viene la parte donde **empezamos a tener código vivo**. La Fase 1 (ver
`docs/ROADMAP.md`) es **migrar tu app actual** al nuevo monorepo.

### Lo que vas a pedirle a Claude

Abre el chat de Claude Code en Antigravity y di algo como:

> *"Vamos a empezar la Fase 1 del ROADMAP. Tengo mi app actual de Neural
> Finance V3.0 con tres páginas: `FinancialDashboard.tsx`, `WorkspacePage.tsx`,
> `InvoicesPage.tsx`. Antes de hacer nada, lee `.claude/CLAUDE.md`, los
> ways-of-working y propón un plan de migración en pasos pequeños."*

Claude debería:
1. Leer todo el contexto.
2. Devolverte un plan estructurado por fases.
3. Esperar tu OK antes de tocar código.
4. Crear una rama `feat/migracion-app-inicial`.
5. Ir migrando pieza a pieza con commits semánticos.

---

## 7️⃣ Comandos útiles del día a día

```powershell
# Instalar dependencias (cuando se añadan)
pnpm install

# Levantar todo en dev (Host + módulos activos)
pnpm dev

# Levantar solo un módulo
pnpm --filter @alsari/financiero dev

# Tests
pnpm test                    # Modo watch
pnpm test:run                # Una pasada (CI)

# Lint y format
pnpm lint
pnpm format

# Type-check
pnpm type-check

# Build de todo
pnpm build
```

---

## 8️⃣ Slash commands disponibles

Dentro del chat de Claude:

- `/nueva-leccion` → registrar una corrección como lección aprendida.
- `/nuevo-modulo <nombre>` → clonar el template y crear un módulo.
- `/reporte-semana` → asistente para el Reporte de Semana ejecutivo.
- `/revisar-cambios` → invocar code-reviewer sobre tu diff actual.

---

## 9️⃣ Cuando algo falle

### "pnpm: command not found"
Instala pnpm globalmente: `npm install -g pnpm`.

### "Cannot find module..."
Probablemente faltó `pnpm install` en la raíz. Ejecútalo.

### Claude no parece leer la configuración
Verifica:
- Que `CLAUDE.md` está en la raíz del workspace abierto.
- Que `.claude/CLAUDE.md` existe.
- Que `.claude/settings.json` existe.
- Que `.claude/skills/*/SKILL.md` existen.
- Que la extensión Claude Code está activa.
- Reinicia Antigravity tras cambios en `.claude/`.

### Los hooks no se ejecutan
Asegúrate de tener Git Bash instalado en Windows. Da permisos de ejecución:
```bash
chmod +x .claude/hooks/*.sh
```
(Esto se puede hacer desde Git Bash en Windows.)

### Git rechaza el push
Verifica que el repo en GitHub es privado y que estás autenticado:
```powershell
gh auth status     # Si tienes GitHub CLI
```

---

## 🎯 Resumen ultra-rápido

```powershell
# Una sola vez
cd "$env:USERPROFILE\Desktop\Alsari Capital OS"
.\scripts\setup-alsari-os.ps1
git init
git add .
git commit -m "chore: setup inicial v0.2"
git remote add origin https://github.com/[tu-usuario]/alsari-capital-os.git
git push -u origin main

# Cada vez que abras a trabajar
cd "$env:USERPROFILE\Desktop\Alsari Capital OS"
# Abre Antigravity en esta carpeta
# Abre chat de Claude
# El hook SessionStart.sh te imprime el estado del repo
# Pide a Claude el siguiente paso del ROADMAP
```

Listo. **Bienvenido al Alsari Capital OS v0.2.**
