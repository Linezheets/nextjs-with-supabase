import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiList, apiError, newRequestId, encodeCursor, decodeCursor } from '@/lib/api/respond';

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
    .select('id, sku, title, description, category, gender, season, color, material, sizes, image_urls, wsp_usd, srp, moq, stock_total, status, created_at, updated_at')
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

  const rows    = data ?? [];
  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;
  const last    = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  const products = page.map(r => ({
    id                 : String(r.id),
    sku                : r.sku,
    name               : r.title,
    description        : r.description,
    category           : r.category,
    gender             : r.gender,
    season             : r.season,
    color              : r.color,
    material           : r.material,
    sizes              : r.sizes,
    images             : r.image_urls ?? [],
    wholesale_price_usd: r.wsp_usd,
    retail_price_usd   : r.srp,
    min_order_qty      : r.moq,
    stock              : r.stock_total,
    status             : r.status,
    created_at         : r.created_at,
    updated_at         : r.updated_at,
  }));

  return apiList(products, { hasMore, nextCursor, requestId });
}
