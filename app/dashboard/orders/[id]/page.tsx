import { redirect }       from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import OrderDetailClient  from './OrderDetailClient';

export const metadata = { title: 'Order Detail — Linezheets' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Fetch order — visible to buyer (own) or brand (matching brand_name)
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  let orderQuery = admin
    .from('buyer_orders')
    .select('*')
    .eq('id', id);

  if (sf) {
    orderQuery = orderQuery.filter('items', 'cs', JSON.stringify([{ brand_name: sf.brand_name }]));
  } else {
    orderQuery = orderQuery.eq('buyer_id', user.id);
  }

  const { data: order } = await orderQuery.maybeSingle();
  if (!order) redirect(sf ? '/dashboard/brand-store/orders' : '/dashboard/orders');

  // Fetch payment schedule
  const { data: payments } = await admin
    .from('buyer_payments')
    .select('id, installment_seq, amount_usd, status, due_date, method, stripe_payment_intent_id')
    .eq('order_id', id)
    .order('installment_seq', { ascending: true });

  return (
    <OrderDetailClient
      order={order as Record<string, unknown>}
      payments={(payments ?? []) as Record<string, unknown>[]}
      isBrand={!!sf}
      brandName={sf?.brand_name ?? null}
    />
  );
}
