CREATE TABLE IF NOT EXISTS public.web_password_resets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.web_mail_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
 kind text NOT NULL, dedupe_key text NOT NULL UNIQUE, recipient text NOT NULL, subject text NOT NULL, html text NOT NULL,
 scheduled_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 claimed_at timestamptz, sent_at timestamptz, provider_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS reminder_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS reminder_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
REVOKE ALL ON public.web_password_resets, public.web_mail_outbox FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.web_password_resets, public.web_mail_outbox FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.web_password_resets, public.web_mail_outbox FROM authenticated; END IF;
END $$;
