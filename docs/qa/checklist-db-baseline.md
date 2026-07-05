# Checklist QA · DB Baseline (Antifrágil OS)

> Rellenar a mano. **NO aplicar SQL** desde esta checklist. Solo verificación documental y, cuando exista un proyecto autorizado, comprobación de estado.
> Baseline de referencia: `services/supabase/baselines/antifragil_os/` (rama `chore/db-baseline-antifragil-os`).

**Quién revisa:** ____________  **Fecha:** ____________  **Proyecto objetivo (ref):** ____________

## Identidad del proyecto

- [ ] **Proyecto correcto**: el destino es el proyecto **Antifrágil OS nuevo y limpio** (no el legacy del holding)
- [ ] **No "Lidomare App"**: el destino NO es Lidomare App (decisión D2)
- [ ] **No legacy ref**: el `ref` del proyecto NO coincide con el legacy hardcodeado en `packages/supabase-client` (decisión D3)
- [ ] La URL/`ref` objetivo está documentada y aprobada (no inventada)

## Contenido del baseline (revisión de ficheros, sin ejecutar)

- [ ] Existe `00000000000000_baseline_antifragil_os.sql` y es la **fuente única** del esquema
- [ ] Existe `post_bootstrap_checks.sql` con verificaciones post-aplicación
- [ ] Existe `APPLY_RUNBOOK.md` con el procedimiento de aplicación
- [ ] Existe `SECURITY_CHECKLIST.md` y está revisado
- [ ] Existe `excluded_legacy.md` documentando qué del legacy queda fuera
- [ ] El conteo de tablas del README coincide con el SQL (referencia: 26 tablas)
- [ ] El baseline vive en su **carpeta de baseline**, NO en `services/supabase/migrations/` (migraciones activas)

## Paquete A1 (Tesorería/Caja) — si el PR lo incluye

- [ ] El SQL de A1 vive en su **carpeta A1** propia, separada del baseline
- [ ] Existe el **runbook** de aplicación de A1
- [ ] Existen los **checks** post-aplicación de A1
- [ ] A1 tampoco se aplica desde QA (solo revisión documental)

## Alcance del PR

- [ ] `packages/supabase-client` **no tocado**
- [ ] **No SQL aplicado** como parte del PR (solo archivos versionados)
- [ ] **No datos clínicos** en seeds, ejemplos ni comentarios SQL (correr `check-no-clinical-data.mjs`)
- [ ] **No datos reales** en seeds (nombres, CIFs, IBANs, importes reconocibles)

## Estado tras aplicar (SOLO si hay proyecto autorizado y aplicación expresa)

> Esta sección se rellena únicamente cuando alguien con autorización haya aplicado el baseline siguiendo el runbook. QA **no** lo aplica.

- [ ] **Baseline aplicado** según `APPLY_RUNBOOK.md`
- [ ] **Checks PASS**: `post_bootstrap_checks.sql` devuelve todo OK
- [ ] **RLS ON** en todas las tablas que lo requieren
- [ ] **Anon sin acceso**: el rol `anon` no puede leer/escribir datos protegidos
- [ ] **Seed Antifrágil correcto**: sociedad inicial = **Antifrágil S.C.** (decisión D5)
- [ ] **Clínica Playamar** presente como proyecto activo (decisión D6)
- [ ] **No datos reales** del holding (Pavier/Armia/Rialsa) en el proyecto nuevo
- [ ] **No legacy**: ninguna tabla/columna del holding (`finanzas_sociedades`, `proyecto_sociedades`, `pct_pavier`, `pct_armia`) presente

## Seguridad

- [ ] No se ha copiado ninguna `service_role` key a archivos ni a chats
- [ ] Las credenciales del proyecto viven solo en `.env.local` (no commiteado)
- [ ] La anon key legacy ha sido rotada o está en plan de rotación (riesgo R5)

## Resultado

- [ ] **PASS documental** (ficheros del baseline correctos)
- [ ] **PASS aplicado** (solo si se aplicó con autorización)
- Notas: ___________________________________________
