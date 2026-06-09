import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { releaseEscrow, shouldAutoRelease } from '@/lib/escrow';

const VALID_STATUSES = ['confirmed', 'processing', 'allocation_confirmed', 'shipped', 'delivered', 'cancelled'];

// Legal status transitions. 'delivered' (which triggers escrow release) can ONLY
// be reached from 'shipped' — an order can't jump straight to delivered, and
// terminal states can't change. Prevents releasing funds on never-shipped orders.
const TRANSITIONS: Record<string, string[]> = {
  new                 : ['confirmed', 'processing', 'allocation_confirmed', 'cancelled'],
  confirmed           : ['processing', 'allocation_confirmed', 'shipped', 'cancelled'],
  processing          : ['allocation_confirmed', 'shipped', 'cancelled'],
  allocation_confirmed: ['shipped', 'cancelled'],
  shipped             : ['delivered', 'cancelled'],
  delivered           : [],
  cancelled           : [],
};

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

  // Load the current order (brand-scoped) to validate the transition.
  const { data: current } = await admin
    .from('buyer_orders')
    .select('id, status')
    .eq('id', id)
    .eq('brand_name', sf.brand_name)
    .maybeSingle() as { data: { id: string; status: string } | null };

  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const fromStatus = current.status ?? 'new';
  if (fromStatus !== status && !(TRANSITIONS[fromStatus] ?? []).includes(status)) {
    return NextResponse.json(
      { error: `Illegal status transition: ${fromStatus} → ${status}` },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes) patch.notes = notes;

  const { data, error } = await admin
    .from('buyer_orders')
    .update(patch)
    .eq('id', id)
    .eq('brand_name', sf.brand_name)
    .select('id, payment_status, escrow_status')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Auto-release escrow when order is marked delivered and payment is fully captured
  let escrowRelease: { transfer_id: string; transferred: number } | null = null;
  if (shouldAutoRelease(status, data.payment_status, data.escrow_status)) {
    try {
      const result = await releaseEscrow(id);
      escrowRelease = { transfer_id: result.transferId, transferred: result.transferred / 100 };
    } catch (err) {
      // Log but don't fail the status update — admin can manually release
      console.error('[order-status] escrow auto-release failed for', id, err);
    }
  }

  return NextResponse.json({ order: data, escrow_release: escrowRelease });
}
