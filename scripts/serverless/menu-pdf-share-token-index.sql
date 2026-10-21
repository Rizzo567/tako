-- 21/10/2026: indice per il link fisso dei PDF (GET /api/public/menu-pdf/:token).
-- La route cerca il locale con:
--   SELECT id,name,active,settings FROM restaurants WHERE settings->'pdfDocuments' @> '[{"shareToken":"…"}]'::jsonb LIMIT 2
-- (apps/server/src/routes/menu-workspace.ts). L'indice è sulla STESSA espressione (settings->'pdfDocuments') con
-- jsonb_path_ops, che supporta @>: la query resta com'è, nessuna modifica al codice.
-- Idempotente. NON applicata automaticamente. Tabella piccola: CREATE INDEX semplice (lock breve in scrittura su restaurants).
-- Applicazione: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/serverless/menu-pdf-share-token-index.sql
-- Rollback: DROP INDEX IF EXISTS restaurants_pdf_documents_path_ops_idx;
CREATE INDEX IF NOT EXISTS restaurants_pdf_documents_path_ops_idx
  ON restaurants USING gin ((settings->'pdfDocuments') jsonb_path_ops);
ANALYZE restaurants;
