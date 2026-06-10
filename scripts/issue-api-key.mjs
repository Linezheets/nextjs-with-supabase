/**
 * Mint a public /v1 API key for a brand storefront (until a dashboard UI exists).
 *
 *   node scripts/issue-api-key.mjs --brand <slug-or-id> [--scopes products:read,orders:read] [--env live] [--name "ERP"]
 *
 * Prints the raw key ONCE. Loads Supabase creds from .env.local.
 */
import { readFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

// ── args ──
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ')]; }),
);
const brand  = args.brand;
const scopes = (args.scopes ?? 'products:read').split(',').map(s => s.trim()).filter(Boolean);
const env    = args.env ?? 'live';
const name   = args.name ?? null;
if (!brand) { console.error('Missing --brand <slug-or-uuid>'); process.exit(1); }

// ── env ──
const e = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── resolve brand storefront ──
const isUuid = /^[0-9a-f-]{36}$/i.test(brand);
const { data: sf, error: sfErr } = await db.from('brand_storefronts')
  .select('id, brand_name, slug').eq(isUuid ? 'id' : 'slug', brand).maybeSingle();
if (sfErr || !sf) { console.error('Brand storefront not found:', brand, sfErr?.message ?? ''); process.exit(1); }

// ── generate + store (hash only) ──
const raw     = `lz_${env}_` + randomBytes(24).toString('base64url');
const keyHash = createHash('sha256').update(raw).digest('hex');
const { error: insErr } = await db.from('api_keys').insert({
  key_prefix: raw.slice(0, 16), key_hash: keyHash, name,
  account_type: 'brand', account_id: sf.id, scopes, environment: env,
});
if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1); }

console.log(`\n✓ Key issued for brand "${sf.brand_name}" (${sf.slug})`);
console.log(`  scopes: ${scopes.join(', ')}  env: ${env}`);
console.log(`\n  ${raw}\n`);
console.log('  Store it now — it cannot be retrieved again.\n');
