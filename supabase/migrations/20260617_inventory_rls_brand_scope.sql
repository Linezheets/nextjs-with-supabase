-- P0 #2: Brand-scope inventory writes.
--
-- The original policy `inventory_write_authenticated` was:
--     FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated')
-- which let ANY logged-in user INSERT/UPDATE/DELETE ANY brand's inventory rows.
--
-- Ownership model: inventory.brand_name matches brand_storefronts.brand_name,
-- and brand_storefronts.user_id is the owning auth.users id (UNIQUE per user).
-- We scope writes to rows whose brand_name belongs to the caller's storefront,
-- mirroring the application-layer filter in app/api/products/[id]/route.ts.
--
-- NOTE: today the app writes inventory via the service-role client (which bypasses
-- RLS), so this is defense-in-depth — it does not change current app behavior, but
-- it closes the hole for any user-scoped/anon-key access path.

-- Public read stays (marketplace / storefront browse).
DROP POLICY IF EXISTS "inventory_select_all" ON public.inventory;
CREATE POLICY "inventory_select_all"
  ON public.inventory FOR SELECT USING (true);

-- Remove the wide-open write policy.
DROP POLICY IF EXISTS "inventory_write_authenticated" ON public.inventory;

-- Brand-scoped writes. Platform admins retain full access via is_platform_admin().
DROP POLICY IF EXISTS "inventory_owner_insert" ON public.inventory;
CREATE POLICY "inventory_owner_insert"
  ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (
    brand_name IN (SELECT brand_name FROM public.brand_storefronts WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "inventory_owner_update" ON public.inventory;
CREATE POLICY "inventory_owner_update"
  ON public.inventory FOR UPDATE TO authenticated
  USING (
    brand_name IN (SELECT brand_name FROM public.brand_storefronts WHERE user_id = auth.uid())
    OR is_platform_admin()
  )
  WITH CHECK (
    brand_name IN (SELECT brand_name FROM public.brand_storefronts WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "inventory_owner_delete" ON public.inventory;
CREATE POLICY "inventory_owner_delete"
  ON public.inventory FOR DELETE TO authenticated
  USING (
    brand_name IN (SELECT brand_name FROM public.brand_storefronts WHERE user_id = auth.uid())
    OR is_platform_admin()
  );
