import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiOk, apiError, newRequestId } from '@/lib/api/respond';
import { ORDER_COLUMNS, serializeOrder, type OrderRow } from '@/lib/api/serializers';
import { updateOrderStatus } from '@/lib/orders/update-status';

/**
 * GET /v1/orders/{id} — fetch a single order owned by the authenticated brand.
 * Auth: brand API key with scope `orders:read`. Returns 404 if the order
 * isn't this brand's (tenant isolation — never leak another brand's order).
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'orders:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The orders endpoint requires a brand API key', requestId);
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('buyer_orders')
    .select(ORDER_COLUMNS)
    .eq('id', id)
    .eq('brand_name', ctx.brandName)
    .maybeSingle();

  if (error) return apiError('server', 'Could not load order', requestId);
  if (!data)  return apiError('not_found', `No order found with id ${id}`, requestId);

  return apiOk(serializeOrder(data as OrderRow), requestId);
}

/**
 * PATCH /v1/orders/{id} — change an order's status (state machine + escrow).
 * Auth: brand API key with scope `orders:write`. Body: { status, notes? }.
 * Delegates to the shared updateOrderStatus so the escrow/Stripe path is
 * byte-for-byte identical to the dashboard. Marking an order `delivered` can
 * trigger a real Stripe transfer — guarded by the same transition rules.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'orders:write', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The orders endpoint requires a brand API key', requestId);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return apiError('invalid_request', 'Body must be valid JSON', requestId); }
  const toStatus = typeof body.status === 'string' ? body.status : '';
  if (!toStatus) return apiError('invalid_request', 'status is required', requestId);

  const { id } = await params;
  const admin = createAdminClient();
  const result = await updateOrderStatus(admin, {
    orderId  : id,
    brandName: ctx.brandName,
    toStatus,
    notes    : typeof body.notes === 'string' ? body.notes : null,
  });

  if (!result.ok) {
    const type = result.httpStatus === 404 ? 'not_found' : result.httpStatus === 500 ? 'server' : 'invalid_request';
    return apiError(type, result.error, requestId);
  }

  // Return the full updated order in the standard envelope.
  const { data } = await admin
    .from('buyer_orders').select(ORDER_COLUMNS).eq('id', id).eq('brand_name', ctx.brandName).maybeSingle();
  return apiOk({ ...(data ? serializeOrder(data as OrderRow) : { id }), escrow_release: result.escrowRelease }, requestId);
}
