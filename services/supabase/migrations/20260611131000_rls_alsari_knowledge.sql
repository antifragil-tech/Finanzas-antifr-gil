-- ──────────────────────────────────────────────────────────────────────────────
-- RLS para alsari_knowledge (sistema de conocimiento Python)
-- ──────────────────────────────────────────────────────────────────────────────
-- La tabla alsari_knowledge se creó fuera del flujo de migraciones (services/
-- python) y quedó SIN Row Level Security: cualquier peticion con la anon key
-- pública podía leer el contenido completo de los documentos confidenciales
-- del holding via PostgREST.
--
-- A diferencia del resto de tablas, aquí NO se crea política permisiva para
-- anon/authenticated: el único consumidor es el pipeline Python (ingest, MCP,
-- alertas), que usa la service_role key y bypasea RLS. El frontend no consume
-- esta tabla. Resultado: acceso público bloqueado, pipeline intacto.
--
-- Idempotente: se puede ejecutar varias veces sin error.

ALTER TABLE public.alsari_knowledge ENABLE ROW LEVEL SECURITY;

-- Verificación:
--   SELECT rowsecurity FROM pg_tables WHERE tablename = 'alsari_knowledge';
--   → debe devolver true
-- Smoke test del pipeline Python tras aplicar: una búsqueda MCP debe seguir
-- devolviendo resultados (usa service_role).
