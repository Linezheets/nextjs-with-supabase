import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { data, error } = await admin
    .from('inventory')
    .select('id, title, sku, stock_total, moq, category, season, image_urls')
    .eq('brand_name', sf.brand_name)
    .eq('status', 'active')
    .lt('stock_total', 5)
    .order('stock_total', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alerts: data ?? [], count: (data ?? []).length });
}
