# Runbook de aplicación manual — Baseline `Antifrágil OS`

> Guía paso a paso para aplicar el baseline en un Supabase **nuevo**. Escrita para alguien **no experto**. Léela entera antes de empezar. Si algo no encaja con lo que ves en pantalla, **PARA** y pregunta — no improvises.
>
> ⛔ Antes de nada: este runbook **NO se ejecuta solo**. Lo ejecuta una persona (Fernando/Javi). Claude no aplica nada en Supabase.

---

## Paso 0 — Antes de empezar (5 min)

- [ ] Lee `SECURITY_CHECKLIST.md` de esta misma carpeta y marca todo.
- [ ] Ten a mano un **gestor de contraseñas** (1Password, Bitwarden, o similar). Vas a generar una contraseña de base de datos que NO puede acabar en el repo.
- [ ] Confirma que vas a trabajar en la organización **`Antifrágil`** del Dashboard de Supabase.

---

## Paso 1 — Crear el proyecto Supabase nuevo

1. Entra en **https://supabase.com/dashboard**.
2. Arriba a la izquierda, selecciona la organización **`Antifrágil`** (no otra).
3. Pulsa **New project**.
4. Rellena:
   - **Name:** `Antifrágil OS`
   - **Database Password:** pulsa *Generate a password*. **Cópiala al gestor de contraseñas AHORA.** No la escribas en ningún archivo del repo, ni en chat, ni en notas.
   - **Region:** **West EU (Frankfurt)** (datos europeos / RGPD).
   - **Plan:** el que corresponda (Free vale para empezar).
5. Pulsa **Create new project** y espera 1–2 min a que termine de aprovisionarse.

---

## Paso 2 — Confirmar que es el proyecto CORRECTO

Antes de tocar nada, verifica que NO estás en el sitio equivocado:

- [ ] El nombre arriba dice **`Antifrágil OS`** (no `Lidomare App`, no nada de la base anterior).
- [ ] La organización es **`Antifrágil`**.
- [ ] El **project ref** (lo ves en la URL: `https://supabase.com/dashboard/project/<REF>`) **NO** es `swtyxysvnfcfxziclteq` (legacy) **ni** `vaebfxmshydwxrtmzoei` (Lidomare App). Debe ser uno **nuevo**.

> Si el ref coincide con cualquiera de esos dos, **PARA**: estás en el proyecto equivocado.

---

## Paso 3 — Guardar las claves FUERA del repo

1. Ve a **Project Settings → API**.
2. Verás **Project URL**, **anon public key** y **service_role key**.
3. Copia **Project URL**, **anon key** y **service_role key** a tu **gestor de secretos** (no al repo, no a chat).
   - La `service_role` es especialmente sensible: da acceso total saltándose RLS. Trátala como una contraseña de administrador.
4. Lo único que puedes anotar en sitios compartidos es el **project ref** (la cadena de la URL) — no es secreto. Las **claves nunca**.

---

## Paso 4 — Abrir el SQL Editor

1. En el menú izquierdo, **SQL Editor**.
2. Pulsa **New query**.

---

## Paso 5 — Aplicar el baseline

1. Abre el archivo `00000000000000_baseline_antifragil_os.sql` de esta carpeta.
2. **Selecciona todo** su contenido y **cópialo**.
3. **Pégalo** en el SQL Editor.
4. Pulsa **Run** (o `Ctrl/Cmd + Enter`).
5. Espera. Debe terminar con **Success. No rows returned** (o similar). El script crea tablas, vistas, funciones, políticas, el bucket y el seed mínimo, todo de una vez.

> El script está pensado para correr **entero de una sola vez**. El orden interno respeta las dependencias; no lo trocees salvo que un error te obligue (ver Paso 8).

---

## Paso 6 — Ejecutar las comprobaciones post-bootstrap

1. **New query** otra vez.
2. Copia y pega `post_bootstrap_checks.sql` de esta carpeta.
3. **Run**.
4. El primer resultado es una tabla **RESUMEN** con una fila por comprobación y una columna `estado` (`PASS` / `FAIL`).

---

## Paso 7 — Interpretar resultados

- **Todo `PASS`** → el baseline está bien aplicado. Continúa con el cierre (abajo).
- **Algún `FAIL`** → no sigas. Mira las consultas de **DETALLE** (más abajo en el mismo archivo) para ver qué falta. Lo más común:
  - `tablas_nucleo` FAIL → el script no terminó (vuelve al Paso 8).
  - `rls_todas_on` FAIL → alguna tabla quedó sin RLS; revisa el bloque §16 del SQL.
  - `seed_*` FAIL → el seed no se insertó; revisa el final del SQL (§18).
  - `sin_objetos_A1` / `sin_*_legacy` FAIL → hay algo que NO debería estar; **PARA** y avisa.

---

## Paso 8 — Qué hacer si FALLA

- **Si el `Run` del Paso 5 da error a mitad:**
  1. **NO metas datos reales.** La base está incompleta, no es para producción.
  2. **Copia el mensaje de error completo** (tabla/línea) y guárdalo.
  3. **No intentes parchear a mano** tabla por tabla. Lo más limpio en una base vacía es **borrar el proyecto y volver a crearlo** (Paso 1) y reaplicar — ver `ROLLBACK_NOTES.md`.
  4. Reporta el error a quien mantiene el baseline para corregir el `.sql` antes de reintentar.
- **Si los checks dan `FAIL`:** ver Paso 7. No improvises correcciones manuales sobre el esquema.

---

## Paso 9 — Qué NO tocar

- ❌ No toques **`Lidomare App`** ni el Supabase **legacy** (`swtyxysvnfcfxziclteq`).
- ❌ No apliques ninguna de las **~70 migraciones** de `services/supabase/migrations/` (son legacy).
- ❌ No metas datos reales (CIF, IBAN, facturas, movimientos, balances, pacientes).
- ❌ No cambies las claves de sitio ni las pegues en el repo.
- ❌ No edites el esquema a mano desde el Table Editor "para arreglar algo": si algo está mal, se corrige en el `.sql` y se reaplica en limpio.

---

## Paso 10 — Documentar el project ref (sin claves)

Cuando todo esté `PASS`:
- Anota en el sitio acordado (no en el repo): **nombre = `Antifrágil OS`**, **project ref = `<el nuevo>`**, **Project URL = `https://<ref>.supabase.co`**.
- **No** anotes anon key, service_role ni password junto a eso. Esas viven solo en el gestor de secretos.

---

## Cierre

- [ ] Baseline aplicado, todos los checks `PASS`.
- [ ] Claves en gestor de secretos, NO en el repo.
- [ ] Project ref documentado (sin claves).
- [ ] Pendiente (fase aparte, NO ahora): rellenar `configuracion_contabilidad` con emails reales y recablear el cliente. Ver README §8.
