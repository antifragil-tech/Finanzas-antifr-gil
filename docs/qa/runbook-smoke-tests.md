# Runbook · Smoke tests (Antifrágil OS)

> Cómo correr la suite de QA no destructiva. Sin instalar nada nuevo.
> Autor: Chat 5 (QA / testing) · Fecha: 2026-06-30

## Requisitos

- Node ≥ 20 (ya requerido por el repo). Los scripts son `.mjs` sin dependencias externas.
- Para `smoke-routes`, un servidor del host **ya levantado** (los scripts **no** arrancan servidores).

---

## 1. Levantar el demo (para smoke de rutas)

> El demo es **mock**: no necesita Supabase ni backend. Protegido por `ANTIFRAGIL_DEMO_MODE`.

1. Crea `apps/host/.env.local` (NO se commitea) con la flag de demo. **No pongas claves reales**; placeholders dummy bastan:
   ```
   ANTIFRAGIL_DEMO_MODE=true
   NODE_ENV=development
   NEXT_PUBLIC_SUPABASE_URL=http://demo.local
   NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-anon-placeholder
   ```
2. Arranca solo el host:
   ```
   pnpm --filter @alsari/host dev
   ```
   (o `pnpm dev` para todo el monorepo si lo prefieres).
3. Abre `http://localhost:3000`. Deberías ver el shell demo con el banner de demostración.

> Alternativa solo-reservas (sin host): `pnpm --filter @alsari/reservas dev` y abre el puerto que indique Vite.

---

## 2. Correr los scripts

Desde la **raíz del repo**:

### a) Detección de legacy
```
node scripts/qa/check-legacy-strings.mjs --help          # ayuda
node scripts/qa/check-legacy-strings.mjs                  # escanea apps/ (por defecto)
node scripts/qa/check-legacy-strings.mjs apps/host        # una ruta concreta
node scripts/qa/check-legacy-strings.mjs --all --soft     # todo el repo, sin romper
```

### b) Detección de secretos (enmascara)
```
node scripts/qa/check-no-secrets.mjs --help
node scripts/qa/check-no-secrets.mjs                      # escanea la raíz
node scripts/qa/check-no-secrets.mjs apps packages        # rutas concretas
```

### c) Smoke de rutas (servidor levantado)
```
node scripts/qa/smoke-routes.mjs --help
QA_BASE_URL=http://localhost:3000 node scripts/qa/smoke-routes.mjs --expect-demo
node scripts/qa/smoke-routes.mjs --base http://localhost:3000
```

En PowerShell, para fijar la variable en la misma línea:
```
$env:QA_BASE_URL="http://localhost:3000"; node scripts/qa/smoke-routes.mjs --expect-demo
```

---

## 3. Cómo interpretar los resultados

### check-legacy-strings
- `OK · 0 strings legacy` → bien.
- Lista `archivo:línea [término] snippet` + resumen por término. **Importa el legacy VISIBLE** (texto que llega a pantalla). Mucho legacy en `services/`, `docs/` o comentarios es esperado en el repo reciclado; el bloqueo de PR es legacy **visible** en `apps/host` / `apps/modules`.
- Código de salida 1 = hubo hallazgos (usa `--soft` para no romper un pipeline informativo).

### check-no-secrets
- `OK · 0 hallazgos HIGH` → bien.
- `HIGH` = patrón con valor real (JWT, key con valor, `.env` real). **Valores enmascarados** (`ey…[221]…Q8`). Si es real → **PARAR, no subir, ROTAR la clave**.
- `INFO` = menciones sin valor (placeholders, rol `service_role` en SQL, prosa). No bloquean.

### smoke-routes
- `[PASS] /ruta status=200 legacy=no demo=sí` → bien.
- `legacy=SÍ⚠` → hay texto "Alsari/Pavier/Armia/Rialsa" visible en esa página → revisar.
- `demo=no` con `--expect-demo` → falta el banner de demostración → revisar gating.
- Salida `✗ No hay servidor` (código 2) → no es fallo del código; levanta el demo (paso 1).

---

## 4. Qué hacer si falla

- **Secreto detectado** → no subir nada; reportar el hallazgo **sin copiar el valor**; rotar la clave si era real (ver riesgo R5 en `docs/integration/05-registro-riesgos.md`).
- **Legacy visible en `apps/`** → corregir en la **rama origen** del PR (no en la rama de QA).
- **Ruta FAIL / status ≠ 200** → revisar la rama de host/demo; adjuntar la salida del script al PR.
- **Servidor no responde** → revisa que el `pnpm dev` siga vivo y el puerto sea el correcto.

## 5. Qué NO hacer

- ❌ No instalar paquetes ni tocar `package.json` / `pnpm-lock.yaml` para correr esto.
- ❌ No aplicar SQL ni conectar a Supabase real.
- ❌ No copiar secretos a issues, PRs ni chats (ni siquiera enmascarados "por si acaso").
- ❌ No hacer push/PR/merge/rebase desde la rama de QA.
- ❌ No usar datos reales para las pruebas: todo mock/demo.
