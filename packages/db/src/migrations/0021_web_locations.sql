CREATE TABLE web_location_memberships (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','menu_editor')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,restaurant_id)
);
--> statement-breakpoint
CREATE TABLE web_session_locations (
 session_token text PRIMARY KEY REFERENCES sessions(token) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
);
--> statement-breakpoint
REVOKE ALL ON web_location_memberships,web_session_locations FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON web_location_memberships,web_session_locations FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON web_location_memberships,web_session_locations FROM authenticated; END IF;
END $$;
