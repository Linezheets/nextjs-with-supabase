import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { updateOrderStatus } from '@/lib/orders/update-status';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { tracking_number, carrier, tracking_url } = await req.json() as {
    tracking_number : string;
    carrier?        : string;
    tracking_url?   : string;
  };

  if (!tracking_number) {
    return NextResponse.json({ error: 'tracking_number is required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, notes, buyer_id, buyer_name')
    .eq('id', id)
    .eq('brand_name', sf.brand_name)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Store tracking as a notes annotation (no dedicated column yet — minimal schema impact)
  const trackingNote = `Tracking: ${tracking_number}${carrier ? ` (${carrier})` : ''}${tracking_url ? ` — ${tracking_url}` : ''}`;
  const updatedNotes = order.notes ? `${order.notes}\n${trackingNote}` : trackingNote;

  // Route the status change through the canonical state machine so adding
  // tracking can't force an order from an illegal state into 'shipped'
  // (e.g. 'new' → 'shipped' or un-cancelling). Re-adding tracking to an
  // already-shipped order is allowed (same-status update).
  const result = await updateOrderStatus(admin, {
    orderId  : id,
    brandName: sf.brand_name,
    toStatus : 'shipped',
    notes    : updatedNotes,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  const data = result.order;

  // Notify the buyer their order shipped (non-blocking — never fail the update on email).
  try {
    let buyerEmail: string | null = (order.buyer_name && String(order.buyer_name).includes('@')) ? order.buyer_name : null;
    if (!buyerEmail && order.buyer_id) {
      const { data: u } = await admin.auth.admin.getUserById(order.buyer_id);
      buyerEmail = u?.user?.email ?? null;
    }
    if (buyerEmail) {
      const { sendEmail, orderStatusUpdateHtml } = await import('@/lib/email');
      await sendEmail({
        to     : buyerEmail,
        subject: `Your order has shipped — ${id}`,
        html   : orderStatusUpdateHtml({
          buyer_name  : order.buyer_name ?? 'there',
          order_id    : id,
          status      : 'shipped',
          tracking_url,
          platform_url: process.env.NEXT_PUBLIC_SITE_URL,
        }),
      });
    }
  } catch (e) { console.error('[tracking] dispatch email failed', id, e); }

  return NextResponse.json({ order: data, tracking: { tracking_number, carrier, tracking_url } });
}
