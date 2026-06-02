/**
 * Events + AI Sync migration.
 * Usage: SUPABASE_PAT=sbp_xxx node scripts/apply-events-migration.mjs
 * Get a PAT at: https://supabase.com/dashboard/account/tokens
 */

const PROJECT_REF = 'xvoemjakdsihgzfddtjx';
const PAT = process.env.SUPABASE_PAT;

const SQL = `
-- ── showroom_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS showroom_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN (
                   'fashion_week','tradeshow','showroom','runway',
                   'popup','networking','market_week'
                 )),
  description    TEXT,
  city           TEXT NOT NULL,
  country        TEXT,
  venue_name     TEXT,
  address        TEXT,
  lat            DECIMAL(9,6),
  lng            DECIMAL(9,6),
  date_start     DATE NOT NULL,
  date_end       DATE,
  time_start     TIME,
  time_end       TIME,
  timezone       TEXT DEFAULT 'UTC',
  cover_image_url TEXT,
  website_url    TEXT,
  capacity       INTEGER,
  is_public      BOOLEAN DEFAULT true,
  status         TEXT DEFAULT 'pending' CHECK (status IN (
                   'draft','pending','approved','live','past','cancelled'
                 )),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_id       TEXT,
  host_name      TEXT,
  host_contact   TEXT,
  event_tag      TEXT,
  season         TEXT,
  featured       BOOLEAN DEFAULT false,
  -- AI sync columns
  source_name    TEXT,
  source_url     TEXT,
  external_id    TEXT,
  ai_synced      BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── event_rsvps ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_rsvps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES showroom_events(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT NOT NULL,
  user_name    TEXT,
  user_type    TEXT DEFAULT 'buyer' CHECK (user_type IN (
                 'brand','buyer','press','host','general'
               )),
  company_name TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN (
                 'pending','approved','declined','waitlisted','checked_in'
               )),
  qr_token     TEXT UNIQUE,
  notes        TEXT,
  host_notes   TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_email)
);

-- ── event_interests ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES showroom_events(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fingerprint TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ── event_sync_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_sync_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name    TEXT NOT NULL,
  source_url     TEXT,
  run_at         TIMESTAMPTZ DEFAULT NOW(),
  events_found   INTEGER DEFAULT 0,
  events_added   INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  error_msg      TEXT,
  duration_ms    INTEGER
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_status      ON showroom_events(status);
CREATE INDEX IF NOT EXISTS idx_events_date        ON showroom_events(date_start);
CREATE INDEX IF NOT EXISTS idx_events_city        ON showroom_events(city);
CREATE INDEX IF NOT EXISTS idx_events_type        ON showroom_events(type);
CREATE INDEX IF NOT EXISTS idx_events_featured    ON showroom_events(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_events_ai_synced   ON showroom_events(ai_synced) WHERE ai_synced = true;
CREATE INDEX IF NOT EXISTS idx_sync_log_run_at    ON event_sync_log(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_event        ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_token        ON event_rsvps(qr_token);
CREATE INDEX IF NOT EXISTS idx_interests_event    ON event_interests(event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external_id
  ON showroom_events(external_id) WHERE external_id IS NOT NULL;

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON showroom_events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON showroom_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS rsvps_updated_at ON event_rsvps;
CREATE TRIGGER rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE showroom_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests  ENABLE ROW LEVEL SECURITY;

-- showroom_events policies
DROP POLICY IF EXISTS "Public can read approved events"  ON showroom_events;
DROP POLICY IF EXISTS "Owners can read all their events" ON showroom_events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON showroom_events;
DROP POLICY IF EXISTS "Owners can update their events"   ON showroom_events;

CREATE POLICY "Public can read approved events"
  ON showroom_events FOR SELECT
  USING (status IN ('approved','live','past'));

CREATE POLICY "Owners can read all their events"
  ON showroom_events FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can create events"
  ON showroom_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their events"
  ON showroom_events FOR UPDATE
  USING (auth.uid() = created_by);

-- event_interests policies
DROP POLICY IF EXISTS "Anyone can read interest counts" ON event_interests;
DROP POLICY IF EXISTS "Authenticated users can toggle interest" ON event_interests;
DROP POLICY IF EXISTS "Users can remove their interest" ON event_interests;

CREATE POLICY "Anyone can read interest counts"
  ON event_interests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can toggle interest"
  ON event_interests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can remove their interest"
  ON event_interests FOR DELETE USING (auth.uid() = user_id);

-- event_rsvps policies
DROP POLICY IF EXISTS "Event owners can read rsvps"   ON event_rsvps;
DROP POLICY IF EXISTS "Users can create their own rsvp" ON event_rsvps;
DROP POLICY IF EXISTS "Event owners can update rsvps"  ON event_rsvps;

CREATE POLICY "Event owners can read rsvps"
  ON event_rsvps FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM showroom_events WHERE id = event_id)
  );

CREATE POLICY "Users can create their own rsvp"
  ON event_rsvps FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Event owners can update rsvps"
  ON event_rsvps FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM showroom_events WHERE id = event_id)
  );
`;

if (!PAT) {
  console.log('\n⚠️  No SUPABASE_PAT set.\n');
  console.log('Run: SUPABASE_PAT=sbp_xxx node scripts/apply-events-migration.mjs');
  console.log('Get token: https://supabase.com/dashboard/account/tokens\n');
  process.exit(0);
}

console.log('Running events migration…');
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method : 'POST',
  headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body   : JSON.stringify({ query: SQL }),
});

const body = await res.text();
if (!res.ok) {
  console.error('❌  Migration failed:', res.status, body);
  process.exit(1);
}
console.log('✅  Events schema created successfully.');
