import { redirect }       from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import InventoryClient    from './InventoryClient';

export const metadata = { title: 'Inventory — Linezheets' };

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name, base_currency')
    .eq('user_id', user.id)
    .maybeSingle();

  const brandName = sf?.brand_name ?? '';

  const { data: inventory } = await admin
    .from('inventory')
    .select('id, title, sku, category, season, color, stock_total, moq, wsp_usd, srp, status, image_urls, updated_at')
    .eq('brand_name', brandName)
    .neq('status', 'archived')
    .order('stock_total', { ascending: true });

  const items = (inventory ?? []) as Record<string, unknown>[];

  const summary = {
    total_skus  : items.length,
    total_units : items.reduce((s, i) => s + Number(i.stock_total ?? 0), 0),
    low_stock   : items.filter(i => Number(i.stock_total ?? 0) < 5).length,
    out_of_stock: items.filter(i => Number(i.stock_total ?? 0) === 0).length,
  };

  return <InventoryClient initialItems={items} summary={summary} brandName={brandName} currency={sf?.base_currency ?? 'USD'} />;
}
