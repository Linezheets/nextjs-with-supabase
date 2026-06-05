-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — showroom events, RSVPs, interests, product views, integrations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. showroom_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.showroom_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  type             text        NOT NULL,                    -- 'showroom' | 'tradeshow' | 'popup' | 'presentation'
  description      text,
  city             text        NOT NULL,
  country          text,
  venue_name       text,
  address          text,
  lat              numeric(9,6),
  lng              numeric(9,6),
  date_start       date        NOT NULL,
  date_end         date,
  time_start       text,                                    -- 'HH:MM'
  time_end         text,
  timezone         text        NOT NULL DEFAULT 'UTC',
  cover_image_url  text,
  website_url      text,
  capacity         int,
  is_public        boolean     NOT NULL DEFAULT true,
  status           text        NOT NULL DEFAULT 'pending'   -- pending | approved | live | past | cancelled
                   CHECK (status IN ('pending','approved','live','past','cancelled')),
  featured         boolean     NOT NULL DEFAULT false,
  host_name        text,
  host_contact     text,
  event_tag        text,
  season           text,
  brand_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showroom_events_date_idx    ON public.showroom_events (date_start);
CREATE INDEX IF NOT EXISTS showroom_events_status_idx  ON public.showroom_events (status);
CREATE INDEX IF NOT EXISTS showroom_events_city_idx    ON public.showroom_events (lower(city));
CREATE INDEX IF NOT EXISTS showroom_events_created_idx ON public.showroom_events (created_by);

-- Auto-bump updated_at
CREATE OR REPLACE FUNCTION touch_showroom_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER showroom_event_updated
  BEFORE UPDATE ON public.showroom_events
  FOR EACH ROW EXECUTE FUNCTION touch_showroom_event();

-- RLS
ALTER TABLE public.showroom_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved/live/past events
CREATE POLICY "events_public_read" ON public.showroom_events
  FOR SELECT USING (status IN ('approved','live','past'));

-- Owners see all their own events regardless of status
CREATE POLICY "events_owner_read" ON public.showroom_events
  FOR SELECT USING (created_by = auth.uid());

-- Authenticated users can create events
CREATE POLICY "events_insert" ON public.showroom_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update/delete their own events
CREATE POLICY "events_owner_update" ON public.showroom_events
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "events_owner_delete" ON public.showroom_events
  FOR DELETE USING (created_by = auth.uid());


-- ── 2. event_rsvps ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.showroom_events(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text        NOT NULL,
  user_name     text        NOT NULL DEFAULT '',
  user_type     text        NOT NULL DEFAULT 'buyer',       -- buyer | press | brand | other
  company_name  text,
  notes         text,
  host_notes    text,
  status        text        NOT NULL DEFAULT 'pending'      -- pending | approved | waitlisted | declined | checked_in | cancelled
                CHECK (status IN ('pending','approved','waitlisted','declined','checked_in','cancelled')),
  qr_token      uuid        UNIQUE,
  checked_in_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_email)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_idx  ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_idx   ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS event_rsvps_token_idx  ON public.event_rsvps (qr_token) WHERE qr_token IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_event_rsvp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER event_rsvp_updated
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION touch_event_rsvp();

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Users see their own RSVPs
CREATE POLICY "rsvps_own_read" ON public.event_rsvps
  FOR SELECT USING (user_id = auth.uid());

-- Event owners see all RSVPs for their events
CREATE POLICY "rsvps_event_owner_read" ON public.event_rsvps
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM public.showroom_events WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "rsvps_insert" ON public.event_rsvps
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "rsvps_own_update" ON public.event_rsvps
  FOR UPDATE USING (user_id = auth.uid());

-- Event owners can update any RSVP (approve / check-in / decline)
CREATE POLICY "rsvps_event_owner_update" ON public.event_rsvps
  FOR UPDATE USING (
    event_id IN (
      SELECT id FROM public.showroom_events WHERE created_by = auth.uid()
    )
  );


-- ── 3. event_interests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_interests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES public.showroom_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_interests_event_idx ON public.event_interests (event_id);
CREATE INDEX IF NOT EXISTS event_interests_user_idx  ON public.event_interests (user_id);

ALTER TABLE public.event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interests_read"   ON public.event_interests FOR SELECT USING (true);
CREATE POLICY "interests_insert" ON public.event_interests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "interests_delete" ON public.event_interests FOR DELETE USING (user_id = auth.uid());


-- ── 4. product_views ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_views (
  id         bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id text        NOT NULL,
  brand_id   text,
  source     text        NOT NULL DEFAULT 'showroom',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_views_product_idx ON public.product_views (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_views_user_idx    ON public.product_views (user_id)    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_views_brand_idx   ON public.product_views (brand_id)   WHERE brand_id IS NOT NULL;

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert (fire-and-forget analytics)
CREATE POLICY "views_insert" ON public.product_views
  FOR INSERT WITH CHECK (true);

-- Users can see their own view history; admins query via service role
CREATE POLICY "views_own_read" ON public.product_views
  FOR SELECT USING (user_id = auth.uid());


-- ── 5. integrations catalog ──────────────────────────────────────────────────
-- Global, admin-managed list of available platform integrations.
-- Queried via supabaseAdmin in /api/integrations; not editable by end users.
CREATE TABLE IF NOT EXISTS public.integrations (
  id           text        PRIMARY KEY,                    -- e.g. 'shopify', 'stripe', 'salesforce'
  name         text        NOT NULL,
  description  text,
  logo_url     text,
  category     text        NOT NULL DEFAULT 'other',       -- payments | erp | ecommerce | crm | logistics | automation | scheduling
  docs_url     text,
  is_active    boolean     NOT NULL DEFAULT true,
  sort_order   int         NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Readable by all authenticated users; only service role can write
CREATE POLICY "integrations_read" ON public.integrations
  FOR SELECT USING (true);

-- Seed the catalog with known platforms
INSERT INTO public.integrations (id, name, description, category, sort_order) VALUES
  ('stripe',    'Stripe',    'Accept credit cards and manage payment flows for wholesale orders.',      'payments',   10),
  ('paypal',    'PayPal',    'Accept PayPal payments and manage transactions.',                         'payments',   20),
  ('shopify',   'Shopify',   'Sync products, inventory and orders with your Shopify storefront.',       'ecommerce',  30),
  ('netsuite',  'NetSuite',  'Sync orders, inventory and financials with NetSuite.',                    'erp',        40),
  ('a2000',     'A2000',     'Connect to A2000 for fashion-specific ERP data flows.',                   'erp',        50),
  ('apparel21', 'Apparel21', 'Industry-native ERP built for apparel and fashion brands.',               'erp',        60),
  ('sap',       'SAP',       'Enterprise resource planning via SAP S/4HANA or Business One.',           'erp',        70),
  ('quickbooks','QuickBooks','Push invoices, expenses and P&L data into QuickBooks Online.',            'erp',        80),
  ('salesforce','Salesforce','Sync buyer accounts, contacts and deal pipelines with Salesforce.',       'crm',        90),
  ('shippo',    'Shippo',    'Generate labels and track shipments via Shippo''s multi-carrier API.',    'logistics', 100),
  ('zapier',    'Zapier',    'Trigger Zaps from platform events to connect 5,000+ apps.',               'automation',110),
  ('calendly',  'Calendly',  'Let buyers book showroom appointments via Calendly.',                     'scheduling',120)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.integrations TO authenticated;
GRANT SELECT ON public.showroom_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.event_rsvps TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_interests TO authenticated;
GRANT INSERT ON public.product_views TO authenticated;
GRANT SELECT ON public.product_views TO authenticated;
