-- ── Fashion Events Platform ───────────────────────────────────────────────────
-- Run in Supabase SQL Editor

-- showroom_events
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
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- event_rsvps
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

-- event_interests (lightweight follow/interest)
CREATE TABLE IF NOT EXISTS event_interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES showroom_events(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fingerprint TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_status   ON showroom_events(status);
CREATE INDEX IF NOT EXISTS idx_events_date     ON showroom_events(date_start);
CREATE INDEX IF NOT EXISTS idx_events_city     ON showroom_events(city);
CREATE INDEX IF NOT EXISTS idx_events_type     ON showroom_events(type);
CREATE INDEX IF NOT EXISTS idx_events_featured ON showroom_events(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_rsvps_event     ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user      ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_token     ON event_rsvps(qr_token);
CREATE INDEX IF NOT EXISTS idx_interests_event ON event_interests(event_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON showroom_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE showroom_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests  ENABLE ROW LEVEL SECURITY;

-- showroom_events policies
CREATE POLICY "Public can read approved/live events"
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

-- event_rsvps policies
CREATE POLICY "Event owners can read rsvps"
  ON event_rsvps FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT created_by FROM showroom_events WHERE id = event_id
    )
  );

CREATE POLICY "Users can create their own rsvp"
  ON event_rsvps FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Event owners can update rsvps"
  ON event_rsvps FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT created_by FROM showroom_events WHERE id = event_id
    )
  );

-- event_interests policies
CREATE POLICY "Anyone can read interest counts"
  ON event_interests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can toggle interest"
  ON event_interests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can remove their interest"
  ON event_interests FOR DELETE
  USING (auth.uid() = user_id);
