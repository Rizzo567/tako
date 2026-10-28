-- Rollback della migrazione additiva del cervello (perimetro N). Elimina solo le tabelle nuove; restaurants non viene toccata.
-- Per spegnere il cervello senza perdere dati basta settings.botBrain=false (o TAKO_BOT_BRAIN_OFF=1).
BEGIN;
DROP TABLE IF EXISTS tako_owner_brain_turns;
DROP TABLE IF EXISTS tako_owner_brain_memory_log;
DROP TABLE IF EXISTS tako_owner_brain_memory;
-- Facoltativo, pulizia dell'interruttore: UPDATE restaurants SET settings=settings-'botBrain' WHERE settings ? 'botBrain';
COMMIT;
