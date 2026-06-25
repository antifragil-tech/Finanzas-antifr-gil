-- Ampliar tipo CHECK para incluir fondos pignorados como tipo propio
ALTER TABLE vencimientos DROP CONSTRAINT IF EXISTS vencimientos_tipo_check;
ALTER TABLE vencimientos ADD CONSTRAINT vencimientos_tipo_check
  CHECK (tipo IN ('seguro', 'deuda', 'contrato', 'impuesto', 'compromiso', 'otro', 'pignorado'));

-- Eliminar la entrada incorrecta (tramo único, tipo 'otro', importe total)
DELETE FROM vencimientos
  WHERE titulo ILIKE '%Pignorados%' AND tipo = 'otro';

-- Insertar los 3 tramos reales del calendario de liberación Santander
INSERT INTO vencimientos (titulo, tipo, fecha_vencimiento, importe, notas, estado) VALUES
  (
    'Fondos Pignorados Santander — Tramo 1 (50%)',
    'pignorado',
    '2027-10-23',
    550000.00,
    'Liberación del 50% del aval bancario Santander (aval total: 1.051.378 €). Condicionado a no reclamaciones de Evariste por pasivos ocultos.',
    'pendiente'
  ),
  (
    'Fondos Pignorados Santander — Tramo 2 (25%)',
    'pignorado',
    '2028-10-23',
    275000.00,
    'Liberación del 25% del aval bancario Santander. Condicionado a no reclamaciones de Evariste por pasivos ocultos.',
    'pendiente'
  ),
  (
    'Fondos Pignorados Santander — Tramo 3 (25%)',
    'pignorado',
    '2029-10-23',
    275000.00,
    'Liberación del 25% restante. Recuperación total de los 1.100.000 € pignorados en Santander.',
    'pendiente'
  );
