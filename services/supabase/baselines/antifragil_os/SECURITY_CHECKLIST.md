# Checklist de seguridad previa — Baseline `Antifrágil OS`

> Revisar **antes** de aplicar el baseline. Si algo no se cumple, **PARA**.

## A. Proyecto correcto

- [ ] Voy a aplicar en un proyecto Supabase **NUEVO** llamado `Antifrágil OS`, en la organización `Antifrágil`.
- [ ] **NO** uso `Lidomare App` (`vaebfxmshydwxrtmzoei`).
- [ ] **NO** uso el Supabase **legacy** del repo (`swtyxysvnfcfxziclteq`).
- [ ] El project ref del proyecto nuevo es distinto de esos dos.

## B. Claves y secretos (lo más importante)

- [ ] **NO** copio la **anon key** en el repo, ni en esta carpeta, ni en chat.
- [ ] **NO** copio la **service_role key** en ningún sitio del repo.
- [ ] **NO** escribo la **DB password** en el repo. Va al gestor de contraseñas.
- [ ] Lo único que se puede anotar fuera del gestor es el **project ref** / **Project URL** (no son secretos).
- [ ] No hay ninguna clave en los archivos de `services/supabase/baselines/antifragil_os/`.

## C. Contenido del SQL (anti-legacy)

- [ ] El `00000000000000_baseline_antifragil_os.sql` **no contiene** las cadenas `Alsari`, `Pavier`, `Armia`, `Rialsa` (verificado: 0 ocurrencias).
- [ ] No contiene `finanzas_sociedades`, `proyecto_sociedades`, `pct_pavier`, `pct_armia`, `alsari_knowledge`.
- [ ] No hay `INSERT` de datos reales: los únicos `INSERT` son lógica de RPC, el bucket de storage y el **seed propio** de Antifrágil.

## D. Seguridad del esquema

- [ ] **RLS activado** en las 26 tablas (lo crea el propio baseline, §16).
- [ ] **`anon` sin acceso** (no se crea ninguna policy para el rol `anon`).
- [ ] Los **libros append-only** (`factura_pagos`, `factura_incidencias`, `factura_aprobaciones`) son **solo SELECT** para el cliente; la escritura va por RPC.
- [ ] El **bucket `facturas` es privado** (`public = false`); sin política de acceso público.

## E. Sin datos reales

- [ ] **No** se cargan datos reales con el baseline.
- [ ] **No** pacientes reales.
- [ ] **No** facturas reales.
- [ ] **No** movimientos bancarios reales.
- [ ] **No** balances reales.
- [ ] **No** IBAN ni CIF reales (el seed crea `Antifrágil S.C.` con `cif = NULL` y sin cuentas bancarias).

## F. Operadores / roles

- [ ] Sé que `configuracion_contabilidad` arranca con **emails placeholder** (`pendiente@antifragil.invalid`) y que mientras los 3 sean iguales el sistema está en **modo single-operator** (sin control de rol). Los emails reales se ponen **después**, en una fase aparte, no ahora.

## G. Alcance

- [ ] No toco `services/supabase/migrations/` (legacy).
- [ ] No toco `.env`, `packages/supabase-client`, ni el frontend.
- [ ] No hago push, PR, merge ni rebase.

> Si todas las casillas están marcadas, puedes seguir con `APPLY_RUNBOOK.md`.
