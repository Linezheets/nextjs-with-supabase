import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashApiKey, keyEnvironment, type ApiEnvironment } from './keys';
import { apiError } from './respond';

/**
 * API-key authentication for the public /v1 API (V1-API-PLAN.md §3).
 * Separate from lib/supabase/bearer.ts (which handles Supabase *user* sessions).
 */

export interface ApiKeyContext {
  keyId      : string;
  accountType: 'brand' | 'buyer';
  accountId  : string;
  scopes     : string[];
  environment: ApiEnvironment;
  brandName? : string; // resolved for brand keys — used to scope catalog queries
}

const RATE_LIMIT_PER_MIN = 1000;

export async function authenticateApiKey(
  req: NextRequest,
  requestId: string,
): Promise<{ ctx: ApiKeyContext } | { error: NextResponse }> {
  const header = req.headers.get('authorization') ?? '';
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!raw || !keyEnvironment(raw)) {
    return { error: apiError('authentication', 'Missing or malformed API key. Use: Authorization: Bearer lz_live_…', requestId) };
  }

  const admin = createAdminClient();
  const { data: key, error } = await admin
    .from('api_keys')
    .select('id, account_type, account_id, scopes, environment, revoked_at')
    .eq('key_hash', hashApiKey(raw))
    .maybeSingle();

  if (error)          return { error: apiError('server', 'Could not verify credentials', requestId) };
  if (!key)           return { error: apiError('authentication', 'Invalid API key', requestId) };
  if (key.revoked_at) return { error: apiError('authentication', 'This API key has been revoked', requestId) };

  // Per-key rate limit. NOTE: in-memory per instance — move to Redis for GA (plan §6).
  const rl = checkRateLimit(`apikey:${key.id}`, RATE_LIMIT_PER_MIN, 60_000);
  if (!rl.allowed) {
    return {
      error: apiError('rate_limit', 'Rate limit exceeded', requestId, {
        headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)), 'X-RateLimit-Remaining': '0' },
      }),
    };
  }

  const ctx: ApiKeyContext = {
    keyId      : key.id,
    accountType: key.account_type as 'brand' | 'buyer',
    accountId  : key.account_id,
    scopes     : key.scopes ?? [],
    environment: key.environment as ApiEnvironment,
  };

  if (ctx.accountType === 'brand') {
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('brand_name')
      .eq('id', ctx.accountId)
      .maybeSingle();
    ctx.brandName = sf?.brand_name ?? undefined;
  }

  // Record usage without blocking the response (API host is a persistent server).
  void admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(
    () => {},
    () => {},
  );

  return { ctx };
}

/** Returns an error response if the key lacks `scope`, otherwise null. */
export function requireScope(ctx: ApiKeyContext, scope: string, requestId: string): NextResponse | null {
  if (ctx.scopes.includes(scope)) return null;
  return apiError('forbidden', `This key is missing the required scope: ${scope}`, requestId, { code: 'insufficient_scope' });
}
