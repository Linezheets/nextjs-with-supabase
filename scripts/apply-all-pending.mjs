/**
 * Applies all pending migrations (post-consolidated) to Supabase production.
 * Run: node scripts/apply-all-pending.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, '..', 'supabase', 'migrations');

const PAT = process.env.SUPABASE_PAT;
const PROJECT_REF = 'xvoemjakdsihgzfddtjx';

if (!PAT) { console.error('Missing SUPABASE_PAT'); process.exit(1); }

// All migrations after the consolidated schema, in order
const PENDING = [
  '20260519_session_store.sql',
  '20260531_chat_widget.sql',
  '20260601_payments.sql',
  '20260602_db_audit_trail.sql',
  '20260602_db_audit_trail_auth_uid.sql',
  '20260602_audit_log_geo_columns.sql',
  '20260602_platform_audit_log.sql',
  '20260602_brand_auth_signup.sql',
  '20260602_buyer_auth_signup.sql',
  '20260602_rls_fixes.sql',
  '20260602_get_brand_sell_through.sql',
  '20260602_events_and_views.sql',
  '20260604_brand_commission.sql',
  '20260604_integration_configs_rls.sql',
  '20260605_disputes.sql',
  '20260605_escrow.sql',
  '20260605_multi_currency.sql',
  '20260605_tax_data.sql',
  '20260606_rls_and_policy_gaps.sql',
];

async function runSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

async function main() {
  console.log(`Applying ${PENDING.length} pending migrations...\n`);

  for (const file of PENDING) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  ${file}… `);
    const { ok, body } = await runSQL(sql);
    if (ok) {
      console.log('✓');
    } else {
      const msg = body?.message ?? body?.error ?? JSON.stringify(body);
      // Many are idempotent — warn but continue
      if (msg?.includes('already exists') || msg?.includes('duplicate')) {
        console.log(`⚠ already applied (${msg.slice(0, 80)})`);
      } else {
        console.log(`✗ ERROR: ${msg?.slice(0, 120)}`);
      }
    }
  }

  console.log('\nDone. Now creating buyers row for demo user...');

  const USER_ID = '0693cd2b-a26b-4cba-bf5e-46bb764ddf31';
  const { ok, body } = await runSQL(`
    INSERT INTO public.buyers (
      auth_user_id, email, store_name, password_hash, temp_password, status,
      first_name, last_name, store_type, categories_sold,
      price_range_min, price_range_max, market_segment, city, country
    ) VALUES (
      '${USER_ID}', 'demo@linezheets.com', 'Demo Showroom', '', false, 'approved',
      'Demo', 'Buyer', 'Multi-brand Boutique',
      ARRAY['Ready-to-Wear','Accessories','Footwear'],
      200, 2000, 'Luxury', 'Paris', 'FR'
    )
    ON CONFLICT (email) DO UPDATE
      SET auth_user_id = EXCLUDED.auth_user_id,
          status       = 'approved',
          store_name   = EXCLUDED.store_name,
          updated_at   = NOW();
  `);

  console.log(ok ? '✓ Demo buyers row upserted' : `✗ buyers upsert: ${JSON.stringify(body)?.slice(0, 120)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
