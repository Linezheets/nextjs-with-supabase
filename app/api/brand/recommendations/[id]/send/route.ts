import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { scoreBuyer, buildRecommendationEmail } from '@/lib/recommendations';
import { sendEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase      = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Load and validate campaign
  const { data: campaign, error: cErr } = await supabase
    .from('brand_recommendation_campaigns')
    .select('*')
    .eq('id', id)
    .eq('brand_user_id', user.id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 });

  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 500 });
  }

  // Optional: allow caller to pass explicit buyer_ids to override matching
  const body = await req.json().catch(() => ({}));
  const forceBuyerIds: string[] | undefined = body.buyer_ids?.length ? body.buyer_ids : undefined;

  // Fetch products for the campaign
  const { data: products } = await adminSupabase
    .from('inventory')
    .select('id, title, brand_name, srp, category, image_urls')
    .in('id', campaign.product_ids ?? []);

  const productList = (products ?? []).map(p => ({
    title     : p.title ?? '',
    brand_name: p.brand_name,
    srp       : Number(p.srp ?? 0),
    category  : p.category ?? '',
    image_url : Array.isArray(p.image_urls) ? (p.image_urls[0] ?? null) : null,
  }));

  const productCategories = [...new Set(productList.map(p => p.category).filter(Boolean))];

  // Resolve buyers to send to
  let targetBuyers: { id: string; email: string; store_name: string; city: string | null; country: string; categories_sold: string[]; market_segment: string | null; price_range_max: number | null; status: string }[] = [];

  if (forceBuyerIds) {
    const { data } = await adminSupabase
      .from('buyers')
      .select('id, email, store_name, city, country, categories_sold, market_segment, price_range_max, status')
      .in('id', forceBuyerIds)
      .eq('status', 'active');
    targetBuyers = data ?? [];
  } else {
    const { data } = await adminSupabase
      .from('buyers')
      .select('id, email, store_name, city, country, categories_sold, market_segment, price_range_max, status')
      .eq('status', 'active');

    const allBuyers = data ?? [];
    const buyerIds  = allBuyers.map((b: { id: string }) => b.id);

    const { data: analyses } = await adminSupabase
      .from('buyer_analysis')
      .select('buyer_id, category_weights, price_sensitivity, brand_affinities')
      .in('buyer_id', buyerIds);

    const analysisMap = Object.fromEntries(
      (analyses ?? []).map((a: { buyer_id: string }) => [a.buyer_id, a])
    );

    targetBuyers = allBuyers.filter((b: typeof allBuyers[0]) => {
      const { score } = scoreBuyer(b, analysisMap[b.id] as Parameters<typeof scoreBuyer>[1], campaign.targeting ?? {}, productCategories, campaign.brand_name);
      return score > 0;
    });
  }

  if (!targetBuyers.length) {
    return NextResponse.json({ error: 'No matching buyers found', sent: 0 }, { status: 400 });
  }

  // Re-score for the sends log
  const { data: analyses } = await adminSupabase
    .from('buyer_analysis')
    .select('buyer_id, category_weights, price_sensitivity, brand_affinities')
    .in('buyer_id', targetBuyers.map(b => b.id));

  const analysisMap = Object.fromEntries(
    (analyses ?? []).map((a: { buyer_id: string }) => [a.buyer_id, a])
  );

  const marketplaceUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://linezheets.com'}/marketplace`;

  // Send emails and insert send records
  let emailsSent = 0;
  const sendRows: { campaign_id: string; buyer_id: string; email: string; match_score: number }[] = [];

  await Promise.allSettled(
    targetBuyers.map(async buyer => {
      const { score } = scoreBuyer(buyer, analysisMap[buyer.id] as Parameters<typeof scoreBuyer>[1], campaign.targeting ?? {}, productCategories, campaign.brand_name);

      const html = buildRecommendationEmail({
        brandName   : campaign.brand_name,
        storeName   : buyer.store_name,
        subject     : campaign.subject,
        message     : campaign.message ?? '',
        products    : productList,
        marketplaceUrl,
      });

      const res = await sendEmail({
        from   : `${campaign.brand_name} via Linezheets <alerts@linezheets.com>`,
        to     : buyer.email,
        subject: campaign.subject,
        html,
      });

      if (res.ok) {
        emailsSent++;
        sendRows.push({ campaign_id: campaign.id, buyer_id: buyer.id, email: buyer.email, match_score: score });
      }
    })
  );

  // Persist send records
  if (sendRows.length) {
    await adminSupabase.from('brand_recommendation_sends').insert(sendRows);
  }

  // Mark campaign as sent
  await supabase
    .from('brand_recommendation_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: emailsSent })
    .eq('id', id);

  return NextResponse.json({ sent: emailsSent, total_buyers: targetBuyers.length });
}
