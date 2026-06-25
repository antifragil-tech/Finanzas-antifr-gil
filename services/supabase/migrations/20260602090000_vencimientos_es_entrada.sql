-- Añadir campo de dirección de flujo de caja
ALTER TABLE vencimientos ADD COLUMN IF NOT EXISTS es_entrada BOOLEAN NOT NULL DEFAULT false;

-- Los fondos pignorados son siempre entradas (liberación de fondos propios)
UPDATE vencimientos SET es_entrada = true WHERE tipo = 'pignorado';
