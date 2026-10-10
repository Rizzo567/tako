CREATE TABLE IF NOT EXISTS menu_workspaces (
 restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 1, published_revision integer,
 draft jsonb NOT NULL, published jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS menu_workspace_versions (
 id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 revision integer NOT NULL, label text NOT NULL, snapshot jsonb NOT NULL,
 created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_workspace_versions_tenant ON menu_workspace_versions(restaurant_id,created_at);
CREATE TABLE IF NOT EXISTS menu_workspace_assets (
 id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 url text NOT NULL, name text NOT NULL, bytes integer NOT NULL DEFAULT 0,
 mime text NOT NULL DEFAULT 'image/jpeg', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(restaurant_id,url)
);
CREATE TABLE IF NOT EXISTS menu_workspace_events (
 id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 menu_id uuid NOT NULL, kind text NOT NULL, lang text NOT NULL DEFAULT '',
 visit_hash text NOT NULL, day date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(restaurant_id,menu_id,kind,lang,visit_hash,day)
);
CREATE INDEX IF NOT EXISTS menu_workspace_events_tenant ON menu_workspace_events(restaurant_id,day);
CREATE TABLE IF NOT EXISTS menu_workspace_presets (
 id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 name text NOT NULL, design jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_workspace_presets_tenant ON menu_workspace_presets(restaurant_id);
