import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiOk, apiList, apiError, newRequestId, encodeCursor, decodeCursor } from '@/lib/api/respond';
import { PRODUCT_COLUMNS, serializeProduct, productInputToColumns, type ProductRow } from '@/lib/api/serializers';
import type { Database } from '@/lib/supabase/database.types';

/**
 * GET /v1/products — list the authenticated brand's catalog.
 * Auth: brand API key with scope `products:read`.
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

  const scopeErr = requireScope(ctx, 'products:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand') {
    return apiError('forbidden', 'The products endpoint requires a brand API key', requestId);
  }
  if (!ctx.brandName) {
    return apiError('server', 'This brand account has no catalog configured', requestId);
  }

  const url   = new URL(req.url);
  const asked = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  let query = admin
    .from('inventory')
    .select(PRODUCT_COLUMNS)
    .eq('brand_name', ctx.brandName)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1); // fetch one extra to detect has_more

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return apiError('invalid_request', 'Invalid cursor', requestId);
    query = query.lt('created_at', decoded.createdAt);
  }

  const { data, error } = await query;
  if (error) return apiError('server', 'Could not load products', requestId);

  const rows    = (data ?? []) as ProductRow[];
  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;
  const last    = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return apiList(page.map(serializeProduct), { hasMore, nextCursor, requestId });
}

/**
 * POST /v1/products — create a product in the authenticated brand's catalog.
 * Auth: brand API key with scope `products:write`. brand_name is taken from the
 * key, never the client. (Not yet idempotent — see V1-API-PLAN.md §6.)
 */
export async function POST(req: NextRequest) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'products:write', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The products endpoint requires a brand API key', requestId);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return apiError('invalid_request', 'Body must be valid JSON', requestId); }
  if (!body?.name) return apiError('invalid_request', 'name is required', requestId);

  const cols = productInputToColumns(body);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('inventory')
    .insert({
      ...cols,
      brand_name: ctx.brandName, // from the key, not the client
      brand_id  : 1,             // legacy column; brand_name is the real scope
      status    : (typeof cols.status === 'string' ? cols.status : 'active'),
    } as unknown as Database['public']['Tables']['inventory']['Insert'])
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) return apiError('server', 'Could not create product', requestId);

  return apiOk(serializeProduct(data as ProductRow), requestId, { status: 201 });
}
