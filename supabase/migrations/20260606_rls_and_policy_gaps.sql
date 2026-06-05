-- ============================================================
-- Fix RLS policy gaps — applied 2026-06-06
-- ============================================================

-- 1. linesheet_imports — add INSERT + UPDATE (SELECT already existed)
DROP POLICY IF EXISTS "brand read own imports"   ON linesheet_imports;
DROP POLICY IF EXISTS "brand insert own imports" ON linesheet_imports;
DROP POLICY IF EXISTS "brand update own imports" ON linesheet_imports;

CREATE POLICY "brand read own imports"
  ON linesheet_imports FOR SELECT TO authenticated
  USING (brand_user_id = auth.uid());

CREATE POLICY "brand insert own imports"
  ON linesheet_imports FOR INSERT TO authenticated
  WITH CHECK (brand_user_id = auth.uid());

CREATE POLICY "brand update own imports"
  ON linesheet_imports FOR UPDATE TO authenticated
  USING (brand_user_id = auth.uid());

-- 2. dispute_requests — add INSERT + admin UPDATE
DROP POLICY IF EXISTS "buyer or brand insert dispute" ON dispute_requests;
DROP POLICY IF EXISTS "admin update disputes"         ON dispute_requests;

CREATE POLICY "buyer or brand insert dispute"
  ON dispute_requests FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());

CREATE POLICY "admin update disputes"
  ON dispute_requests FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- 3. buyer_payments — RLS + read policy scoped via buyer_orders join
--    (no buyer_id col; ownership determined through buyer_orders)
ALTER TABLE IF EXISTS buyer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer read own payments" ON buyer_payments;

CREATE POLICY "buyer read own payments"
  ON buyer_payments FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM buyer_orders
      WHERE buyer_id = auth.uid() OR brand_id = auth.uid()
    )
    OR is_platform_admin()
  );

-- 4. brand_subscriptions — RLS + brand owner read
--    (col is brand_user_id, not user_id)
ALTER TABLE IF EXISTS brand_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand read own subscription" ON brand_subscriptions;

CREATE POLICY "brand read own subscription"
  ON brand_subscriptions FOR SELECT TO authenticated
  USING (brand_user_id = auth.uid() OR is_platform_admin());
