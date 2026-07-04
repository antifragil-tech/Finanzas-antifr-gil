# Runbook · Smoke tests (Antifrágil OS)

> Cómo correr la suite de QA no destructiva. Sin instalar nada nuevo.
> Autor: Chat QA · Última actualización: 2026-07-04

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

### c) Detección de datos clínicos
```
node scripts/qa/check-no-clinical-data.mjs --help
node scripts/qa/check-no-clinical-data.mjs                # todo el repo
node scripts/qa/check-no-clinical-data.mjs apps packages  # rutas concretas
```

### d) Scope de la rama actual (antes de abrir PR)
```
node scripts/qa/check-pr-scope.mjs --help
node scripts/qa/check-pr-scope.mjs                        # compara contra main (o origin/main)
node scripts/qa/check-pr-scope.mjs --base origin/main
```

### e) Smoke de rutas (servidor levantado)
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

### check-no-clinical-data
- `OK · 0 señales` → bien.
- `FAIL` = término clínico en código/mocks/producto (`apps/`, `packages/`, `services/`, `scripts/`) → **bloqueo salvo triaje**: el script detecta términos, no diagnostica. Un FAIL exige revisión humana: "evolución" en KPIs financieros o "tratamiento" en un email mercantil NO son datos clínicos; un mock de cita con "lesión de rodilla" SÍ lo es y se elimina. Código de salida 1.
- `REQUIERE REVISIÓN` = mención en documentación (`docs/`, `.claude/`) → permitida si es documental (hablar DE la regla, no un dato de paciente). Revisar a ojo. No bloquea (código 0).
- En PRs nuevos lo que importa es el **delta**: no introducir hallazgos nuevos respecto a `main`.

### check-pr-scope
- `OK · no se tocan rutas peligrosas` → bien.
- `RUTAS PELIGROSAS TOCADAS` = la rama toca `.env*`, `packages/supabase-client`, `services/supabase/migrations`, `pnpm-lock.yaml`, `package.json` raíz, `apps/modules/reservas` o `apps/host` → solo válido si el PR está específicamente autorizado para ello. Código de salida 1.
- `⚠ Aviso: no existe main…` = no puede comparar (base desactualizada o ausente); no es fallo, pero el diff mostrado puede estar incompleto.

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
- ❌ No hacer merge/rebase/force-push desde la rama de QA.
- ❌ No usar datos reales ni clínicos para las pruebas: todo mock/demo administrativo.

## 6. Cómo reportar resultados en un PR

En un comentario del PR (o en la descripción), pegar un bloque con:

```md
### QA smoke suite — <fecha> — <rama>@<commit corto>

| Check | Resultado |
|---|---|
| check-legacy-strings | PASS / FAIL (n hallazgos) |
| check-no-secrets | PASS / FAIL (n HIGH) |
| check-no-clinical-data | PASS / REVISIÓN (n) / FAIL (n) |
| check-pr-scope | PASS / rutas peligrosas: … |
| smoke-routes | n/8 PASS (o "no ejecutado: sin servidor") |

Notas: <hallazgos relevantes, SIN pegar secretos ni datos>
```

Reglas: nunca pegar valores de secretos (ni enmascarados si no hace falta), nunca pegar
datos clínicos/reales, y adjuntar la checklist manual correspondiente si se rellenó.
