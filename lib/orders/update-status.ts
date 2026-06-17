import { releaseEscrow, shouldAutoRelease } from '@/lib/escrow';

/**
 * Single source of truth for brand order-status changes — used by both the
 * dashboard route and the public /v1 API. Touches the escrow/Stripe path, so it
 * lives in one place: validate transition → update → (maybe) release escrow →
 * notify. Extracted verbatim from app/api/orders/[id]/status/route.ts.
 */

export const VALID_ORDER_STATUSES = ['confirmed', 'processing', 'allocation_confirmed', 'shipped', 'delivered', 'cancelled'];

// Legal transitions. 'delivered' (which triggers escrow release) can ONLY be
// reached from 'shipped' — funds never release on a never-shipped order.
const TRANSITIONS: Record<string, string[]> = {
  new                 : ['confirmed', 'processing', 'allocation_confirmed', 'cancelled'],
  confirmed           : ['processing', 'allocation_confirmed', 'shipped', 'cancelled'],
  processing          : ['allocation_confirmed', 'shipped', 'cancelled'],
  allocation_confirmed: ['shipped', 'cancelled'],
  shipped             : ['delivered', 'cancelled'],
  delivered           : [],
  cancelled           : [],
};

export type EscrowRelease = { transfer_id: string; transferred: number };

export type UpdateOrderStatusResult =
  | { ok: true; order: { id: string; payment_status: string | null; escrow_status: string | null }; escrowRelease: EscrowRelease | null }
  | { ok: false; httpStatus: number; error: string };

/**
 * @param admin     service-role Supabase client (untyped: touches columns
 *                  outside the generated types, e.g. payment_status/escrow_status)
 * @param brandName the calling brand — orders are scoped to it (tenant isolation)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateOrderStatus(admin: any, opts: { orderId: string; brandName: string; toStatus: string; notes?: string | null }): Promise<UpdateOrderStatusResult> {
  const { orderId, brandName, toStatus, notes } = opts;

  if (!VALID_ORDER_STATUSES.includes(toStatus)) {
    return { ok: false, httpStatus: 400, error: `Invalid status. Choose: ${VALID_ORDER_STATUSES.join(', ')}` };
  }

  const { data: current } = await admin
    .from('buyer_orders')
    .select('id, status, buyer_id, buyer_name')
    .eq('id', orderId)
    .eq('brand_name', brandName)
    .maybeSingle();
  if (!current) return { ok: false, httpStatus: 404, error: 'Order not found' };

  const fromStatus = current.status ?? 'new';
  if (fromStatus !== toStatus && !(TRANSITIONS[fromStatus] ?? []).includes(toStatus)) {
    return { ok: false, httpStatus: 409, error: `Illegal status transition: ${fromStatus} → ${toStatus}` };
  }

  const patch: Record<string, unknown> = { status: toStatus, updated_at: new Date().toISOString() };
  if (notes) patch.notes = notes;

  const { data, error } = await admin
    .from('buyer_orders')
    .update(patch)
    .eq('id', orderId)
    .eq('brand_name', brandName)
    .select('id, payment_status, escrow_status')
    .maybeSingle();
  if (error) return { ok: false, httpStatus: 500, error: error.message };
  if (!data)  return { ok: false, httpStatus: 404, error: 'Order not found' };

  // Restore inventory when an order is cancelled (idempotent — the RPC no-ops if
  // already restored). FUTURE_ALLOCATION lines never decremented, so the RPC
  // skips them. Non-fatal: a restore failure must not block the cancellation.
  if (toStatus === 'cancelled' && fromStatus !== 'cancelled') {
    try {
      const { error: restoreErr } = await admin.rpc('restore_order_stock', { p_order_id: orderId });
      if (restoreErr) console.error('[order-status] stock restore failed for', orderId, restoreErr);
    } catch (err) {
      console.error('[order-status] stock restore threw for', orderId, err);
    }
  }

  // Auto-release escrow when delivered and payment is fully captured.
  let escrowRelease: EscrowRelease | null = null;
  if (shouldAutoRelease(toStatus, data.payment_status, data.escrow_status)) {
    try {
      const result = await releaseEscrow(orderId);
      escrowRelease = { transfer_id: result.transferId, transferred: result.transferred / 100 };
    } catch (err) {
      // Don't fail the status change — releaseEscrow already rolled the escrow
      // claim back to a retryable state, and an admin can release manually via
      // POST /api/payments/release. But this must NOT be silent: a delivered,
      // fully-paid order whose payout failed (e.g. brand never completed Stripe
      // Connect onboarding) would otherwise sit with funds stuck and no signal.
      // Alert an admin so it gets actioned.
      console.error('[order-status] escrow auto-release failed for', orderId, err);
      try {
        const adminTo = process.env.NOTIFY_EMAIL
          ?? process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
          ?? 'info@mxlla.com';
        const { sendEmail } = await import('@/lib/email');
        await sendEmail({
          to     : adminTo,
          subject: `⚠ Escrow auto-release FAILED — order ${orderId}`,
          html   : `<p>Order <strong>${orderId}</strong> (brand <strong>${brandName}</strong>) was marked
                    <strong>delivered</strong> but the automatic escrow release to the brand failed.</p>
                    <p><strong>Reason:</strong> ${(err as Error)?.message ?? String(err)}</p>
                    <p>Funds remain held. Resolve the cause (commonly the brand has no active Stripe Connect
                    account) and release manually via <code>POST /api/payments/release/${orderId}</code>.</p>`,
        });
      } catch (mailErr) {
        console.error('[order-status] failed to send escrow-failure admin alert for', orderId, mailErr);
      }
    }
  }

  // Notify the buyer on delivery (non-blocking).
  if (toStatus === 'delivered') {
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
          subject: `Your order was delivered — ${orderId}`,
          html   : orderStatusUpdateHtml({ buyer_name: current.buyer_name ?? 'there', order_id: orderId, status: 'delivered', platform_url: process.env.NEXT_PUBLIC_SITE_URL }),
        });
      }
    } catch (e) { console.error('[order-status] delivered email failed', orderId, e); }
  }

  // Notify the brand when escrow funds are released (non-blocking).
  if (escrowRelease) {
    try {
      const { data: brand } = await admin.from('brand_storefronts').select('contact_email').eq('brand_name', brandName).maybeSingle();
      if (brand?.contact_email) {
        const { sendEmail } = await import('@/lib/email');
        await sendEmail({
          to     : brand.contact_email,
          subject: `Funds released — order ${orderId}`,
          html   : `<p>Escrowed funds for order <strong>${orderId}</strong> have been released to your Stripe account.</p>
                    <p>Net payout: <strong>$${escrowRelease.transferred.toFixed(2)}</strong> (after platform commission).</p>`,
        });
      }
    } catch (e) { console.error('[order-status] release email failed', orderId, e); }
  }

  return { ok: true, order: data, escrowRelease };
}
