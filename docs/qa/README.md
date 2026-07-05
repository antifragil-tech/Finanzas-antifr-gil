# QA · Smoke Suite — Antifrágil OS

> Paquete de QA no destructivo. Rama: `qa/smoke-suite-antifragil-os`.
> Autor: Chat QA · Última actualización: 2026-07-04
> **No** toca código productivo, **no** instala paquetes, **no** aplica SQL, **no** toca Supabase real.

## Objetivo

Dar un conjunto **mínimo y reproducible** de comprobaciones para usar **antes de abrir PRs** y **antes de merges**, sin depender de nadie ni de backend real.

## Qué valida

- **Demo** arrancable en local: rutas responden, banner de demo visible, sin datos reales.
- **Rutas** del host: `/`, `/reservas`, `/financiero`, `/rentabilidad`, `/contabilidad`, `/presupuestos`, `/configuracion`, `/facturas`.
- **Ausencia de legacy visible**: que no aparezcan "Alsari", "Pavier", "Armia", "Rialsa", etc.
- **Reservas**: agenda Hoy/Semana/Mes, KPIs, panel lateral, badges (checklist manual).
- **No conexión accidental a Supabase**: el modo demo no llama a backend.
- **No secretos**: que no haya claves, JWT, `service_role`, `DB_PASSWORD`, private keys ni `.env` reales en el diff.
- **No datos clínicos**: que no haya términos clínicos (diagnóstico, lesión, tratamiento…) en código, mocks ni producto.
- **Scope de PR**: que la rama actual no toque rutas peligrosas (`.env`, `supabase-client`, migraciones, lockfile…).
- **Estado de ramas**: apoyo a la revisión de PRs (checklist).
- **DB baseline**: checklist de QA (sin aplicar SQL).

## Qué NO valida

- **No** es test funcional automatizado ni e2e (no hay framework de tests aquí).
- **No** verifica lógica de negocio ni cálculos financieros.
- **No** aplica ni inspecciona Supabase real (solo checklist).
- **No** garantiza seguridad completa: `check-no-secrets` es una red de seguridad, no una auditoría.
- **No** arranca servidores: `smoke-routes` solo prueba contra un servidor **ya levantado**.

## Cómo usarlo

1. **Checklists manuales** (`docs/qa/checklist-*.md`): se rellenan a mano durante la revisión.
2. **Scripts** (`scripts/qa/*.mjs`): Node sin dependencias externas. Ver `runbook-smoke-tests.md`.
   ```
   node scripts/qa/check-legacy-strings.mjs --help
   node scripts/qa/check-no-secrets.mjs --help
   node scripts/qa/check-no-clinical-data.mjs --help
   node scripts/qa/check-pr-scope.mjs --help
   node scripts/qa/smoke-routes.mjs --help
   ```
3. Para el smoke de rutas, levanta antes el demo (ver runbook) y luego:
   ```
   QA_BASE_URL=http://localhost:3000 node scripts/qa/smoke-routes.mjs --expect-demo
   ```

## Qué hacer si falla

- **`check-legacy-strings` encuentra legacy en `apps/`** → es un bloqueo de PR si es **texto visible**; corregir en la rama origen (no aquí).
- **`check-no-secrets` encuentra algo HIGH** → **PARAR**. No subir. Reportar el hallazgo **sin copiar el secreto** (el script ya enmascara). Rotar la clave si era real.
- **`check-no-clinical-data` encuentra FAIL** → bloqueo absoluto: eliminar el contenido clínico del código/mock antes de seguir. Las menciones "REQUIERE REVISIÓN" en docs se revisan a ojo (¿es mención documental o dato?).
- **`check-pr-scope` marca rutas peligrosas** → verificar que el PR está autorizado para tocarlas; si no, devolver a la rama origen.
- **`smoke-routes` da status ≠ 200 o legacy visible** → revisar la ruta en la rama de demo/host; adjuntar el resultado al PR.
- **No hay servidor levantado** → el script lo dice claramente; no es un fallo del código, levanta el demo primero.

## Qué NO hacer

- ❌ No instalar paquetes ni tocar `package.json` / `pnpm-lock.yaml`.
- ❌ No aplicar SQL ni conectar a Supabase real.
- ❌ No copiar/pegar secretos en ningún sitio (ni en issues ni en PRs).
- ❌ No hacer merge/rebase/force-push. La rama de QA solo se publica como PR Draft.
- ❌ No usar datos reales ni clínicos: todo lo que se prueba es mock/demo administrativo.

## Índice

| Archivo                                 | Tipo   | Uso                                   |
| --------------------------------------- | ------ | ------------------------------------- |
| `docs/qa/checklist-demo.md`             | manual | revisar el demo                       |
| `docs/qa/checklist-reservas.md`         | manual | revisar reservas                      |
| `docs/qa/checklist-db-baseline.md`      | manual | revisar DB baseline (sin aplicar SQL) |
| `docs/qa/checklist-pr.md`               | manual | revisar un PR                         |
| `docs/qa/runbook-smoke-tests.md`        | guía   | cómo correr los scripts               |
| `scripts/qa/check-legacy-strings.mjs`   | script | detectar strings legacy               |
| `scripts/qa/check-no-secrets.mjs`       | script | detectar secretos (enmascara)         |
| `scripts/qa/check-no-clinical-data.mjs` | script | detectar datos clínicos prohibidos    |
| `scripts/qa/check-pr-scope.mjs`         | script | revisar scope de la rama actual       |
| `scripts/qa/smoke-routes.mjs`           | script | GET a rutas locales                   |
