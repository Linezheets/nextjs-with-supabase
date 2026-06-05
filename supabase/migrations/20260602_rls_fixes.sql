-- ============================================================
-- LINEZHEETS — RLS fixes (CIS 6 — Access Control Management)
-- Run in Supabase SQL Editor
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  A. Tables with RLS DISABLED — enable + add policies        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- event_sync_log — internal system log, admin-read only
ALTER TABLE event_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read event_sync_log"
  ON event_sync_log FOR SELECT TO authenticated
  USING (is_platform_admin());

-- products — catalogue: brands own rows, all authenticated can read
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read products"
  ON products FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Brand users manage own products"
  ON products FOR ALL TO authenticated
  USING (brand_id = auth.uid() OR is_platform_admin())
  WITH CHECK (brand_id = auth.uid() OR is_platform_admin());

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  B. Tables with RLS ON but zero policies                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- brand_payment_terms — no user_id column; keyed by brand_name
-- Brands can read their own (match via brand_storefronts), everyone reads
CREATE POLICY "Authenticated read brand_payment_terms"
  ON brand_payment_terms FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins manage brand_payment_terms"
  ON brand_payment_terms FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- brands — public read within platform, brands own their row
CREATE POLICY "Authenticated read brands"
  ON brands FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Brand users manage own brand"
  ON brands FOR ALL TO authenticated
  USING (
    (SELECT id FROM brand_storefronts WHERE user_id = auth.uid() LIMIT 1) IS NOT NULL
    OR is_platform_admin()
  )
  WITH CHECK (is_platform_admin());

-- buyer_orders — buyers own, admins all
CREATE POLICY "Buyers manage own orders"
  ON buyer_orders FOR ALL TO authenticated
  USING (buyer_id = auth.uid() OR is_platform_admin())
  WITH CHECK (buyer_id = auth.uid() OR is_platform_admin());

-- exchange_rates — read-only for authenticated; service-role writes
CREATE POLICY "Authenticated read exchange_rates"
  ON exchange_rates FOR SELECT TO authenticated
  USING (true);

-- messages — sender/receiver scope (column is receiver_id not recipient_id)
CREATE POLICY "Users read own messages"
  ON messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Users send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- orders (legacy) — buyer/brand scoped
CREATE POLICY "Users read own legacy orders"
  ON orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR brand_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Buyers insert orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Brands and admins update orders"
  ON orders FOR UPDATE TO authenticated
  USING (brand_id = auth.uid() OR is_platform_admin());

-- profiles — users own their profile row (id = auth.uid())
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL TO authenticated
  USING (id = auth.uid() OR is_platform_admin())
  WITH CHECK (id = auth.uid() OR is_platform_admin());

-- transactions — financial records: read own, no direct write from app
-- buyer_orders.id is TEXT; transactions.order_id is UUID — cast needed
CREATE POLICY "Users read own transactions"
  ON transactions FOR SELECT TO authenticated
  USING (
    (SELECT buyer_id FROM buyer_orders WHERE id = transactions.order_id::text LIMIT 1) = auth.uid()
    OR is_platform_admin()
  );

-- wholesale_access — VIP grants: admin writes, buyer reads own
CREATE POLICY "Admins manage wholesale_access"
  ON wholesale_access FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Buyers read own wholesale_access"
  ON wholesale_access FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- ── Confirm ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  unprotected INT;
  total_tables INT;
BEGIN
  SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO unprotected FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;

  RAISE NOTICE 'RLS fixes: % total tables, % unprotected', total_tables, unprotected;
END;
$$;
