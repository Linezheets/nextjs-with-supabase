import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { buildPromotionEmail } from '@/lib/recommendations';
import { getTier } from '@/lib/top-accounts';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: promotionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { buyer_ids, send_email = true } = body as { buyer_ids: string[]; send_email?: boolean };

  if (!Array.isArray(buyer_ids) || buyer_ids.length === 0) {
    return NextResponse.json({ error: 'buyer_ids must be a non-empty array' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: promo, error: promoErr } = await db
    .from('brand_promotions')
    .select('*')
    .eq('id', promotionId)
    .eq('brand_user_id', user.id)
    .single();

  if (promoErr || !promo) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });

  const admin = await createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;

  const { data: buyers } = await adminDb
    .from('buyers')
    .select('id, email, store_name, city, country')
    .in('id', buyer_ids);

  if (!buyers?.length) return NextResponse.json({ error: 'No valid buyers found' }, { status: 400 });

  const { data: analyses } = await adminDb
    .from('buyer_analysis')
    .select('buyer_id, total_spend, total_orders, avg_order_value')
    .in('buyer_id', buyer_ids);

  const analysisMap = Object.fromEntries(
    (analyses ?? []).map((a: { buyer_id: string; total_spend: number | null; total_orders: number | null }) => [a.buyer_id, a])
  );

  let products: { id: number; title: string; brand_name: string; srp: number; image_url: string | null }[] = [];
  if (promo.product_ids?.length) {
    const { data: inv } = await adminDb
      .from('inventory')
      .select('id, name, image_url, wsp_usd')
      .in('id', promo.product_ids)
      .limit(6);
    products = (inv ?? []).map((item: { id: number; name: string; image_url: string | null; wsp_usd: number }) => ({
      id: item.id,
      title: item.name,
      brand_name: promo.brand_name,
      srp: item.wsp_usd,
      image_url: item.image_url,
    }));
  }

  const results: { buyer_id: string; email: string; success: boolean; error?: string }[] = [];

  for (const buyer of buyers) {
    try {
      const analysis = analysisMap[buyer.id as string] as { total_spend: number | null; total_orders: number | null } | undefined;
      const totalSpend = Number(analysis?.total_spend ?? 0);
      const totalOrders = Number(analysis?.total_orders ?? 0);
      const estimatedScore = Math.min(100, Math.round((totalSpend / 5000) * 25 + (totalOrders / 20) * 15));
      const tier = getTier(estimatedScore);

      let ruleType = 'global';
      let ruleTarget: string | null = null;
      if (promo.promo_type === 'category_deal' && promo.target_category) {
        ruleType = 'category';
        ruleTarget = promo.target_category;
      }

      const { data: pricingRule } = await adminDb
        .from('buyer_pricing_rules')
        .insert({ buyer_id: buyer.id, rule_type: ruleType, target: ruleTarget, discount_pct: promo.discount_pct, active: true })
        .select('id')
        .single();

      const { error: assignErr } = await adminDb
        .from('brand_promotion_assignments')
        .upsert({
          promotion_id: promotionId,
          brand_user_id: user.id,
          buyer_id: buyer.id,
          buyer_email: buyer.email,
          account_tier: tier,
          account_score: estimatedScore,
          pricing_rule_id: pricingRule?.id ?? null,
          status: 'active',
          email_sent: false,
        }, { onConflict: 'promotion_id,buyer_id' });

      if (assignErr) throw new Error(assignErr.message);

      if (send_email) {
        const html = buildPromotionEmail({
          brandName: promo.brand_name,
          storeName: buyer.store_name,
          tier,
          headline: promo.headline,
          description: promo.description ?? '',
          promoType: promo.promo_type,
          discountPct: promo.discount_pct,
          expiresAt: promo.expires_at ?? null,
          products,
          marketplaceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://linezheets.com'}/marketplace`,
        });

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Linezheets <alerts@mxlla.com>',
            to: buyer.email,
            subject: `${promo.headline} — Exclusive Offer from ${promo.brand_name}`,
            html,
          }),
        });

        if (emailRes.ok) {
          await adminDb
            .from('brand_promotion_assignments')
            .update({ email_sent: true, email_sent_at: new Date().toISOString() })
            .eq('promotion_id', promotionId)
            .eq('buyer_id', buyer.id);
        }
      }

      results.push({ buyer_id: buyer.id, email: buyer.email, success: true });
    } catch (e: unknown) {
      results.push({ buyer_id: buyer.id, email: buyer.email, success: false, error: (e as Error).message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  await db
    .from('brand_promotions')
    .update({ total_assigned: (promo.total_assigned ?? 0) + successCount })
    .eq('id', promotionId);

  return NextResponse.json({ assigned: successCount, results });
}
