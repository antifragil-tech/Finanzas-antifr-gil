-- ═══════════════════════════════════════════════════════════════════════════
-- PR A — Saneamiento de facturas (2026-06-19)
--
-- Objetivo: dejar una base coherente sin migrar a nombres de estado nuevos.
--
-- Contexto del drift:
--   · La app, los types y la Edge Function `procesar-factura` usan los estados
--     TÉCNICOS canónicos: borrador_ocr | revision_javi | pendiente_pago | pagada | rechazada.
--   · La migración 20260521130000_facturas_estados_v2 intentó renombrarlos a
--     validacion | revision | pago, pero ese cambio NUNCA se reflejó en código
--     y dejó el modelo incoherente (incluso 20260526000000_facturas_fix_default
--     reafirma 'borrador_ocr' como default, contradiciendo a estados_v2).
--
-- Esta migración NEUTRALIZA estados_v2 de forma idempotente y segura:
--   · Es additiva y no destructiva.
--   · Si producción ya está en nombres ocr (lo esperado), los UPDATE no tocan
--     ninguna fila y el resto reafirma exactamente lo que ya hay → impacto cero.
--   · Si una BD aplicó estados_v2, esta migración la devuelve al estado canónico.
--   · No se editan migraciones históricas ya aplicadas (mala práctica): esta las
--     documenta y corrige hacia delante.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Remapeo defensivo de filas que pudieran haber quedado en nombres v2 ─────
update public.facturas_recibidas set estado = 'borrador_ocr'   where estado = 'validacion';
update public.facturas_recibidas set estado = 'revision_javi'  where estado = 'revision';
update public.facturas_recibidas set estado = 'pendiente_pago' where estado = 'pago';

-- ── 2. Reafirmar el CHECK canónico ─────────────────────────────────────────────
alter table public.facturas_recibidas
  drop constraint if exists facturas_recibidas_estado_check;

alter table public.facturas_recibidas
  add constraint facturas_recibidas_estado_check
  check (estado in ('borrador_ocr', 'revision_javi', 'pendiente_pago', 'pagada', 'rechazada'));

-- ── 3. Reafirmar el default canónico ───────────────────────────────────────────
alter table public.facturas_recibidas
  alter column estado set default 'borrador_ocr';

-- ── 4. Flag formal de notificaciones (siempre false por ahora) ─────────────────
-- No hay ningún envío real implementado. Esto solo formaliza el interruptor
-- maestro para fases futuras (emails a Javi/Alicia, recordatorios). Mientras sea
-- false, las notificaciones viven como bandejas/badges internos en la app.
alter table public.configuracion_contabilidad
  add column if not exists notifications_enabled boolean not null default false;
