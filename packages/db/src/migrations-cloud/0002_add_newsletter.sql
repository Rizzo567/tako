-- Migration cloud 0002: opt-in newsletter sull'owner (decisione 2026-07-10).
-- L'iscrizione alla Resend Audience parte SOLO alla verifica email (cloud/newsletter.ts).
ALTER TABLE "cloud_owners" ADD COLUMN IF NOT EXISTS "newsletter_opt_in" boolean NOT NULL DEFAULT false;
