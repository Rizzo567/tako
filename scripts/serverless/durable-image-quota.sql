-- PREPARED ONLY: no remote migration. Backend-only privileged functions/table access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.edge_image_quota_accounts (
 tenant_id uuid PRIMARY KEY,
 quota_bytes bigint NOT NULL DEFAULT 2147483648 CHECK(quota_bytes BETWEEN 1 AND 9007199254740991),
 seeded_at timestamptz,
 seed_checkpoint text
);
CREATE TABLE IF NOT EXISTS public.edge_image_quota_objects (
 tenant_id uuid NOT NULL REFERENCES public.edge_image_quota_accounts(tenant_id),
 object_hash text NOT NULL CHECK(object_hash ~ '^[a-f0-9]{64}$'),
 content_hash text CHECK(content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'),
 bytes bigint NOT NULL CHECK(bytes > 0),
 state text NOT NULL CHECK(state IN ('reserved','committed')),
 expires_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,object_hash)
);
ALTER TABLE public.edge_image_quota_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_image_quota_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_image_quota_accounts,public.edge_image_quota_objects FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS edge_image_pending_expiry ON public.edge_image_quota_objects(expires_at) WHERE state='reserved';

-- Full preexisting Storage listing checkpoint is mandatory; writes must be frozen
-- during this seed inventory. Seed only once. Duplicate/hash ambiguity aborts.
CREATE OR REPLACE FUNCTION public.seed_edge_image_quota(p_tenant uuid,p_assets jsonb,p_checkpoint text,p_quota bigint DEFAULT 2147483648)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE asset jsonb; account public.edge_image_quota_accounts%ROWTYPE;
BEGIN
 IF p_checkpoint IS NULL OR length(p_checkpoint)<16 OR p_assets IS NULL OR jsonb_typeof(p_assets)<>'array' THEN RAISE EXCEPTION 'Complete asset checkpoint required'; END IF;
 INSERT INTO public.edge_image_quota_accounts(tenant_id,quota_bytes) VALUES(p_tenant,p_quota) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.edge_image_quota_accounts WHERE tenant_id=p_tenant FOR UPDATE;
 IF account.seeded_at IS NOT NULL THEN RETURN false; END IF;
 FOR asset IN SELECT * FROM jsonb_array_elements(p_assets) LOOP
  INSERT INTO public.edge_image_quota_objects(tenant_id,object_hash,content_hash,bytes,state) VALUES(p_tenant,asset->>'object_hash',asset->>'content_hash',(asset->>'bytes')::bigint,'committed');
 END LOOP;
 UPDATE public.edge_image_quota_accounts SET seeded_at=clock_timestamp(),seed_checkpoint=p_checkpoint WHERE tenant_id=p_tenant;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_edge_image_quota(p_tenant uuid,p_object_hash text,p_content_hash text,p_bytes bigint,p_ttl_ms integer DEFAULT 300000)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE account public.edge_image_quota_accounts%ROWTYPE; existing public.edge_image_quota_objects%ROWTYPE; used bigint;
BEGIN
 IF p_content_hash IS NULL OR p_content_hash !~ '^[a-f0-9]{64}$' OR p_bytes IS NULL OR p_bytes<1 OR p_ttl_ms IS NULL OR p_ttl_ms NOT BETWEEN 1000 AND 3600000 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 SELECT * INTO account FROM public.edge_image_quota_accounts WHERE tenant_id=p_tenant FOR UPDATE;
 IF account.seeded_at IS NULL THEN RAISE EXCEPTION 'Asset inventory not seeded'; END IF;
 SELECT * INTO existing FROM public.edge_image_quota_objects WHERE tenant_id=p_tenant AND object_hash=p_object_hash;
 IF FOUND THEN
  IF existing.bytes<>p_bytes THEN RAISE EXCEPTION 'Idempotency size mismatch'; END IF;
  -- Existing pending attempt is ambiguous: do not upload a second time.
  RETURN CASE WHEN existing.state='committed' AND existing.content_hash=p_content_hash THEN 'committed' ELSE 'reconcile_required' END;
 END IF;
 SELECT COALESCE(sum(bytes),0) INTO used FROM public.edge_image_quota_objects WHERE tenant_id=p_tenant;
 IF used+p_bytes>account.quota_bytes THEN RETURN 'quota_exceeded'; END IF;
 INSERT INTO public.edge_image_quota_objects(tenant_id,object_hash,content_hash,bytes,state,expires_at)
 VALUES(p_tenant,p_object_hash,p_content_hash,p_bytes,'reserved',clock_timestamp()+p_ttl_ms*interval '1 millisecond');
 RETURN 'reserved';
END $$;

-- Commit requires storage upload success/HEAD identity+size confirmation. If upload
-- outcome is uncertain keep reservation charged and reconcile. No expiry release.
CREATE OR REPLACE FUNCTION public.commit_edge_image_quota(p_tenant uuid,p_object_hash text,p_verified_bytes bigint,p_verified_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE existing public.edge_image_quota_objects%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.edge_image_quota_accounts WHERE tenant_id=p_tenant AND seeded_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Asset inventory not seeded'; END IF;
 SELECT * INTO existing FROM public.edge_image_quota_objects WHERE tenant_id=p_tenant AND object_hash=p_object_hash;
 IF NOT FOUND OR p_verified_bytes IS NULL OR p_verified_hash IS NULL OR existing.bytes<>p_verified_bytes OR existing.content_hash IS DISTINCT FROM p_verified_hash THEN RAISE EXCEPTION 'Storage identity/size confirmation required'; END IF;
 UPDATE public.edge_image_quota_objects SET state='committed',expires_at=NULL,updated_at=clock_timestamp() WHERE tenant_id=p_tenant AND object_hash=p_object_hash;
 RETURN true;
END $$;

-- Trusted backend has independently verified the Storage object absent (404, NOT
-- timeout/403). Only pending reservations can release; committed deletes reconcile.
CREATE OR REPLACE FUNCTION public.release_edge_image_quota(p_tenant uuid,p_object_hash text,p_absence_verified boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE removed integer;
BEGIN
 IF p_absence_verified IS DISTINCT FROM true THEN RAISE EXCEPTION 'Absence verification required'; END IF;
 PERFORM 1 FROM public.edge_image_quota_accounts WHERE tenant_id=p_tenant AND seeded_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Asset inventory not seeded'; END IF;
 DELETE FROM public.edge_image_quota_objects WHERE tenant_id=p_tenant AND object_hash=p_object_hash AND state='reserved';
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed>0;
END $$;

-- Call only after exclusive ownership of the upload attempt is established: an
-- absence probe alone cannot race a still-running upload. Reconciliation records
-- actual persisted bytes, even above quota; future reservations then fail closed.
CREATE OR REPLACE FUNCTION public.reconcile_edge_image_quota(p_tenant uuid,p_object_hash text,p_verified boolean,p_actual_bytes bigint,p_actual_hash text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_verified IS DISTINCT FROM true OR (p_actual_bytes IS NOT NULL AND (p_actual_bytes<1 OR p_actual_hash IS NULL OR p_actual_hash !~ '^[a-f0-9]{64}$')) THEN RAISE EXCEPTION 'Definitive storage observation required'; END IF;
 PERFORM 1 FROM public.edge_image_quota_accounts WHERE tenant_id=p_tenant AND seeded_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Asset inventory not seeded'; END IF;
 IF p_actual_bytes IS NULL THEN
  DELETE FROM public.edge_image_quota_objects WHERE tenant_id=p_tenant AND object_hash=p_object_hash;
 ELSE
  INSERT INTO public.edge_image_quota_objects(tenant_id,object_hash,content_hash,bytes,state)
  VALUES(p_tenant,p_object_hash,p_actual_hash,p_actual_bytes,'committed') ON CONFLICT(tenant_id,object_hash)
  DO UPDATE SET bytes=EXCLUDED.bytes,content_hash=EXCLUDED.content_hash,state='committed',expires_at=NULL,updated_at=clock_timestamp();
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.seed_edge_image_quota(uuid,jsonb,text,bigint),public.reserve_edge_image_quota(uuid,text,text,bigint,integer),public.commit_edge_image_quota(uuid,text,bigint,text),public.release_edge_image_quota(uuid,text,boolean),public.reconcile_edge_image_quota(uuid,text,boolean,bigint,text) FROM PUBLIC,anon,authenticated;
COMMIT;
