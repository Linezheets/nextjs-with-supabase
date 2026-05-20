import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', user.id)
    .maybeSingle() as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge Supabase Auth metadata with buyers table row
  const profile = {
    id         : user.id,
    email      : user.email,
    ...buyer,
    // Auth user_metadata fields as fallback
    first_name : buyer?.first_name ?? user.user_metadata?.first_name ?? null,
    last_name  : buyer?.last_name  ?? user.user_metadata?.last_name  ?? null,
    store_name : buyer?.store_name ?? user.user_metadata?.store_name ?? null,
    role       : user.user_metadata?.role ?? (buyer ? 'buyer' : 'brand'),
  };

  return NextResponse.json({ buyer: profile });
}
