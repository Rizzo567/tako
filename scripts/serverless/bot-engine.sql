-- Interruttore del motore del bot titolare (run Haiku 21/10/2026): settings.botEngine='haiku' SOLO sul locale QA.
-- Lettore unico: apps/server/src/lib/owner-brain-switch.ts (settings.botEngine → env TAKO_BOT_ENGINE_DEFAULT → 'haiku').
-- QA = 26050ecd-2e55-4057-a4c5-bff2b449cd47 («Tako · Verifica web»).
-- MAI Victoria Bar (528e263c…) né altri clienti: restano sul default del server (TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=groq).
-- Esecuzione: una sezione alla volta (vedi docs/webapp/bot-haiku-2026-10-21/DEPLOY-QA.md, passo d). Questo file NON si esegue intero.

-- ===== [1] ACCENSIONE (una sola riga, altrimenti RAISE e ROLLBACK automatico) =====
BEGIN;
DO $$
DECLARE n integer;
BEGIN
  UPDATE restaurants
     SET settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{botEngine}', '"haiku"', true)
   WHERE id = '26050ecd-2e55-4057-a4c5-bff2b449cd47';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'bot-engine: attesa 1 riga (QA), aggiornate %', n; END IF;
  IF (SELECT count(*) FROM restaurants WHERE settings->>'botEngine' IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'bot-engine: botEngine presente su locali diversi dal QA, stop';
  END IF;
END $$;
COMMIT;
-- ===== fine [1] =====

-- ===== [2] VERIFICA (sola lettura) =====
SELECT id, name, settings->>'botEngine' AS bot_engine, settings->>'botBrain' AS bot_brain
  FROM restaurants
 WHERE settings ? 'botEngine' OR id = '26050ecd-2e55-4057-a4c5-bff2b449cd47';
-- Atteso: UNA riga, id 26050ecd…, bot_engine = haiku (bot_brain = true, già acceso dal 17/10).
-- ===== fine [2] =====

-- ===== [3] ROLLBACK (toglie la chiave: il QA torna al default del server) =====
BEGIN;
DO $$
DECLARE n integer;
BEGIN
  UPDATE restaurants SET settings = settings - 'botEngine'
   WHERE id = '26050ecd-2e55-4057-a4c5-bff2b449cd47' AND settings ? 'botEngine';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 1 THEN RAISE EXCEPTION 'bot-engine rollback: attesa al più 1 riga, aggiornate %', n; END IF;
END $$;
COMMIT;
-- Verifica rollback: SELECT count(*) FROM restaurants WHERE settings ? 'botEngine';  → 0
-- ===== fine [3] =====
