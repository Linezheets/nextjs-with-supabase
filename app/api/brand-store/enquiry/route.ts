import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { slug, inventory_id, name, email, message } = await req.json();

  if (!slug || !name || !email) {
    return NextResponse.json({ error: 'slug, name and email required' }, { status: 400 });
  }

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Storefront not found' }, { status: 404 });

  const { error } = await supabase
    .from('brand_storefront_enquiries')
    .insert({ storefront_id: sf.id, inventory_id: inventory_id ?? null, name, email, message: message ?? null });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
