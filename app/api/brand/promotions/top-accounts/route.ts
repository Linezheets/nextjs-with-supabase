import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { scoreAccounts } from '@/lib/top-accounts';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: storefront } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .single();

  if (!storefront) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const admin = await createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;

  const { data: buyers, error: buyerErr } = await adminDb
    .from('buyers')
    .select('id, email, store_name, city, country, status')
    .eq('status', 'active');

  if (buyerErr) return NextResponse.json({ error: buyerErr.message }, { status: 500 });

  const { data: analyses } = await adminDb
    .from('buyer_analysis')
    .select('buyer_id, brand_affinities, total_spend, total_orders, avg_order_value');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: campaigns } = await db
    .from('brand_recommendation_campaigns')
    .select('id')
    .eq('brand_user_id', user.id);

  const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);

  let sends: { buyer_id: string; match_score: number }[] = [];
  if (campaignIds.length > 0) {
    const { data: sendRows } = await adminDb
      .from('brand_recommendation_sends')
      .select('buyer_id, match_score')
      .in('campaign_id', campaignIds);
    sends = sendRows ?? [];
  }

  const scored = scoreAccounts(
    buyers ?? [],
    analyses ?? [],
    sends,
    storefront.brand_name,
  );

  return NextResponse.json(scored);
}
