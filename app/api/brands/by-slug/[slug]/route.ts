import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { slug } = await params;

  const { data: sf, error } = await supabase
    .from('brand_storefronts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sf)   return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  // Count followers: find saved rows that contain this brand id in their JSON blob.
  // We use two separate contains checks instead of a single LIKE with assumed key order.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('session_store')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'saved')
    .like('data', `%"item_type":"brand"%`)
    .like('data', `%"item_id":"${sf.id}"%`);

  return NextResponse.json({ ...sf, follower_count: count ?? 0 });
}
