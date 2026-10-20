-- No INSERT SELECT backfill: existing clients never receive historical welcomes.
CREATE TABLE IF NOT EXISTS tako_email_welcome_events (
 user_id uuid NOT NULL REFERENCES users(id), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 PRIMARY KEY(user_id,restaurant_id)
);
ALTER TABLE tako_email_welcome_events ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tako_email_welcome_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_email_welcome_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_email_welcome_events TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_email_welcome ON tako_email_welcome_events;
CREATE POLICY runtime_email_welcome ON tako_email_welcome_events TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION tako_capture_email_welcome() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='tako_whatsapp_links' THEN
  IF TG_OP='UPDATE' AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id AND NEW.restaurant_id IS NOT DISTINCT FROM OLD.restaurant_id AND NOT(OLD.activated_at IS NULL AND NEW.activated_at IS NOT NULL) THEN RETURN NEW; END IF;
  INSERT INTO tako_email_welcome_events(user_id,restaurant_id)
  SELECT u.id,r.id FROM users u JOIN restaurants r ON r.id=NEW.restaurant_id
  WHERE u.id=NEW.actor_id AND u.restaurant_id=r.id AND u.role='owner' AND u.active AND r.active AND NEW.activated_at IS NOT NULL AND u.email!~*'\.(invalid|local|example)$' AND u.email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ON CONFLICT(user_id,restaurant_id) DO UPDATE SET processed_at=NULL,available_at=now();
 ELSE
  IF TG_OP='UPDATE' AND NOT(OLD.active=false AND NEW.active=true) AND NOT((OLD.email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR OLD.email~*'\.(invalid|local|example)$') AND NEW.email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND NEW.email!~*'\.(invalid|local|example)$') THEN RETURN NEW; END IF;
  INSERT INTO tako_email_welcome_events(user_id,restaurant_id)
  SELECT NEW.id,r.id FROM tako_whatsapp_links l JOIN restaurants r ON r.id=l.restaurant_id
  WHERE l.actor_id=NEW.id AND NEW.restaurant_id=r.id AND NEW.role='owner' AND NEW.active AND r.active AND l.activated_at IS NOT NULL AND NEW.email!~*'\.(invalid|local|example)$' AND NEW.email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ON CONFLICT(user_id,restaurant_id) DO UPDATE SET processed_at=NULL,available_at=now();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tako_capture_email_welcome() FROM PUBLIC;
DROP TRIGGER IF EXISTS tako_email_welcome_link ON tako_whatsapp_links;
CREATE TRIGGER tako_email_welcome_link AFTER INSERT OR UPDATE OF actor_id,restaurant_id,activated_at ON tako_whatsapp_links FOR EACH ROW EXECUTE FUNCTION tako_capture_email_welcome();
DROP TRIGGER IF EXISTS tako_email_welcome_user ON users;
CREATE TRIGGER tako_email_welcome_user AFTER INSERT OR UPDATE OF active,email ON users FOR EACH ROW EXECUTE FUNCTION tako_capture_email_welcome();
