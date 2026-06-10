import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiList, apiError, newRequestId } from '@/lib/api/respond';
import { BUYER_COLUMNS, serializeBuyer, type BuyerRow } from '@/lib/api/serializers';

/**
 * GET /v1/buyers — buyers who have ordered from the authenticated brand.
 * Auth: brand API key with scope `buyers:read`.
 * Privacy: only buyers with an order relationship to this brand are returned,
 * and never email/phone — identity + segment fields only (v1).
 */

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

export async function GET(req: NextRequest) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'buyers:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The buyers endpoint requires a brand API key', requestId);
  }

  const url   = new URL(req.url);
  const asked = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : DEFAULT_LIMIT, 1), MAX_LIMIT);

  const admin = createAdminClient();

  // Who has ordered from this brand? (buyer_orders.buyer_id is the auth user id)
  const { data: orderRows, error: oErr } = await admin
    .from('buyer_orders')
    .select('buyer_id')
    .eq('brand_name', ctx.brandName);
  if (oErr) return apiError('server', 'Could not load buyers', requestId);

  const buyerIds = [...new Set((orderRows ?? []).map(o => o.buyer_id).filter(Boolean))] as string[];
  if (buyerIds.length === 0) {
    return apiList([], { hasMore: false, nextCursor: null, requestId });
  }

  const { data, error } = await admin
    .from('buyers')
    .select(BUYER_COLUMNS)
    .in('auth_user_id', buyerIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return apiError('server', 'Could not load buyers', requestId);

  return apiList((data as BuyerRow[] ?? []).map(serializeBuyer), {
    hasMore: false, nextCursor: null, requestId,
  });
}
