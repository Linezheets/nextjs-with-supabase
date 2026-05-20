-- ─────────────────────────────────────────────────────────────────────────────
-- 009 · Buyer inquiries & messaging
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Inquiry threads (one per buyer ↔ brand conversation)
CREATE TABLE IF NOT EXISTS public.inquiries (
  id          BIGSERIAL    PRIMARY KEY,
  buyer_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name  TEXT         NOT NULL,
  subject     TEXT         NOT NULL,
  status      TEXT         NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'replied', 'closed')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Messages within a thread
CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id          BIGSERIAL    PRIMARY KEY,
  inquiry_id  BIGINT       NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES auth.users(id),
  body        TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on inquiries when a message is inserted
CREATE OR REPLACE FUNCTION public.touch_inquiry_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inquiries
  SET updated_at = NOW(),
      status     = CASE WHEN status = 'closed' THEN 'closed' ELSE 'open' END
  WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_inquiry ON public.inquiry_messages;
CREATE TRIGGER trg_touch_inquiry
  AFTER INSERT ON public.inquiry_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_inquiry_on_message();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inquiries_buyer      ON public.inquiries (buyer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_brand      ON public.inquiries (brand_name);
CREATE INDEX IF NOT EXISTS idx_inquiries_updated    ON public.inquiries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inq_messages_inquiry ON public.inquiry_messages (inquiry_id);

-- RLS
ALTER TABLE public.inquiries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

-- Buyers can only see their own inquiries
DROP POLICY IF EXISTS "inquiries_buyer_select" ON public.inquiries;
CREATE POLICY "inquiries_buyer_select"
  ON public.inquiries FOR SELECT
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_buyer_insert" ON public.inquiries;
CREATE POLICY "inquiries_buyer_insert"
  ON public.inquiries FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "inquiries_buyer_update" ON public.inquiries;
CREATE POLICY "inquiries_buyer_update"
  ON public.inquiries FOR UPDATE
  USING (buyer_id = auth.uid());

-- Messages: readable if user is the buyer of the parent inquiry
DROP POLICY IF EXISTS "inq_messages_select" ON public.inquiry_messages;
CREATE POLICY "inq_messages_select"
  ON public.inquiry_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id AND i.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "inq_messages_insert" ON public.inquiry_messages;
CREATE POLICY "inq_messages_insert"
  ON public.inquiry_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
