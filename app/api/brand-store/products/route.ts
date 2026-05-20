import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getStorefrontId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('brand_storefronts').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ products: [] });

  const { data, error } = await supabase
    .from('brand_storefront_products')
    .select('*')
    .eq('storefront_id', sfId)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ error: 'Create your store first' }, { status: 400 });

  const { inventory_id, consumer_price, featured, sort_order, published } = await req.json();
  if (!inventory_id) return NextResponse.json({ error: 'inventory_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('brand_storefront_products')
    .upsert({
      storefront_id : sfId,
      inventory_id  : Number(inventory_id),
      consumer_price: consumer_price ?? null,
      featured      : featured ?? false,
      sort_order    : sort_order ?? 0,
      published     : published ?? true,
    }, { onConflict: 'storefront_id,inventory_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sfId = await getStorefrontId(supabase, user.id);
  if (!sfId) return NextResponse.json({ error: 'No storefront' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const inventory_id = searchParams.get('id');
  if (!inventory_id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await supabase
    .from('brand_storefront_products')
    .delete()
    .eq('storefront_id', sfId)
    .eq('inventory_id', Number(inventory_id));

  return NextResponse.json({ success: true });
}
