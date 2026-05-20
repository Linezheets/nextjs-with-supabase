import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — brand's own inventory items for the recommendation product picker
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  let query = supabase
    .from('inventory')
    .select('id, title, brand_name, srp, image_urls, category, season, color')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (sf?.brand_name) {
    query = query.eq('brand_name', sf.brand_name);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
