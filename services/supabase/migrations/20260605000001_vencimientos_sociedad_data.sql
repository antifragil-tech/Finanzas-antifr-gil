-- ============================================================
-- Asignación de sociedades a vencimientos existentes
-- Fuente: Calendario de Pagos - Alsari.xlsx
-- ============================================================
-- Mapa de sociedades:
--   '1'    = Javier Alarcón Rivera (persona física)
--   '2'    = Iván Alarcón Rivera (persona física)
--   'S-001' = Alsari Inversiones S.L.
-- ============================================================

-- Corregir sociedad_id en vencimientos con datos erróneos
-- Precio Aplazado Álvaro Ferreras: tenía S-002 (Rialsa), debe ser Javier (1)
UPDATE public.vencimientos
  SET sociedad_id = '1'
  WHERE id = 'cf9b04f5-a155-40f5-8c42-37ff54a7fbde';

-- Limpiar junction table y repoblar con datos correctos
DELETE FROM public.vencimiento_sociedades;

INSERT INTO public.vencimiento_sociedades (vencimiento_id, sociedad_id, porcentaje) VALUES

-- Seguro parcela de Campanillas → Alsari Inversiones 100%
('0c3a904b-85aa-4b97-9e09-594ca5143020', 'S-001', 100),

-- Earn-out Evariste 2 tramo → Javier 100%
('6508114f-c70b-451a-bbc6-470866a1b622', '1', 100),

-- Préstamo a Procourval (Javier) → Javier 100%
('d6ddcd11-f3ef-4e2f-a611-7c5130be23d7', '1', 100),

-- Préstamo a Procourval (Padre) → Javier 100%
-- El padre (FCO. Javier Alarcón García) no está como entidad separada
('8319be83-4c3d-40ef-9d95-41be69d9be2d', '1', 100),

-- Precio Aplazado Álvaro Ferreras → Javier 100%
('cf9b04f5-a155-40f5-8c42-37ff54a7fbde', '1', 100),

-- Préstamos Perisur (5 contratos) → Javier 50% + Iván 50%
('fa983314-d37e-4cd9-bac9-d830ff7eb187', '1', 50),
('fa983314-d37e-4cd9-bac9-d830ff7eb187', '2', 50),
('e0d6e493-f6b5-4c91-b0c3-8ad7eb16a807', '1', 50),
('e0d6e493-f6b5-4c91-b0c3-8ad7eb16a807', '2', 50),
('30e9c0f1-ae37-4431-a193-5510b5489607', '1', 50),
('30e9c0f1-ae37-4431-a193-5510b5489607', '2', 50),
('9e2d9d6b-6033-4186-aa7a-5046d7616267', '1', 50),
('9e2d9d6b-6033-4186-aa7a-5046d7616267', '2', 50),
('f93c99f6-e9de-429d-95b2-79018941914c', '1', 50),
('f93c99f6-e9de-429d-95b2-79018941914c', '2', 50),

-- Fondos Pignorados Santander (3 tramos) → Javier 100%
('357f7300-1996-4291-a26c-c56d82339b66', '1', 100),
('f01caf18-1dc3-4500-9796-72406a4ea1db', '1', 100),
('d492e18c-4044-4491-8c4d-b359d152f63b', '1', 100),

-- Préstamo Personal Javier a Iván → Javier 100%
('54ddb259-8443-43a8-a2b1-8bc873d27115', '1', 100),

-- Préstamo Javier a Ivaltia (Parcela) → Javier 100%
('d25e0d9d-5298-4241-90cd-c2ea9497162d', '1', 100);

-- Los prestamos Rialsa ya están como 'gestionado' (importe 0) — no se asignan
-- 'aa1eb5b2-da45-4799-9884-0a61436731ee' → Prestamo Rialsa Javier (gestionado)
-- '408d97e5-374f-4ba9-a0c8-819e4ad07ad9' → Prestamo Rialsa Iván (gestionado)

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
-- SELECT v.titulo, vs.sociedad_id, vs.porcentaje, s.nombre
-- FROM vencimientos v
-- JOIN vencimiento_sociedades vs ON vs.vencimiento_id = v.id
-- LEFT JOIN sociedades s ON s.id_ref = vs.sociedad_id
-- ORDER BY v.fecha_vencimiento, vs.porcentaje DESC;
