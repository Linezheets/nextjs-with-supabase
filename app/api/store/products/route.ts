import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getStorefrontId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('buyer_storefronts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

// GET — list products in this buyer's storefront
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ products: [] });

  const { data, error } = await supabase
    .from('storefront_products')
    .select('*')
    .eq('storefront_id', sfId)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// POST — add or update a product in the storefront
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ error: 'Create your store first' }, { status: 400 });

  const { catalog_item_id, consumer_price, featured, sort_order, published } = await req.json();
  if (!catalog_item_id) return NextResponse.json({ error: 'catalog_item_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('storefront_products')
    .upsert({
      storefront_id  : sfId,
      catalog_item_id,
      consumer_price : consumer_price ?? null,
      featured       : featured ?? false,
      sort_order     : sort_order ?? 0,
      published      : published ?? true,
    }, { onConflict: 'storefront_id,catalog_item_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

// DELETE — remove a product from the storefront
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ error: 'No storefront found' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const catalog_item_id = searchParams.get('id');
  if (!catalog_item_id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await supabase
    .from('storefront_products')
    .delete()
    .eq('storefront_id', sfId)
    .eq('catalog_item_id', catalog_item_id);

  return NextResponse.json({ success: true });
}
