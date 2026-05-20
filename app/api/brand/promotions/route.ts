import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('brand_promotions')
    .select('*')
    .eq('brand_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const { data: storefront } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .single();

  if (!storefront) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { name, headline, description, promo_type, discount_pct, min_qty, min_spend,
          target_category, min_tier, product_ids, expires_at } = body;

  if (!name || !headline || !promo_type || discount_pct == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validTypes = ['volume_discount', 'spend_threshold', 'category_deal', 'loyalty_reward'];
  if (!validTypes.includes(promo_type)) {
    return NextResponse.json({ error: 'Invalid promo_type' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('brand_promotions')
    .insert({
      brand_user_id: user.id,
      brand_name: storefront.brand_name,
      name, headline,
      description: description ?? null,
      promo_type,
      discount_pct,
      min_qty: min_qty ?? null,
      min_spend: min_spend ?? null,
      target_category: target_category ?? null,
      min_tier: min_tier ?? 'silver',
      product_ids: product_ids ?? [],
      expires_at: expires_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const allowed = ['name', 'headline', 'description', 'discount_pct', 'min_qty', 'min_spend',
                   'target_category', 'min_tier', 'product_ids', 'expires_at', 'active'];
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('brand_promotions')
    .update(update)
    .eq('id', id)
    .eq('brand_user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
