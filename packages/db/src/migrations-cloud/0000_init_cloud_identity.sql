-- Migration cloud 0000: schema control-plane identità (cloud_*)
-- Vedi MASTER_PLAN-cloud-auth §3.1. Applicare SOLO al Postgres cloud (Neon EU),
-- MAI al DB locale dell'appliance. Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "cloud_owners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "password_hash" text,
  "name" text,
  "email_verified" boolean NOT NULL DEFAULT false,
  "credentials_version" integer NOT NULL DEFAULT 0,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_owners_email_unique" UNIQUE ("email")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_owners_email_idx" ON "cloud_owners" ("email");

CREATE TABLE IF NOT EXISTS "cloud_oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_user_id" text NOT NULL,
  "email_at_provider" text,
  "email_verified_at_provider" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_oauth_provider_user_idx"
  ON "cloud_oauth_accounts" ("provider", "provider_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cloud_oauth_owner_provider_idx"
  ON "cloud_oauth_accounts" ("owner_id", "provider");

CREATE TABLE IF NOT EXISTS "cloud_email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_email_verification_tokens_token_hash_unique" UNIQUE ("token_hash")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_email_verification_token_hash_idx"
  ON "cloud_email_verification_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "cloud_email_verification_owner_idx"
  ON "cloud_email_verification_tokens" ("owner_id");

CREATE TABLE IF NOT EXISTS "cloud_password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_password_reset_tokens_token_hash_unique" UNIQUE ("token_hash")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_password_reset_token_hash_idx"
  ON "cloud_password_reset_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "cloud_password_reset_owner_idx"
  ON "cloud_password_reset_tokens" ("owner_id");

CREATE TABLE IF NOT EXISTS "cloud_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "user_agent" text,
  "ip" text,
  "credentials_version" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_sessions_token_hash_unique" UNIQUE ("token_hash")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_sessions_token_hash_idx"
  ON "cloud_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "cloud_sessions_owner_idx"
  ON "cloud_sessions" ("owner_id");

CREATE TABLE IF NOT EXISTS "cloud_restaurants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "plan" text NOT NULL DEFAULT 'free',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_restaurants_slug_unique" UNIQUE ("slug")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_restaurants_slug_idx"
  ON "cloud_restaurants" ("slug");
CREATE INDEX IF NOT EXISTS "cloud_restaurants_owner_idx"
  ON "cloud_restaurants" ("owner_id");

CREATE TABLE IF NOT EXISTS "cloud_appliances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "cloud_restaurants"("id") ON DELETE CASCADE,
  "pubkey" text NOT NULL,
  "public_label" text,
  "seen_credentials_version" integer NOT NULL DEFAULT 0,
  "paired_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "cloud_appliances_pubkey_unique" UNIQUE ("pubkey")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_appliances_pubkey_idx"
  ON "cloud_appliances" ("pubkey");
CREATE INDEX IF NOT EXISTS "cloud_appliances_restaurant_idx"
  ON "cloud_appliances" ("restaurant_id");

CREATE TABLE IF NOT EXISTS "cloud_pairing_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "cloud_owners"("id") ON DELETE CASCADE,
  "restaurant_id" uuid NOT NULL REFERENCES "cloud_restaurants"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "device_pubkey" text,
  "approved_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cloud_pairing_codes_code_hash_unique" UNIQUE ("code_hash")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_pairing_codes_code_hash_idx"
  ON "cloud_pairing_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "cloud_pairing_codes_owner_idx"
  ON "cloud_pairing_codes" ("owner_id");
CREATE INDEX IF NOT EXISTS "cloud_pairing_codes_restaurant_idx"
  ON "cloud_pairing_codes" ("restaurant_id");

CREATE TABLE IF NOT EXISTS "cloud_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid REFERENCES "cloud_owners"("id") ON DELETE SET NULL,
  "event" text NOT NULL,
  "ip" text,
  "user_agent" text,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cloud_audit_log_owner_idx"
  ON "cloud_audit_log" ("owner_id");
CREATE INDEX IF NOT EXISTS "cloud_audit_log_event_created_idx"
  ON "cloud_audit_log" ("event", "created_at");
