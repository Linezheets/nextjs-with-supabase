import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiList, apiError, newRequestId, encodeCursor, decodeCursor } from '@/lib/api/respond';
import { ORDER_COLUMNS, serializeOrder, type OrderRow } from '@/lib/api/serializers';

/**
 * GET /v1/orders — list the authenticated brand's orders.
 * Auth: brand API key with scope `orders:read`.
 * Query: ?limit=1..100 (default 50) &cursor=<opaque>
 */

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

export async function GET(req: NextRequest) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'orders:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand') {
    return apiError('forbidden', 'The orders endpoint requires a brand API key', requestId);
  }
  if (!ctx.brandName) {
    return apiError('server', 'This brand account is not fully configured', requestId);
  }

  const url   = new URL(req.url);
  const asked = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  let query = admin
    .from('buyer_orders')
    .select(ORDER_COLUMNS)
    .eq('brand_name', ctx.brandName)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return apiError('invalid_request', 'Invalid cursor', requestId);
    query = query.lt('created_at', decoded.createdAt);
  }

  const { data, error } = await query;
  if (error) return apiError('server', 'Could not load orders', requestId);

  const rows    = (data ?? []) as OrderRow[];
  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;
  const last    = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return apiList(page.map(serializeOrder), { hasMore, nextCursor, requestId });
}
