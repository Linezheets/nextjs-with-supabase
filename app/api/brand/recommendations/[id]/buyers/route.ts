import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { scoreBuyer } from '@/lib/recommendations';

type Params = { params: Promise<{ id: string }> };

// GET /api/brand/recommendations/:id/buyers
// Returns scored, sorted list of buyers who would receive this campaign.
export async function GET(req: NextRequest, { params }: Params) {
  const supabase      = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Load campaign (must belong to this user)
  const { data: campaign, error: cErr } = await supabase
    .from('brand_recommendation_campaigns')
    .select('*')
    .eq('id', id)
    .eq('brand_user_id', user.id)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Fetch product categories for the selected items
  const { data: products } = await adminSupabase
    .from('inventory')
    .select('id, category, srp, brand_name')
    .in('id', campaign.product_ids ?? []);

  const productCategories = [...new Set((products ?? []).map((p: { category: string | null }) => p.category).filter(Boolean))] as string[];

  // Fetch all active buyers
  const { data: buyers } = await adminSupabase
    .from('buyers')
    .select('id, email, store_name, city, country, categories_sold, market_segment, price_range_max, status')
    .eq('status', 'active');

  if (!buyers?.length) return NextResponse.json({ buyers: [] });

  // Fetch buyer analyses
  const buyerIds = buyers.map((b: { id: string }) => b.id);
  const { data: analyses } = await adminSupabase
    .from('buyer_analysis')
    .select('buyer_id, category_weights, price_sensitivity, brand_affinities')
    .in('buyer_id', buyerIds);

  const analysisMap = Object.fromEntries(
    (analyses ?? []).map((a: { buyer_id: string }) => [a.buyer_id, a])
  );

  // Score every buyer
  const scored = buyers
    .map((buyer: { id: string; email: string; store_name: string; city: string | null; country: string; categories_sold: string[]; market_segment: string | null; price_range_max: number | null; status: string }) => {
      const { score, reasons } = scoreBuyer(
        buyer,
        analysisMap[buyer.id] as Parameters<typeof scoreBuyer>[1],
        campaign.targeting ?? {},
        productCategories,
        campaign.brand_name,
      );
      return {
        id          : buyer.id,
        email       : buyer.email,
        store_name  : buyer.store_name,
        city        : buyer.city,
        country     : buyer.country,
        match_score : score,
        match_reasons: reasons,
      };
    })
    .filter((b: { match_score: number }) => b.match_score > 0)
    .sort((a: { match_score: number }, b: { match_score: number }) => b.match_score - a.match_score);

  return NextResponse.json({ buyers: scored, total: scored.length });
}
