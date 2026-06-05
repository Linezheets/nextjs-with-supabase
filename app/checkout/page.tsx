import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import CheckoutClient from './CheckoutClient';

export const metadata = { title: 'Checkout — Linezheets' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { order_id } = await searchParams;
  if (!order_id) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: order } = await admin
    .from('buyer_orders')
    .select('*')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .single() as {
      data: {
        id       : string;
        total_usd: number;
        currency : string;
        items    : { name: string | null; size: string; quantity: number; wholesale_price: number | null; brand_name: string | null }[];
        notes    : string | null;
      } | null;
    };

  if (!order) redirect('/dashboard');

  const brandName: string | null =
    Array.isArray(order.items) && order.items[0]?.brand_name
      ? order.items[0].brand_name
      : null;

  const { data: terms } = brandName
    ? await admin.from('brand_payment_terms').select('*').eq('brand_name', brandName).maybeSingle() as {
        data: {
          payment_methods  : string[];
          flow             : 'immediate' | 'pay_later' | 'installments';
          deadline_days    : number | null;
          installment_count: number;
          installment_days : number;
        } | null;
      }
    : { data: null };

  const paymentTerms = terms ?? {
    payment_methods  : ['card'] as string[],
    flow             : 'immediate' as const,
    deadline_days    : null,
    installment_count: 2,
    installment_days : 30,
  };

  return (
    <CheckoutClient
      order={order}
      paymentTerms={paymentTerms}
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
    />
  );
}
