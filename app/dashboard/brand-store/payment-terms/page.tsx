import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import PaymentTermsClient from './PaymentTermsClient';

export const metadata = { title: 'Payment Terms — Linezheets Brand Portal' };

export default async function PaymentTermsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name, stripe_account_id, stripe_account_status')
    .eq('user_id', user?.id)
    .maybeSingle() as { data: { brand_name: string; stripe_account_id: string | null; stripe_account_status: string | null } | null };

  if (!sf?.brand_name) redirect('/dashboard/brand-store');

  const { data: terms } = await admin
    .from('brand_payment_terms')
    .select('*')
    .eq('brand_name', sf.brand_name)
    .maybeSingle() as {
      data: {
        payment_methods  : string[];
        flow             : string;
        deadline_days    : number | null;
        installment_count: number;
        installment_days : number;
      } | null;
    };

  return (
    <PaymentTermsClient
      brandName={sf.brand_name}
      stripeAccountStatus={sf.stripe_account_status}
      initialTerms={terms ?? {
        payment_methods  : ['card'],
        flow             : 'immediate',
        deadline_days    : 30,
        installment_count: 2,
        installment_days : 30,
      }}
    />
  );
}
