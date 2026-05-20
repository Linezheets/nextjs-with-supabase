import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: analysis } = await supabase
    .from('buyer_analysis')
    .select('*')
    .eq('buyer_id', user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: buyer } = await (supabase as any)
    .from('buyers')
    .select('categories_sold, market_segment, price_range_min, price_range_max')
    .eq('id', user.id)
    .maybeSingle();

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
