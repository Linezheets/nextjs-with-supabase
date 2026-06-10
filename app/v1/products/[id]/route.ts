import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiOk, apiError, newRequestId } from '@/lib/api/respond';
import { PRODUCT_COLUMNS, serializeProduct, productInputToColumns, type ProductRow } from '@/lib/api/serializers';
import type { Database } from '@/lib/supabase/database.types';

/**
 * GET /v1/products/{id} — fetch a single product from the authenticated brand's
 * catalog. Auth: brand API key with scope `products:read`. Returns 404 if the
 * product isn't this brand's.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'products:read', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The products endpoint requires a brand API key', requestId);
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return apiError('invalid_request', 'Product id must be an integer', requestId);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('inventory')
    .select(PRODUCT_COLUMNS)
    .eq('id', numericId)
    .eq('brand_name', ctx.brandName)
    .maybeSingle();

  if (error) return apiError('server', 'Could not load product', requestId);
  if (!data)  return apiError('not_found', `No product found with id ${id}`, requestId);

  return apiOk(serializeProduct(data as ProductRow), requestId);
}

/**
 * PATCH /v1/products/{id} — update fields on the brand's own product.
 * Auth: brand API key with scope `products:write`. 404 if not this brand's.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();

  const auth = await authenticateApiKey(req, requestId);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const scopeErr = requireScope(ctx, 'products:write', requestId);
  if (scopeErr) return scopeErr;

  if (ctx.accountType !== 'brand' || !ctx.brandName) {
    return apiError('forbidden', 'The products endpoint requires a brand API key', requestId);
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return apiError('invalid_request', 'Product id must be an integer', requestId);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return apiError('invalid_request', 'Body must be valid JSON', requestId); }

  const cols = productInputToColumns(body);
  if (Object.keys(cols).length === 0) {
    return apiError('invalid_request', 'No updatable fields provided', requestId);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('inventory')
    .update(cols as unknown as Database['public']['Tables']['inventory']['Update'])
    .eq('id', numericId)
    .eq('brand_name', ctx.brandName) // tenant isolation — only the brand's own rows
    .select(PRODUCT_COLUMNS)
    .maybeSingle();

  if (error) return apiError('server', 'Could not update product', requestId);
  if (!data)  return apiError('not_found', `No product found with id ${id}`, requestId);

  return apiOk(serializeProduct(data as ProductRow), requestId);
}
