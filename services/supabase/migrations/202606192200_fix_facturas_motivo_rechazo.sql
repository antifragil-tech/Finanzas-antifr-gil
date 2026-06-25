-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX (2026-06-22) — columna `motivo_rechazo` faltante en `facturas_recibidas`
--
-- BUG: la RPC `avanzar_estado_factura_con_auditoria` (PR B, migración
-- 202606191100) hace, en CADA transición de estado:
--     update public.facturas_recibidas
--        set estado = v_nuevo,
--            motivo_rechazo = case when p_accion='rechaza' then p_motivo_rechazo
--                                  else motivo_rechazo end, ...
-- pero la columna `motivo_rechazo` nunca se creó en `facturas_recibidas` (sí existe
-- en `factura_aprobaciones`, otra tabla). plpgsql no valida las referencias a
-- columnas al CREAR la función, solo al EJECUTARLA → fallo latente. Al pulsar
-- "Dar visto bueno" (acción `valida`) la RPC ejecuta ese UPDATE y revienta con
-- 42703: column "motivo_rechazo" does not exist, bloqueando TODA transición
-- (valida/aprueba/marca_pagada/rechaza).
--
-- FIX mínimo: añadir la columna nullable de forma idempotente. Sin tocar la RPC,
-- el frontend, la Edge Function, pagos, Storage ni OCR. El frontend no la lee (el
-- motivo de rechazo lo refleja además en `notas`); la columna queda como destino
-- válido del UPDATE y se rellena al rechazar.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.facturas_recibidas
  add column if not exists motivo_rechazo text;

comment on column public.facturas_recibidas.motivo_rechazo is
  'Motivo del rechazo escrito por la RPC avanzar_estado_factura_con_auditoria al '
  'rechazar. El frontend además lo refleja en `notas`. Añadida en hotfix 202606192200.';
