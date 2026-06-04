import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandOrdersClient from './BrandOrdersClient';

export const metadata = { title: 'Brand Orders — Linezheets' };

type RawOrder = {
  id              : string;
  buyer_id        : string | null;
  buyer_name      : string | null;
  status          : string;
  total_usd       : number;
  terms           : string | null;
  notes           : string | null;
  items           : Record<string, unknown>[];
  created_at      : string;
  fulfillment_type: string | null;
};

export default async function BrandOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: storefront } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const brandName = (storefront as unknown as { brand_name: string } | null)?.brand_name ?? null;

  if (!brandName) {
    return (
      <BrandOrdersClient initialOrders={[]} brandName="" />
    );
  }

  const { data } = await supabase
    .from('buyer_orders')
    .select('id, buyer_id, buyer_name, status, total_usd, terms, notes, items, created_at, fulfillment_type')
    .filter('items', 'cs', JSON.stringify([{ brand_name: brandName }]))
    .order('created_at', { ascending: false });

  const rows = ((data ?? []) as unknown as RawOrder[]);
  const ids  = rows.map(r => r.id);

  // payment_status added via migration — not in generated types, fetch separately
  let paymentMap: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: payRows } = await supabase
      .from('buyer_orders')
      .select('id, payment_status')
      .in('id', ids) as unknown as { data: { id: string; payment_status: string | null }[] | null };
    for (const r of payRows ?? []) paymentMap[r.id] = r.payment_status;
  }

  const initialOrders = rows.map(order => {
    const brandItems = order.items.filter(i => i.brand_name === brandName);
    const brandTotal = brandItems.reduce((sum, i) =>
      sum + Number(i.wholesale_price ?? i.wsp_usd ?? 0) * Number(i.qty ?? i.total_qty ?? 1), 0);
    return {
      ...order,
      payment_status: paymentMap[order.id] ?? null,
      brand_items   : brandItems,
      brand_total   : brandTotal,
    };
  });

  return <BrandOrdersClient initialOrders={initialOrders} brandName={brandName} />;
}
