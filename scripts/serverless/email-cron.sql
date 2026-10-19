-- The secret is provisioned separately in Supabase Vault, never embedded in cron.job.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION tako_email_request_tick() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE secret text; request_id bigint;
BEGIN
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='takomenu-email-cron' LIMIT 1;
 IF secret IS NULL OR length(secret)<32 THEN RETURN NULL; END IF;
 SELECT net.http_post(
  url:='https://takoitalia.com/api/web-accounts/email/tick',
  headers:=jsonb_build_object('Content-Type','application/json','Origin','https://takoitalia.com','x-tako-cron-secret',secret),
  body:='{}'::jsonb,timeout_milliseconds:=55000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION tako_email_request_tick() FROM PUBLIC,anon,authenticated,takomenu_runtime;
-- Activate only after the live email routes and queue have been verified.
-- SELECT cron.schedule('takomenu-email-delivery','* * * * *','SELECT public.tako_email_request_tick()');
