-- Migration 0006: estensioni users per identità unificata sito<->app (cloud control-plane)
-- Vedi MASTER_PLAN-cloud-auth §3.2. NON crea tabelle cloud_* nel DB locale.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cloud_owner_id" uuid;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "local_owner_secret_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "credentials_version" integer NOT NULL DEFAULT 0;
