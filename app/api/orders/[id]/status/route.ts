import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status, notes } = await req.json() as { status: string; notes?: string };

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Choose: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Brand-only — verify via brand_storefronts
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes) patch.notes = notes;

  const { data, error } = await admin
    .from('buyer_orders')
    .update(patch)
    .eq('id', id)
    .filter('items', 'cs', JSON.stringify([{ brand_name: sf.brand_name }]))
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({ order: data });
}
