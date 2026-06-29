# Baseline curado — Supabase `Antifrágil OS`

> **Estado: BORRADOR. NO aplicado.** Esquema fundacional para un proyecto Supabase **nuevo y limpio** de Antifrágil OS. No es una migración de `services/supabase/migrations/` (ahí viven las ~70 migraciones **heredadas/legacy** que **NO deben aplicarse** a este Supabase nuevo).

## Archivos de esta carpeta

| Archivo | Qué es |
|---|---|
| `00000000000000_baseline_antifragil_os.sql` | Esquema completo consolidado y curado (tablas + RPC + vistas + RLS + Storage + seed mínimo). |
| `README.md` | Este documento. |
| `post_bootstrap_checks.sql` | Consultas de verificación de **solo lectura** para correr **después** de aplicar el baseline. |
| `excluded_legacy.md` | Lista explícita de todo lo que se excluye y por qué. |

## 1. Qué crea el baseline

**Modelo:** sociedad única (`Antifrágil S.C.`) con varios proyectos. Núcleo financiero completo.

- **Maestro:** `sociedades`, `proyectos`, `cuentas_bancarias_sociedad`.
- **Config/contabilidad:** `configuracion_contabilidad`, `plan_cuentas`, `reglas_categorizacion`, `contactos`, `proveedores_reglas`.
- **Banco:** `movimientos_bancarios`, `extractos_bancarios`.
- **Facturas:** `facturas_recibidas`, `facturas_emitidas` (tabla base).
- **Pagos (append-only):** `factura_pagos`, `factura_incidencias`, `factura_aprobaciones`.
- **Asientos/reconciliación:** `asientos_borrador`, `asientos_oficiales`, `reconciliacion_log`.
- **Presupuestos:** `presupuestos`, `presupuesto_capitulos`, `presupuesto_partidas`, `presupuesto_pagos` (los **ingresos** se modelan con `presupuestos.categoria='ingreso'` + `factura_emitida_id`; no hay tabla `presupuesto_ingresos` independiente).
- **Tesorería:** `vencimientos`, `flujos_caja_proyectos`.
- **Balance/KPI:** `balance_sumas_saldos`, `kpis_sociedades`.
- **Funciones/RPC:** `touch_updated_at`, `registrar_pago_factura`, `resolver_incidencia_factura`, `importar_extracto_bancario`, `deshacer_importacion_extracto`.
- **Vistas:** `v_balance_periodos`, `saldo_bancario_por_sociedad`, `compromisos_tesoreria`, `flujos_proyecto_consolidados`, `cashflow_consolidado` (todas en modelo sociedad única, sin reparto multi-holding).
- **Storage:** bucket privado `facturas` + políticas (SELECT authenticated; INSERT acotado a `recibidas/*/pagos/*`).
- **RLS:** ON en todas las tablas; `anon` sin acceso; `authenticated` FOR ALL en tablas de gestión; libros append-only solo SELECT (escritura por RPC).
- **Seed mínimo (sin datos reales):** `Antifrágil S.C.` (`ANT`), proyectos `CLI-PLY` (activo), `9AM`/`LIDO`/`EVT` (placeholder), y la fila `configuracion_contabilidad` con **emails placeholder**.

## 2. Qué excluye

Ver `excluded_legacy.md` para la lista completa. En resumen: nada de la base anterior — multi-holding y reparto por porcentajes, patrimonio personal, lente de inversión (TIR/VAN), fuente externa de KPIs (hoja de cálculo vía worker), seeds de datos reales, y los módulos de otras líneas (Clínica, Reservas, A1 tesorería/caja, workflows avanzados de facturación emitida).

## 3. Cómo se aplicaría manualmente (en el futuro, NO ahora)

1. Crear el proyecto Supabase **`Antifrágil OS`** en la organización `Antifrágil` (región EU/Frankfurt). Guardar la **DB password** en gestor de secretos.
2. Abrir **SQL Editor** del Dashboard del proyecto **nuevo** (verificar dos veces que NO es el legacy ni `Lidomare App`).
3. Pegar y ejecutar **`00000000000000_baseline_antifragil_os.sql`** completo (una sola transacción lógica; el orden interno respeta las dependencias de FK, con la FK circular `facturas_recibidas ↔ presupuesto_pagos` diferida en §8).
4. Ejecutar **`post_bootstrap_checks.sql`** y confirmar que todo sale como se espera (ver §5).
5. Rellenar `configuracion_contabilidad` con los **emails reales** de los operadores de Antifrágil (no antes).
6. Recablear el cliente para apuntar al proyecto nuevo (tarea aparte; **no** se toca en este baseline).

## 4. Advertencias de seguridad

- **Emails placeholder:** `configuracion_contabilidad` arranca con `pendiente@antifragil.invalid` en los 3 roles. Mientras los 3 sean iguales, el sistema corre en **modo single-operator** (las RPC no exigen rol → cualquiera autenticado puede registrar pagos). **Antes de meter datos reales**, poner los emails reales de los operadores autorizados.
- **Roles heredados:** los nombres de rol `guille/javi/alicia` están incrustados en las RPC (verbatim). Revisar si el mapeo de roles es el correcto para Antifrágil antes de producción.
- **Claves:** la `anon`/`service_role` del proyecto nuevo van a gestor de secretos, **nunca** al repo. No reutilizar las claves del proyecto legacy.
- **RLS:** permisiva (`authenticated USING(true)`) = sistema de confianza interna. Si en algún momento entran usuarios no-confiables, endurecer.
- **Storage:** bucket `facturas` **privado**; las subidas de PDFs de factura las hace la Edge Function con `service_role`. No exponer el bucket.
- **Datos reales:** este baseline NO trae datos reales. No añadir CIF/IBAN/facturas/movimientos/balances reales hasta que se autorice expresamente.

## 5. Checklist post-bootstrap

Correr `post_bootstrap_checks.sql` y confirmar:

- [ ] Existen las 26 tablas núcleo y las 5 vistas.
- [ ] RLS activado en todas las tablas; `anon` sin políticas de acceso.
- [ ] Base **vacía** salvo el seed: `sociedades`=1, `proyectos`=4, `configuracion_contabilidad`=1, resto=0.
- [ ] Seed correcto: existe `ANT`/`Antifrágil S.C.`; `CLI-PLY` activo; `9AM`/`LIDO`/`EVT` placeholder; **sin CIF/IBAN**.
- [ ] **No** existen objetos A1 (`cuenta_tesoreria`, `movimiento_caja`, `arqueo_caja`, `saldo_tesoreria`, `tesoreria`).
- [ ] **No** hay rastro de la base anterior (sin columnas de reparto multi-holding, sin `proyecto_sociedades`/`vencimiento_sociedades`, sin `patrimonio`, sin tablas de inversión/escenarios, sin `*_knowledge`).
- [ ] Las 5 vistas devuelven (vacías o con el seed) sin error de dependencia.

## 6. Notas de implementación

- **FK circular** `facturas_recibidas.presupuesto_pago_id ↔ presupuesto_pagos.factura_recibida_id`: resuelta creando `facturas_recibidas` sin esa FK y añadiéndola con `ALTER TABLE` en §8, tras crear `presupuesto_pagos`.
- **`presupuesto_pagos.estado`**: CHECK ampliado a `pendiente/pagado/cancelado/estimado/confirmado/facturado` para casar con la vista `flujos_proyecto_consolidados` (salda una deuda conocida del esquema heredado).
- **`vencimientos`**: se conserva la definición de `20260520100000` (la que ganaba por orden de migración: campos `tipo`, `sociedad_id`, `recurrencia`, estados `pendiente/gestionado/vencido`) + `es_entrada`; excluidos los tipos `pignorado`/`prestamo` (lente inversión).
- **Procedencia**: cada bloque del `.sql` lleva comentarios `-- fuente: <archivo>.sql` apuntando a la migración heredada de la que se derivó.

## 7. Inventario verificado del baseline

Conteo verificado sobre `00000000000000_baseline_antifragil_os.sql` (grep + revisión manual):

| Elemento | Nº | Detalle |
|---|---|---|
| **Tablas** | **26** | maestro (3) · config/contabilidad (4) · banco (2) · facturas (2) · pagos append-only (3) · asientos/recon (3) · presupuestos (4) · tesorería/flujos (2) · balance/KPI (2) · proveedores (1) |
| **Vistas** | **5** | `v_balance_periodos`, `saldo_bancario_por_sociedad`, `compromisos_tesoreria`, `flujos_proyecto_consolidados`, `cashflow_consolidado` |
| **Funciones** | **5** | 1 trigger (`touch_updated_at`) + 4 RPC |
| **RPC (security definer)** | **4** | `registrar_pago_factura`, `resolver_incidencia_factura`, `importar_extracto_bancario`, `deshacer_importacion_extracto` |
| **Triggers** | **15** | `touch_updated_at` BEFORE UPDATE en las 15 tablas con `updated_at` |
| **Políticas RLS** | **26** | 23 `FOR ALL TO authenticated` + 3 append-only `SELECT` (una por tabla); `anon` sin políticas |
| **Buckets Storage** | **1** | `facturas` (privado, `public=false`) + 2 políticas (SELECT auth, INSERT acotado) |
| **Filas de seed (propias)** | **6** | 1 sociedad (`ANT`) + 4 proyectos + 1 fila `configuracion_contabilidad` |

- ✅ **Sin datos reales:** los únicos `INSERT` son (a) lógica dentro de RPC, (b) `storage.buckets`, (c) seed propio de Antifrágil. Sociedad con `cif=NULL`, sin cuentas bancarias, sin facturas/movimientos/balances.
- ✅ **Sin legacy:** 0 ocurrencias de `Alsari/Pavier/Armia/Rialsa/finanzas_sociedades/proyecto_sociedades/pct_pavier/pct_armia` en el `.sql` (verificado por grep). Lista de exclusiones en `excluded_legacy.md`; verificación en producción en `post_bootstrap_checks.sql` (PARTE 1, checks 12–15).

## 8. Variables de entorno (FASE POSTERIOR — no forma parte del baseline)

> Esto NO se toca al aplicar el baseline. Se documenta aquí solo para la fase de **recableado del cliente**, que es una tarea **separada y aún no autorizada**.

Cuando exista el proyecto nuevo, harán falta (cada una con el valor del proyecto **nuevo**, nunca del legacy):

| Capa | Variables |
|---|---|
| Host (Next.js) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (en `apps/host/.env.local`) |
| Módulos (Vite) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Edge Functions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (solo backend, nunca cliente) |
| Servicio Python | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_PASSWORD` |

**Qué NO debe hacerse:**
- ❌ No pegar `anon`/`service_role`/password en el repo ni en esta carpeta.
- ❌ No reutilizar las claves del proyecto legacy.
- ⚠️ **`packages/supabase-client/src/index.ts` sigue con el ref + anon key LEGACY hardcodeados como fallback.** Apuntar al proyecto nuevo exige editarlo (idealmente, que lea de variables de entorno en vez de hardcodear). **Ese cambio es una fase aparte, NO forma parte de este baseline** y aquí está explícitamente fuera de alcance.
