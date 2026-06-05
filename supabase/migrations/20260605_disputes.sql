-- #5: Dispute / Refund Request Flow
-- Wholesale refunds are uncommon and case-by-case — handled by admin review,
-- never automatic self-service. Returns and credit notes are the typical outcome.

CREATE TABLE IF NOT EXISTS dispute_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT        NOT NULL REFERENCES buyer_orders(id) ON DELETE CASCADE,
  raised_by       UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  raised_by_role  TEXT        NOT NULL CHECK (raised_by_role IN ('buyer','brand')),

  -- Type of request
  type            TEXT        NOT NULL DEFAULT 'dispute'
    CHECK (type IN ('dispute','refund_request','credit_note_request','return_request')),

  -- Buyer/brand description of the issue
  description     TEXT        NOT NULL,
  evidence_urls   TEXT[]      DEFAULT '{}',   -- uploaded image/doc URLs

  -- Admin lifecycle
  status          TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','resolved_refund','resolved_credit','resolved_no_action','closed')),
  resolution_notes TEXT,
  resolved_by     UUID        REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id    ON dispute_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by   ON dispute_requests(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status      ON dispute_requests(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_disputes_created_at  ON dispute_requests(created_at DESC);

-- RLS
ALTER TABLE dispute_requests ENABLE ROW LEVEL SECURITY;

-- Buyers can see their own disputes
CREATE POLICY "buyer see own disputes"
  ON dispute_requests FOR SELECT
  USING (raised_by = auth.uid() OR
    order_id IN (SELECT id FROM buyer_orders WHERE buyer_id = auth.uid()));

-- Brands can see disputes on their orders
CREATE POLICY "brand see own order disputes"
  ON dispute_requests FOR SELECT
  USING (
    order_id IN (
      SELECT bo.id FROM buyer_orders bo
      JOIN brand_storefronts sf ON sf.user_id = auth.uid()
      WHERE bo.items @> json_build_array(json_build_object('brand_name', sf.brand_name))::jsonb
    )
  );

-- Authenticated users can raise disputes on orders they own
CREATE POLICY "raise own dispute"
  ON dispute_requests FOR INSERT
  WITH CHECK (raised_by = auth.uid());

-- Service role bypasses RLS (admin operations)
