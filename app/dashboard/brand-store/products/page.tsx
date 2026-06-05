import { redirect }        from 'next/navigation';
import { createClient }    from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import ProductsClient      from './ProductsClient';

export const metadata = { title: 'Products — Linezheets' };

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name, subscription_tier, subscription_status, base_currency')
    .eq('user_id', user.id)
    .maybeSingle();

  const brandName = sf?.brand_name ?? '';

  const { data: products } = await admin
    .from('inventory')
    .select('*')
    .eq('brand_name', brandName)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return (
    <ProductsClient
      initialProducts={(products ?? []) as Record<string, unknown>[]}
      brandName={brandName}
      tier={sf?.subscription_tier ?? 'starter'}
      currency={sf?.base_currency ?? 'USD'}
    />
  );
}
