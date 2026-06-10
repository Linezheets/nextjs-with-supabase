import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiKey, requireScope } from '@/lib/api/auth';
import { apiOk, apiError, newRequestId } from '@/lib/api/respond';
import { PRODUCT_COLUMNS, serializeProduct, type ProductRow } from '@/lib/api/serializers';

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
