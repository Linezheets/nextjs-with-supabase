import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone',
  'store_name', 'store_address', 'city', 'country', 'store_url',
  'instagram', 'tiktok', 'linkedin', 'other_socials',
  'store_type', 'categories_sold', 'price_range_min', 'price_range_max',
  'market_segment', 'annual_buy_budget',
] as const;

// The buyers table may use either 'id' or 'auth_user_id' as the FK to auth.users.
// The activate route upserts using { id: user.id }, so we query by 'id' first
// and fall back to 'auth_user_id' for rows created via the legacy backend.
async function fetchBuyerRow(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data: byId } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (byId) return byId as Record<string, unknown>;

  const { data: byAuthId } = await supabase
    .from('buyers')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (byAuthId ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buyer = await fetchBuyerRow(supabase as any, user.id);

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

  // Try updating by 'id' first (activate flow), then fall back to 'auth_user_id'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let result = await db.from('buyers').update(updates).eq('id', user.id).select().maybeSingle();

  if (!result.data && !result.error) {
    // Row may be keyed by auth_user_id
    result = await db.from('buyers').update(updates).eq('auth_user_id', user.id).select().single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ buyer: result.data });
}
