/**
 * Test: Supabase auth trigger coverage for /register
 *
 * Verifies that signing up as buyer OR brand via supabase.auth.signUp()
 * causes the correct DB rows to be created by the trigger(s).
 *
 * Run: node scripts/test-auth-triggers.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TS       = Date.now();
const BUYER_EMAIL  = `test-buyer-${TS}@trigger-test.invalid`;
const BRAND_EMAIL  = `test-brand-${TS}@trigger-test.invalid`;
const PASSWORD     = 'Test1234!';

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  pass++;
}
function err(label, detail) {
  console.log(`  ❌  ${label}`);
  if (detail) console.log(`       ${detail}`);
  fail++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ───────────────────────────────── helpers ──────────────────────────────── */

async function createAuthUser(email, metadata) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,          // skip email confirmation for test
    user_metadata: metadata,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user;
}

async function deleteAuthUser(id) {
  await admin.auth.admin.deleteUser(id);
}

/* ─────────────────────────────── test runner ────────────────────────────── */

async function runTests() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Linezheets — Auth Trigger Test Suite');
  console.log('══════════════════════════════════════════\n');

  const cleanupIds = [];

  /* ── TEST 1: Buyer trigger ──────────────────────────────────────────────── */
  console.log('▶  Test 1 — buyer signup creates public.buyers row');
  let buyerAuthId;
  try {
    const user = await createAuthUser(BUYER_EMAIL, {
      role        : 'buyer',
      first_name  : 'Trigger',
      last_name   : 'Test',
      company_name: 'Test Boutique',
      phone       : '+1 555 0000',
    });
    buyerAuthId = user.id;
    cleanupIds.push({ id: user.id, role: 'buyer' });

    // Trigger fires synchronously (AFTER INSERT) — give it a moment just in case
    await sleep(300);

    const { data: buyerRow, error: buyerErr } = await admin
      .from('buyers')
      .select('id, auth_user_id, email, store_name, first_name, last_name, phone, status, registered_by')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (buyerErr) { err('buyers row — query error', buyerErr.message); }
    else if (!buyerRow) { err('buyers row — not created (trigger missing or failed)'); }
    else {
      ok(`buyers row created (id: ${buyerRow.id})`);
      buyerRow.email === BUYER_EMAIL        ? ok('email matches')          : err('email mismatch',          `got ${buyerRow.email}`);
      buyerRow.store_name                   ? ok(`store_name: "${buyerRow.store_name}"`) : err('store_name empty');
      buyerRow.first_name === 'Trigger'     ? ok('first_name propagated')  : err('first_name wrong',        `got ${buyerRow.first_name}`);
      buyerRow.last_name  === 'Test'        ? ok('last_name propagated')   : err('last_name wrong',         `got ${buyerRow.last_name}`);
      buyerRow.phone                        ? ok('phone propagated')        : err('phone missing');
      buyerRow.status === 'active'          ? ok('status = active')        : err('status wrong',            `got ${buyerRow.status}`);
      buyerRow.registered_by === 'self'     ? ok('registered_by = self')   : err('registered_by wrong',    `got ${buyerRow.registered_by}`);
    }
  } catch (e) {
    err('buyer signup threw', e.message);
  }

  console.log('');

  /* ── TEST 2: Brand trigger ──────────────────────────────────────────────── */
  console.log('▶  Test 2 — brand signup creates public.brand_storefronts row');
  try {
    const user = await createAuthUser(BRAND_EMAIL, {
      role        : 'brand',
      first_name  : 'Brand',
      last_name   : 'Tester',
      company_name: 'Test Maison',
      phone       : '+1 555 0001',
      plan        : 'studio',
    });
    cleanupIds.push({ id: user.id, role: 'brand' });

    await sleep(300);

    const { data: sfRow, error: sfErr } = await admin
      .from('brand_storefronts')
      .select('id, user_id, brand_name, slug, contact_email, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sfErr) { err('brand_storefronts row — query error', sfErr.message); }
    else if (!sfRow) { err('brand_storefronts row — NOT created (trigger missing!)'); }
    else {
      ok(`brand_storefronts row created (id: ${sfRow.id})`);
      sfRow.brand_name                  ? ok(`brand_name: "${sfRow.brand_name}"`) : err('brand_name empty');
      sfRow.slug                        ? ok(`slug: "${sfRow.slug}"`)             : err('slug empty');
      sfRow.contact_email === BRAND_EMAIL ? ok('contact_email matches')            : err('contact_email wrong', `got ${sfRow.contact_email}`);
      sfRow.plan === 'studio'           ? ok('plan propagated')                   : err('plan not stored',     `got ${sfRow.plan}`);
    }
  } catch (e) {
    err('brand signup threw', e.message);
  }

  console.log('');

  /* ── TEST 3: Conflict handling — duplicate email ─────────────────────────── */
  console.log('▶  Test 3 — re-signup with existing buyer email (conflict)');
  if (buyerAuthId) {
    // Delete the auth user but keep the buyers row, then re-sign up with same email
    await deleteAuthUser(buyerAuthId);
    cleanupIds.splice(cleanupIds.findIndex(x => x.id === buyerAuthId), 1);
    await sleep(200);

    try {
      const user2 = await createAuthUser(BUYER_EMAIL, {
        role: 'buyer', first_name: 'Updated', last_name: 'Name', company_name: 'New Boutique',
      });
      cleanupIds.push({ id: user2.id, role: 'buyer' });
      await sleep(300);

      const { data } = await admin
        .from('buyers')
        .select('id, auth_user_id, first_name')
        .eq('email', BUYER_EMAIL)
        .maybeSingle();

      if (!data) { err('buyers row disappeared after re-signup'); }
      else if (data.auth_user_id === user2.id) { ok('auth_user_id updated to new auth user'); }
      else { err('auth_user_id NOT updated', `expected ${user2.id}, got ${data.auth_user_id}`); }

      data?.first_name === 'Updated' ? ok('first_name updated via ON CONFLICT') : err('first_name not updated', `got ${data?.first_name}`);
    } catch(e) {
      err('re-signup conflict test threw', e.message);
    }
  } else {
    console.log('  ⚠️  Skipped (buyer creation failed above)');
  }

  /* ── Cleanup ────────────────────────────────────────────────────────────── */
  console.log('\n── Cleanup ──');
  for (const { id, role } of cleanupIds) {
    await deleteAuthUser(id);
    console.log(`  🗑  Deleted auth user ${id} (${role})`);
  }

  /* ── Summary ────────────────────────────────────────────────────────────── */
  console.log('\n══════════════════════════════════════════');
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log('══════════════════════════════════════════\n');

  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
