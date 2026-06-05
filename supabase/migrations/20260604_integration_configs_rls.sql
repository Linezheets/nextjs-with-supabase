-- Enable RLS on integration_configs (stores OAuth access tokens — critical)
-- brand_id is TEXT; auth.uid() is UUID — cast required for comparison

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

-- Brands can manage their own integration credentials
CREATE POLICY "Brands manage own integrations"
  ON public.integration_configs FOR ALL
  TO authenticated
  USING  (brand_id = auth.uid()::text OR is_platform_admin())
  WITH CHECK (brand_id = auth.uid()::text OR is_platform_admin());
