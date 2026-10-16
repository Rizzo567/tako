-- Apply only to isolated staging first; backend role grants intentionally absent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.edge_login_buckets(key_hash text PRIMARY KEY CHECK(key_hash ~ '^[a-f0-9]{64}$'),epoch bigint NOT NULL DEFAULT 1,failures bigint NOT NULL DEFAULT 0,cleared bigint NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.edge_login_reservations(id uuid PRIMARY KEY,pair_hash text NOT NULL,ip_hash text NOT NULL,pair_epoch bigint NOT NULL,ip_epoch bigint NOT NULL,pair_baseline bigint NOT NULL,expires_at timestamptz NOT NULL);
ALTER TABLE public.edge_login_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_login_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_login_buckets,public.edge_login_reservations FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS edge_login_reservation_expiry ON public.edge_login_reservations(expires_at);
CREATE OR REPLACE FUNCTION public.reserve_edge_login(p_id uuid,p_pair text,p_ip text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE stamp timestamptz; pair public.edge_login_buckets%ROWTYPE; ip public.edge_login_buckets%ROWTYPE;
BEGIN
 IF p_pair IS NULL OR p_ip IS NULL OR p_pair=p_ip THEN RAISE EXCEPTION 'Invalid keys'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tako-login:'||least(p_pair,p_ip),0));
 PERFORM pg_advisory_xact_lock(hashtextextended('tako-login:'||greatest(p_pair,p_ip),0));
 stamp:=clock_timestamp();
 INSERT INTO public.edge_login_buckets AS b(key_hash,expires_at) VALUES(p_pair,stamp+interval '15 minutes'),(p_ip,stamp+interval '15 minutes')
 ON CONFLICT(key_hash) DO UPDATE SET epoch=CASE WHEN b.expires_at<=stamp THEN b.epoch+1 ELSE b.epoch END,failures=CASE WHEN b.expires_at<=stamp THEN 0 ELSE b.failures END,cleared=CASE WHEN b.expires_at<=stamp THEN 0 ELSE b.cleared END,expires_at=CASE WHEN b.expires_at<=stamp THEN stamp+interval '15 minutes' ELSE b.expires_at END;
 SELECT * INTO pair FROM public.edge_login_buckets WHERE key_hash=p_pair;
 SELECT * INTO ip FROM public.edge_login_buckets WHERE key_hash=p_ip;
 IF pair.failures-pair.cleared+(SELECT count(*) FROM public.edge_login_reservations WHERE pair_hash=p_pair AND pair_epoch=pair.epoch AND expires_at>stamp)>=5 OR ip.failures+(SELECT count(*) FROM public.edge_login_reservations WHERE ip_hash=p_ip AND ip_epoch=ip.epoch AND expires_at>stamp)>=30 THEN RETURN false; END IF;
 INSERT INTO public.edge_login_reservations VALUES(p_id,p_pair,p_ip,pair.epoch,ip.epoch,pair.failures,stamp+interval '2 minutes');
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.finish_edge_login(p_id uuid,p_result text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.edge_login_reservations%ROWTYPE;
BEGIN
 IF p_result NOT IN ('success','failure','abandon') OR p_result IS NULL THEN RAISE EXCEPTION 'Invalid result'; END IF;
 SELECT * INTO r FROM public.edge_login_reservations WHERE id=p_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tako-login:'||least(r.pair_hash,r.ip_hash),0));
 PERFORM pg_advisory_xact_lock(hashtextextended('tako-login:'||greatest(r.pair_hash,r.ip_hash),0));
 DELETE FROM public.edge_login_reservations WHERE id=p_id RETURNING * INTO r;
 IF NOT FOUND OR r.expires_at<=clock_timestamp() THEN RETURN false; END IF;
 IF p_result='failure' THEN
 UPDATE public.edge_login_buckets SET failures=failures+1 WHERE (key_hash=r.pair_hash AND epoch=r.pair_epoch) OR (key_hash=r.ip_hash AND epoch=r.ip_epoch);
 ELSIF p_result='success' THEN
 UPDATE public.edge_login_buckets SET cleared=greatest(cleared,r.pair_baseline) WHERE key_hash=r.pair_hash AND epoch=r.pair_epoch;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_edge_login(uuid,text,text),public.finish_edge_login(uuid,text) FROM PUBLIC,anon,authenticated;
COMMIT;
