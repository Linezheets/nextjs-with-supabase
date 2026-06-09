/**
 * Authoritative order payment-status reconciliation.
 *
 * "paid" must mean FULLY COLLECTED. A single succeeded installment must never
 * flip the whole order to 'paid' (that previously let escrow release the full
 * total after only a deposit). This recomputes payment_status from the
 * buyer_payments ledger and is the single source of truth for all charge paths
 * (webhook, cron, manual installment charge).
 */

const EPS = 0.01; // one-cent tolerance for float/rounding drift

export type ReconcileResult = {
  collected : number;
  total     : number;
  fullyPaid : boolean;
  status    : 'paid' | 'partially_paid' | 'unpaid';
};

export async function reconcileOrderPaymentStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin  : any,
  orderId: string,
): Promise<ReconcileResult> {
  const { data: order } = await admin
    .from('buyer_orders')
    .select('total_usd')
    .eq('id', orderId)
    .single();

  const total = Number(order?.total_usd ?? 0);

  const { data: rows } = await admin
    .from('buyer_payments')
    .select('amount_usd, amount, status')
    .eq('order_id', orderId);

  const payments: Array<{ amount_usd: number | null; amount: number | null; status: string }> = rows ?? [];

  const collected = Math.round(
    payments
      .filter(p => p.status === 'succeeded')
      .reduce((s, p) => s + Number(p.amount_usd ?? p.amount ?? 0), 0) * 100,
  ) / 100;

  const hasOutstanding = payments.some(p => p.status === 'pending' || p.status === 'processing');

  const fullyPaid = collected + EPS >= total && total > 0 && !hasOutstanding;
  const status: ReconcileResult['status'] =
    fullyPaid ? 'paid' : collected > 0 ? 'partially_paid' : 'unpaid';

  await admin
    .from('buyer_orders')
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  return { collected, total, fullyPaid, status };
}
