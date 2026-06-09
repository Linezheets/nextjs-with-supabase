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
    .select('id, status, buyer_id, buyer_name')
    .eq('id', id)
    .eq('brand_name', sf.brand_name)
    .maybeSingle() as { data: { id: string; status: string; buyer_id: string | null; buyer_name: string | null } | null };

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

  // Notify the buyer on delivery (non-blocking).
  if (status === 'delivered') {
    try {
      let buyerEmail: string | null = (current.buyer_name && String(current.buyer_name).includes('@')) ? current.buyer_name : null;
      if (!buyerEmail && current.buyer_id) {
        const { data: u } = await admin.auth.admin.getUserById(current.buyer_id);
        buyerEmail = u?.user?.email ?? null;
      }
      if (buyerEmail) {
        const { sendEmail, orderStatusUpdateHtml } = await import('@/lib/email');
        await sendEmail({
          to     : buyerEmail,
          subject: `Your order was delivered — ${id}`,
          html   : orderStatusUpdateHtml({
            buyer_name  : current.buyer_name ?? 'there',
            order_id    : id,
            status      : 'delivered',
            platform_url: process.env.NEXT_PUBLIC_SITE_URL,
          }),
        });
      }
    } catch (e) { console.error('[order-status] delivered email failed', id, e); }
  }

  // Notify the brand when escrow funds are released to them (non-blocking).
  if (escrowRelease) {
    try {
      const { data: brand } = await admin
        .from('brand_storefronts')
        .select('contact_email')
        .eq('brand_name', sf.brand_name)
        .maybeSingle();
      if (brand?.contact_email) {
        const { sendEmail } = await import('@/lib/email');
        await sendEmail({
          to     : brand.contact_email,
          subject: `Funds released — order ${id}`,
          html   : `<p>Escrowed funds for order <strong>${id}</strong> have been released to your Stripe account.</p>
                    <p>Net payout: <strong>$${escrowRelease.transferred.toFixed(2)}</strong> (after platform commission).</p>`,
        });
      }
    } catch (e) { console.error('[order-status] release email failed', id, e); }
  }

  return NextResponse.json({ order: data, escrow_release: escrowRelease });
}
