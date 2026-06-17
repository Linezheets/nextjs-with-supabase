import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refundOrder } from '@/lib/refunds';

/**
 * POST /api/payments/refund/[orderId]
 *
 * Issues a buyer refund: reverses the brand transfer if escrow was already
 * released, then stripe.refunds.create against each succeeded PaymentIntent,
 * restores stock, and marks the order refunded. Platform-admin only.
 *
 * Body (optional): { amount_usd?: number, reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' }
 * Omit amount_usd for a full refund.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  if (!adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  let body: { amount_usd?: number; reason?: string } = {};
  try { body = await req.json(); } catch { /* empty body = full refund */ }

  const reason = (['requested_by_customer', 'duplicate', 'fraudulent'] as const)
    .find(r => r === body.reason);

  try {
    const result = await refundOrder(orderId, {
      amountUsd: body.amount_usd ?? null,
      reason,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[refund]', orderId, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
