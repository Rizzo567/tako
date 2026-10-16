-- PREPARED ONLY. Apply first to an isolated database; no remote migration run.
-- The Fastify adapter must use a dedicated restricted backend DB role.
BEGIN;
CREATE TABLE IF NOT EXISTS public.edge_rate_counters (
  namespace text NOT NULL CHECK (length(namespace) BETWEEN 1 AND 200),
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  hits bigint NOT NULL CHECK (hits > 0),
  PRIMARY KEY(namespace, key_hash)
);
ALTER TABLE public.edge_rate_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_rate_counters FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS edge_rate_counters_expiry ON public.edge_rate_counters(expires_at);
CREATE OR REPLACE FUNCTION public.consume_edge_rate_counter(p_namespace text, p_key_hash text, p_window_ms integer)
RETURNS TABLE(current bigint, ttl bigint, iteration_start_ms bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE stamp timestamptz; row_value public.edge_rate_counters%ROWTYPE;
BEGIN
  IF p_window_ms IS NULL OR p_window_ms NOT BETWEEN 1 AND 86400000 THEN RAISE EXCEPTION 'Invalid counter window'; END IF;
  -- Read clock after acquiring the lock: waiting callers cannot use a stale window timestamp.
  PERFORM pg_advisory_xact_lock(hashtextextended('tako-rate-v1:' || p_namespace || ':' || p_key_hash,0));
  stamp := clock_timestamp();
  INSERT INTO public.edge_rate_counters AS existing(namespace,key_hash,started_at,expires_at,hits)
  VALUES(p_namespace,p_key_hash,stamp,stamp+p_window_ms*interval '1 millisecond',1)
  ON CONFLICT(namespace,key_hash) DO UPDATE SET
    hits=CASE WHEN existing.expires_at<=stamp THEN 1 ELSE existing.hits+1 END,
    started_at=CASE WHEN existing.expires_at<=stamp THEN stamp ELSE existing.started_at END,
    expires_at=CASE WHEN existing.expires_at<=stamp THEN stamp+p_window_ms*interval '1 millisecond' ELSE existing.expires_at END
  RETURNING * INTO row_value;
  RETURN QUERY SELECT row_value.hits,
    greatest(0,ceil(extract(epoch FROM row_value.expires_at-stamp)*1000)::bigint),
    floor(extract(epoch FROM row_value.started_at)*1000)::bigint;
END $$;
REVOKE ALL ON FUNCTION public.consume_edge_rate_counter(text,text,integer) FROM PUBLIC, anon, authenticated;
-- Grant EXECUTE and table access solely to a dedicated backend role after review.
-- Retention job: delete rows where expires_at < now() - interval '1 day'.
COMMIT;
