# A2 — Clínica: catálogos / datos maestros (borrador, sobre el baseline `Antifrágil OS`)

> Estado: **BORRADOR — NO APLICAR** sin revisión explícita.
> Origen: borrador retirado del PR #2 (`202606261000_clinica_fase1_catalogos.sql`,
> commit `d08058d`), **curado** y re-propuesto por el canal DB conforme a la regla
> de governance: el SQL no viaja en PRs de feature.

## Qué añade A2

Los datos maestros del módulo Reservas/Clínica (11 tablas, prefijo `clinica_` en `public`):

| Bloque | Tablas |
|---|---|
| Usuarios y estructura | `clinica_usuarios` (auth→rol), `clinica_ubicaciones`, `clinica_recursos`, `clinica_profesionales` |
| Catálogo | `clinica_servicios`, `clinica_profesional_servicios` (M:N), `clinica_productos` |
| Clientes | `clinica_clientes` (ficha **administrativa**: contacto, condición tarifaria, RGPD) |
| Disponibilidad | `clinica_horarios_profesional`, `clinica_disponibilidad_excepcional`, `clinica_bloqueos_agenda` |

Seed mínimo: **1 ubicación** (`Clínica Antifrágil Playamar`, sociedad `ANT`). Nada más.

## Qué NO añade (fuera de A2)

- Citas, snapshots y estados (Fase 2 / A3).
- Auditoría de cambios de cita, pagos operativos de cita, bonos consumibles.
- Anti-solape (`EXCLUDE`/btree_gist) y RPC `SECURITY DEFINER` (incl. reserva pública).
- **Nada clínico**: ni historia clínica, ni diagnóstico, ni lesión, ni evolución, ni
  notas clínicas. Eso vive FUERA de Antifrágil OS (sistema clínico externo). Como
  mucho, en el futuro, un ID/enlace externo controlado — que tampoco entra en A2.
- Datos reales de ningún tipo.

## Relación con el resto

- **Baseline (PR #4)**: A2 se aplica ENCIMA del baseline. Reutiliza `touch_updated_at()`
  y referencia `sociedades(id_ref)` con FK real (el borrador original usaba texto suelto).
- **A1 Tesorería/Caja (PR #4)**: sin dependencia directa. En Fase 2, los pagos de cita
  enlazarán con el modelo de tesorería (medio_pago sin `banco`, caja con ledger propio).
- **Tipos (PR #2)**: `packages/types/src/clinica.ts` es el contrato TS 1:1 de estas
  tablas. Si este SQL cambia en revisión, los tipos deben actualizarse en consecuencia.
- **Doc de decisión de esquema**: `docs/reservas/05-decision-esquema-datos-clinica.md`
  (public + prefijo `clinica_`, no esquema aparte).

## Cambios respecto al borrador retirado del PR #2

1. Ya no redefine `touch_updated_at()` (lo aporta el baseline).
2. `sociedad_id_ref` pasa de texto suelto a **FK real** a `sociedades(id_ref)` en los
   5 maestros (ubicaciones, profesionales, servicios, productos, clientes).
3. Índice único `(sociedad_id_ref, nombre)` en ubicaciones + seed idempotente.
4. Comentarios de compliance corregidos: `clinica_clientes` es ficha administrativa;
   la historia clínica NO irá "en tabla aparte" de este OS — queda fuera del sistema.
5. Políticas RLS con nombres cortos y `drop policy if exists` (re-ejecutable).

## Cómo se aplicaría (después del baseline — NO ahora)

1. Baseline aplicado y `post_bootstrap_checks.sql` = PASS.
2. Pegar `001_a2_clinica_catalogos_draft.sql` completo en el SQL Editor y ejecutar.
3. Ejecutar `post_a2_checks.sql` (PARTE 1) → esperar `RESULTADO GLOBAL = PASS`.
4. Si FAIL → PARTE 2 para diagnóstico; no continuar ni meter datos.

Detalle paso a paso en `APPLY_A2_RUNBOOK.md`.

## Cómo evitar datos reales

- No insertar clientes, profesionales ni productos reales hasta que la revisión
  técnica y el checklist de seguridad del baseline estén cerrados.
- El seed es solo la ubicación; los catálogos se cargarán en una fase controlada.
- Nunca datos clínicos: si algo clínico aparece en una petición, es fuera de alcance.
