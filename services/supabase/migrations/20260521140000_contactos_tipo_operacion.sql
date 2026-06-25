-- Migración: contactos, tipo_operacion, receptor_ocr, contacto_id
-- Aplicar ANTES de redesplegar la Edge Function procesar-factura.
-- Orden: 1) aplicar esta migración → 2) redesplegar función.

-- ── 1. Tabla contactos ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contactos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL,
  nif        TEXT,
  tipo       TEXT        NOT NULL DEFAULT 'proveedor'
                         CHECK (tipo IN ('proveedor', 'cliente', 'ambos')),
  email      TEXT,
  telefono   TEXT,
  direccion  TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice único por NIF (sólo cuando el NIF está presente y no vacío)
CREATE UNIQUE INDEX IF NOT EXISTS contactos_nif_unique
  ON public.contactos(nif)
  WHERE nif IS NOT NULL AND nif <> '';

ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contactos: acceso total"
  ON public.contactos FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contactos_updated_at ON public.contactos;
CREATE TRIGGER contactos_updated_at
  BEFORE UPDATE ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 2. Nuevas columnas en facturas_recibidas ──────────────────────────────────

ALTER TABLE public.facturas_recibidas
  ADD COLUMN IF NOT EXISTS tipo_operacion TEXT
    DEFAULT 'normal'
    CHECK (tipo_operacion IN ('normal','exenta','no_sujeta','inversion_sujeto_pasivo','suplido')),
  ADD COLUMN IF NOT EXISTS receptor_nombre_ocr TEXT,
  ADD COLUMN IF NOT EXISTS receptor_nif_ocr    TEXT,
  ADD COLUMN IF NOT EXISTS contacto_id         UUID REFERENCES public.contactos(id);

-- Las filas existentes quedan con tipo_operacion = 'normal' por el DEFAULT.
