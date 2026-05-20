import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: promotionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: promo } = await db
    .from('brand_promotions')
    .select('id')
    .eq('id', promotionId)
    .eq('brand_user_id', user.id)
    .single();

  if (!promo) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });

  const admin = await createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;

  const { data: assignments, error } = await adminDb
    .from('brand_promotion_assignments')
    .select('id, buyer_id, buyer_email, account_tier, account_score, status, email_sent, email_sent_at, assigned_at')
    .eq('promotion_id', promotionId)
    .order('account_score', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const buyerIds = (assignments ?? []).map((a: { buyer_id: string }) => a.buyer_id);
  const { data: buyers } = await adminDb
    .from('buyers')
    .select('id, store_name, city, country')
    .in('id', buyerIds);

  const buyerMap = Object.fromEntries(
    (buyers ?? []).map((b: { id: string; store_name: string; city: string | null; country: string }) => [b.id, b])
  );

  const enriched = (assignments ?? []).map((a: { buyer_id: string; [key: string]: unknown }) => ({
    ...a,
    store_name: (buyerMap[a.buyer_id] as { store_name: string } | undefined)?.store_name ?? a.buyer_id,
    city: (buyerMap[a.buyer_id] as { city: string | null } | undefined)?.city ?? null,
    country: (buyerMap[a.buyer_id] as { country: string } | undefined)?.country ?? '',
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: promotionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id, status } = await req.json();
  if (!assignment_id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const validStatuses = ['active', 'redeemed', 'expired', 'revoked'];
  if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const admin = await createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;

  if (status === 'revoked') {
    const { data: assignment } = await adminDb
      .from('brand_promotion_assignments')
      .select('pricing_rule_id')
      .eq('id', assignment_id)
      .eq('promotion_id', promotionId)
      .single();

    if (assignment?.pricing_rule_id) {
      await adminDb
        .from('buyer_pricing_rules')
        .update({ active: false })
        .eq('id', assignment.pricing_rule_id);
    }
  }

  const { data, error } = await adminDb
    .from('brand_promotion_assignments')
    .update({ status })
    .eq('id', assignment_id)
    .eq('promotion_id', promotionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
