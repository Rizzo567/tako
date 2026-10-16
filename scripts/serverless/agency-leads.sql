-- Agency-only CRM. Execute as migration owner; no browser direct table access.
CREATE TABLE IF NOT EXISTS tako_agency_leads (
 id text PRIMARY KEY,
 source_id text NOT NULL UNIQUE,
 demo_token_hash text UNIQUE,
 source jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','demo_preparing','demo_ready','to_call','contacted','interested','trial','follow_up','customer','not_interested')),
 notes text NOT NULL DEFAULT '',
 assignee text NOT NULL DEFAULT '',
 next_contact_at timestamptz,
 restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tako_agency_leads ADD COLUMN IF NOT EXISTS demo_token_hash text UNIQUE;
CREATE TABLE IF NOT EXISTS tako_agency_lead_activities (
 id uuid PRIMARY KEY,
 lead_id text NOT NULL REFERENCES tako_agency_leads(id) ON DELETE CASCADE,
 type text NOT NULL CHECK(type IN ('call','message','note')),
 outcome text NOT NULL DEFAULT '',
 text text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tako_agency_lead_activities_lead ON tako_agency_lead_activities(lead_id,created_at DESC);
ALTER TABLE tako_agency_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_agency_lead_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_agency_leads,tako_agency_lead_activities FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON tako_agency_leads,tako_agency_lead_activities TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_agency_leads ON tako_agency_leads;
CREATE POLICY runtime_agency_leads ON tako_agency_leads TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_agency_lead_activities ON tako_agency_lead_activities;
CREATE POLICY runtime_agency_lead_activities ON tako_agency_lead_activities TO takomenu_runtime USING(true) WITH CHECK(true);
