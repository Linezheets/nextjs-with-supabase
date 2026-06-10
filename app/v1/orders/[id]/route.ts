import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiOk, apiError, newRequestId } from '@/lib/api/respond';
import { ORDER_COLUMNS, serializeOrder, type OrderRow } from '@/lib/api/serializers';

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
