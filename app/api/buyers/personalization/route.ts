import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try by primary key 'id' first (activate flow), fall back to 'auth_user_id'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let { data: buyer } = await db
    .from('buyers')
    .select('id, categories_sold, market_segment, price_range_min, price_range_max, buyer_analysis(*)')
    .eq('id', user.id)
    .maybeSingle();
  if (!buyer) {
    ({ data: buyer } = await db
      .from('buyers')
      .select('id, categories_sold, market_segment, price_range_min, price_range_max, buyer_analysis(*)')
      .eq('auth_user_id', user.id)
      .maybeSingle());
  }

  const analysis = buyer?.buyer_analysis ?? null;

  return NextResponse.json({
    personalization: {
      style_dna           : analysis?.style_dna            ?? {},
      category_weights    : analysis?.category_weights     ?? {},
      price_sensitivity   : analysis?.price_sensitivity    ?? null,
      trend_alignment     : analysis?.trend_alignment      ?? null,
      personalization_tags: analysis?.personalization_tags ?? [],
      brand_affinities    : analysis?.brand_affinities     ?? [],
      preferred_categories: buyer?.categories_sold         ?? [],
      market_segment      : buyer?.market_segment          ?? null,
      price_range         : {
        min: buyer?.price_range_min ?? null,
        max: buyer?.price_range_max ?? null,
      },
    },
  });
}
