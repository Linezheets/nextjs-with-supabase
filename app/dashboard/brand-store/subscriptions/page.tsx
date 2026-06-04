import { redirect }       from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import SubscriptionsClient from './SubscriptionsClient';

export const metadata = { title: 'Subscription — Linezheets' };

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('subscription_tier, subscription_status, stripe_subscription_id, stripe_account_status')
    .eq('user_id', user.id)
    .maybeSingle();

  let subDetail = null;
  if (sf?.stripe_subscription_id) {
    const { data } = await admin
      .from('brand_subscriptions')
      .select('tier, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end')
      .eq('stripe_subscription_id', sf.stripe_subscription_id)
      .maybeSingle();
    subDetail = data;
  }

  return (
    <SubscriptionsClient
      currentTier={sf?.subscription_tier ?? 'starter'}
      currentStatus={sf?.subscription_status ?? 'trialing'}
      subscription={subDetail}
    />
  );
}
