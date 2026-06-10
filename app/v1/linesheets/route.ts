import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiList, apiError, newRequestId, encodeCursor, decodeCursor } from '@/lib/api/respond';
import { LINESHEET_COLUMNS, serializeLinesheet, type LinesheetRow } from '@/lib/api/serializers';

/**
 * GET /v1/linesheets — the authenticated brand's linesheet import jobs.
 * Auth: brand API key with scope `linesheets:read`.
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

  const scopeErr = requireScope(ctx, 'linesheets:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandUserId) {
    return apiError('forbidden', 'The linesheets endpoint requires a brand API key', requestId);
  }

  const url   = new URL(req.url);
  const asked = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  let query = admin
    .from('linesheet_imports')
    .select(LINESHEET_COLUMNS)
    .eq('brand_user_id', ctx.brandUserId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return apiError('invalid_request', 'Invalid cursor', requestId);
    query = query.lt('created_at', decoded.createdAt);
  }

  const { data, error } = await query;
  if (error) return apiError('server', 'Could not load linesheets', requestId);

  const rows    = (data ?? []) as LinesheetRow[];
  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;
  const last    = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return apiList(page.map(serializeLinesheet), { hasMore, nextCursor, requestId });
}
