import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone',
  'store_name', 'store_address', 'city', 'country', 'store_url',
  'instagram', 'tiktok', 'linkedin', 'other_socials',
  'store_type', 'categories_sold', 'price_range_min', 'price_range_max',
  'market_segment', 'annual_buy_budget',
] as const;

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', user.id)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = {
    id         : user.id,
    email      : user.email,
    ...buyer,
    first_name : buyer?.first_name ?? user.user_metadata?.first_name ?? null,
    last_name  : buyer?.last_name  ?? user.user_metadata?.last_name  ?? null,
    store_name : buyer?.store_name ?? user.user_metadata?.store_name ?? null,
    role       : user.user_metadata?.role ?? (buyer ? 'buyer' : 'brand'),
  };

  return NextResponse.json({ buyer: profile });
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Only allow known editable fields
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('buyers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buyer: data });
}
