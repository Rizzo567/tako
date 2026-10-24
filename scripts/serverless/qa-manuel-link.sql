-- Ricollegamento del numero WhatsApp di Manuel al SOLO locale QA (autorizzato da Manuel: RISPOSTE-MANUEL.md punto 5, 20/10/2026).
-- QA = 26050ecd-2e55-4057-a4c5-bff2b449cd47. MAI Victoria Bar 528e263c-634e-4695-9632-6c5cc6a3302f (lì c'è il numero di Gio).
-- __MANUEL_PHONE__ è sostituito da scripts/serverless/qa-deploy-sql.mjs leggendo ~/.config/tako-webapp/owner-service-qa-backup.json
-- (link.phone, formato whatsapp:+39…): il numero non sta nel repo e non viene stampato.
-- Schema: tako_whatsapp_links(phone PK, restaurant_id UNIQUE, actor_id, created_at, activated_at, owner_email, password_reissue).
-- Indice unico per locale → l'eventuale numero già collegato al QA (es. fittizio di prova) va tolto: il runner lo salva prima
-- in ~/.config/tako-webapp/rollback-edge-20261021/qa-links-before.json e lo rimette nel rollback.
-- Stesso effetto del comando «collega tako <codice>» (routes/twilio-menu.ts), senza messaggi WhatsApp.

-- ===== [1] STATO (sola lettura) =====
SELECT 'phone' AS kind, restaurant_id, actor_id, created_at, activated_at, owner_email
  FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__'
UNION ALL
SELECT 'qa', restaurant_id, actor_id, created_at, activated_at, owner_email
  FROM tako_whatsapp_links WHERE restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47' AND phone <> '__MANUEL_PHONE__';
-- ===== fine [1] =====

-- ===== [2] COLLEGA AL QA =====
BEGIN;
DO $$
DECLARE n integer; owner_id uuid;
BEGIN
  -- Il numero non deve essere collegato a un altro locale (mai rubare un collegamento a un cliente).
  IF EXISTS (SELECT 1 FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__'
              AND restaurant_id <> '26050ecd-2e55-4057-a4c5-bff2b449cd47') THEN
    RAISE EXCEPTION 'qa-link: il numero è collegato a un altro locale, stop (nessuna modifica)';
  END IF;
  SELECT id INTO owner_id FROM users
   WHERE restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47' AND role = 'owner' AND active = true
   ORDER BY created_at LIMIT 1;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'qa-link: QA senza titolare attivo, stop'; END IF;
  DELETE FROM tako_whatsapp_proposals WHERE phone = '__MANUEL_PHONE__';
  DELETE FROM tako_whatsapp_links
   WHERE restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47' AND phone <> '__MANUEL_PHONE__';
  INSERT INTO tako_whatsapp_links(phone, restaurant_id, actor_id, activated_at)
  VALUES ('__MANUEL_PHONE__', '26050ecd-2e55-4057-a4c5-bff2b449cd47', owner_id, now())
  ON CONFLICT (phone) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, actor_id = EXCLUDED.actor_id,
                                    created_at = now(), activated_at = now();
  SELECT count(*) INTO n FROM tako_whatsapp_links
   WHERE phone = '__MANUEL_PHONE__' AND restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47';
  IF n <> 1 THEN RAISE EXCEPTION 'qa-link: atteso 1 collegamento sul QA, trovati %', n; END IF;
  IF EXISTS (SELECT 1 FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__'
              AND restaurant_id = '528e263c-634e-4695-9632-6c5cc6a3302f') THEN
    RAISE EXCEPTION 'qa-link: numero su Victoria, stop';
  END IF;
END $$;
COMMIT;
-- ===== fine [2] =====

-- ===== [3] VERIFICA (sola lettura) =====
SELECT
  (SELECT count(*) FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__' AND restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47') AS on_qa,
  (SELECT count(*) FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__' AND restaurant_id = '528e263c-634e-4695-9632-6c5cc6a3302f') AS on_victoria,
  (SELECT count(*) FROM tako_whatsapp_links WHERE phone = '__MANUEL_PHONE__') AS total,
  (SELECT count(*) FROM tako_whatsapp_links WHERE restaurant_id = '528e263c-634e-4695-9632-6c5cc6a3302f') AS victoria_links;
-- Atteso: on_qa=1, on_victoria=0, total=1, victoria_links=1 (il numero di Gio, invariato).
-- ===== fine [3] =====

-- ===== [4] ROLLBACK (scollega il numero dal QA; i collegamenti QA salvati li rimette il runner) =====
BEGIN;
DO $$
DECLARE n integer;
BEGIN
  DELETE FROM tako_whatsapp_proposals WHERE phone = '__MANUEL_PHONE__';
  DELETE FROM tako_whatsapp_links
   WHERE phone = '__MANUEL_PHONE__' AND restaurant_id = '26050ecd-2e55-4057-a4c5-bff2b449cd47';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 1 THEN RAISE EXCEPTION 'qa-link rollback: attesa al più 1 riga, tolte %', n; END IF;
END $$;
COMMIT;
-- ===== fine [4] =====
