import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateApiKey, type ApiEnvironment } from '@/lib/api/keys';

/**
 * Dashboard-only management of a brand's public /v1 API keys.
 * Auth is the brand's logged-in session; api_keys itself is RLS-locked to the
 * service role, so reads/writes go through the admin client scoped by storefront.
 */

const ALLOWED_SCOPES = ['products:read', 'products:write', 'orders:read', 'buyers:read', 'linesheets:read'];

async function resolveBrand() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, sfId: null as string | null };
  const { data: sf } = await supabase
    .from('brand_storefronts').select('id').eq('user_id', user.id).maybeSingle();
  return { user, sfId: sf?.id ?? null };
}

export async function GET() {
  const { user, sfId } = await resolveBrand();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sfId) return NextResponse.json({ keys: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .select('id, key_prefix, name, scopes, environment, last_used_at, created_at, revoked_at')
    .eq('account_type', 'brand')
    .eq('account_id', sfId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, sfId } = await resolveBrand();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sfId) return NextResponse.json({ error: 'Create your store first' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  const env: ApiEnvironment = body.environment === 'test' ? 'test' : 'live';
  const scopes = Array.isArray(body.scopes)
    ? (body.scopes as unknown[]).filter((s): s is string => typeof s === 'string' && ALLOWED_SCOPES.includes(s))
    : [];
  if (scopes.length === 0) return NextResponse.json({ error: 'Select at least one scope' }, { status: 400 });

  const { raw, keyPrefix, keyHash } = generateApiKey(env);
  const admin = createAdminClient();
  const { error } = await admin.from('api_keys').insert({
    key_prefix  : keyPrefix,
    key_hash    : keyHash,
    name,
    account_type: 'brand',
    account_id  : sfId,
    scopes,
    environment : env,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The raw key is returned exactly once — it is never stored or recoverable.
  return NextResponse.json({ key: raw, key_prefix: keyPrefix }, { status: 201 });
}
