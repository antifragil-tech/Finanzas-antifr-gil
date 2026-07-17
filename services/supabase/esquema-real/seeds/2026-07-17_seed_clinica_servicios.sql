-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — catálogo mínimo de servicios de la clínica (PENDIENTE DE AUTORIZAR)
-- ═══════════════════════════════════════════════════════════════════════════
-- clinica_servicios está VACÍA en la base real; sin servicios, el alta de
-- citas reales desde la agenda no puede funcionar. Este seed crea los 3
-- servicios principales (decisión de negocio registrada: "Fisio deportiva"
-- NO es servicio, es etiqueta dentro de Fisioterapia). Duraciones reales:
-- fisio 45' · nutrición 30' · entrenamiento 60'. Sin precios (la tarifa se
-- fija por cita en precio_snapshot hasta definir el tarifario).
--
-- REGLA: NO aplicar sin autorización expresa de Guille. Idempotente (se salta
-- los nombres que ya existan).

insert into public.clinica_servicios (nombre, categoria, duracion_minutos, activo)
select v.nombre, v.categoria, v.duracion, true
from (
  values
    ('Fisioterapia', 'fisioterapia', 45),
    ('Nutrición', 'nutricion', 30),
    ('Entrenamiento', 'entrenamiento_personal', 60)
) as v (nombre, categoria, duracion)
where not exists (
  select 1 from public.clinica_servicios s where s.nombre = v.nombre
);

-- Verificación (esperado: 3 filas activas)
select nombre, categoria, duracion_minutos from public.clinica_servicios
where activo order by nombre;
