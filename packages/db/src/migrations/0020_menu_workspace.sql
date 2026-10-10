CREATE TABLE public.menu_workspaces (
 restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 1, published_revision integer, draft jsonb NOT NULL, published jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE public.menu_workspace_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 revision integer NOT NULL, label text NOT NULL, snapshot jsonb NOT NULL, created_by uuid REFERENCES public.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE public.menu_workspace_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 url text NOT NULL, name text NOT NULL, bytes integer NOT NULL DEFAULT 0, mime text NOT NULL DEFAULT 'image/jpeg', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(restaurant_id,url)
);
--> statement-breakpoint
CREATE TABLE public.menu_workspace_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 menu_id uuid NOT NULL, kind text NOT NULL, lang text NOT NULL DEFAULT '', visit_hash text NOT NULL, day date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(restaurant_id,kind,visit_hash,menu_id,lang,day)
);
--> statement-breakpoint
REVOKE ALL ON public.menu_workspaces,public.menu_workspace_versions,public.menu_workspace_assets,public.menu_workspace_events FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.menu_workspaces,public.menu_workspace_versions,public.menu_workspace_assets,public.menu_workspace_events FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.menu_workspaces,public.menu_workspace_versions,public.menu_workspace_assets,public.menu_workspace_events FROM authenticated; END IF;
END $$;

--> statement-breakpoint
CREATE TABLE menu_workspace_presets (id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, name text NOT NULL, design jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
REVOKE ALL ON menu_workspace_presets FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON menu_workspace_presets FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON menu_workspace_presets FROM authenticated; END IF; END $$;
