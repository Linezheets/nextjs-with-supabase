/**
 * Creates a pre-approved demo buyer account for investor/friend demos.
 * Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-demo-account.mjs
 */

const SUPABASE_URL = 'https://xvoemjakdsihgzfddtjx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const DEMO_EMAIL    = 'demo@linezheets.com';
const DEMO_PASSWORD = 'DemoAccess2025!';

async function adminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log('Setting up demo account…\n');

  // 1. Create auth user (no role in user_metadata to avoid buyer/brand triggers)
  console.log('1. Creating auth user…');
  let userId;
  const createRes = await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      // Omit role from user_metadata so triggers don't fire
      user_metadata: { full_name: 'Demo Buyer' },
    }),
  });

  if (createRes.ok) {
    userId = createRes.body.id;
    console.log(`   ✓ Created auth user: ${userId}`);
  } else if (createRes.body?.msg?.includes('already been registered') || createRes.body?.code === 422) {
    // User exists — find by listing
    const listRes = await adminFetch(`/auth/v1/admin/users?page=1&per_page=100`);
    const existing = listRes.body?.users?.find(u => u.email === DEMO_EMAIL);
    if (!existing) {
      console.error('Create failed and could not find existing user:', JSON.stringify(createRes.body));
      process.exit(1);
    }
    userId = existing.id;
    // Refresh password
    await adminFetch(`/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ password: DEMO_PASSWORD, email_confirm: true }),
    });
    console.log(`   ✓ Auth user already exists: ${userId}`);
  } else {
    console.error('Failed to create user:', JSON.stringify(createRes.body));
    process.exit(1);
  }

  // 2. Upsert buyers row directly (trigger was bypassed above)
  console.log('2. Upserting buyers record…');
  const buyerRes = await adminFetch('/rest/v1/buyers?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      auth_user_id: userId,
      email: DEMO_EMAIL,
      store_name: 'Demo Showroom',
      password_hash: '',
      temp_password: false,
      status: 'approved',
      first_name: 'Demo',
      last_name: 'Buyer',
      store_type: 'Multi-brand Boutique',
      categories_sold: ['Ready-to-Wear', 'Accessories', 'Footwear'],
      price_range_min: 200,
      price_range_max: 2000,
      market_segment: 'Luxury',
      annual_buy_budget: 500000,
      city: 'Paris',
      country: 'FR',
    }),
  });

  if (buyerRes.ok) {
    console.log('   ✓ Buyers record upserted');
  } else {
    console.warn('   ⚠ Buyers upsert issue:', JSON.stringify(buyerRes.body));
    // Not fatal — the auth user was created
  }

  // 3. Update app_metadata so dashboard sees role='buyer'
  console.log('3. Setting role in app_metadata…');
  const roleRes = await adminFetch(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ app_metadata: { role: 'buyer' } }),
  });
  console.log(roleRes.ok ? '   ✓ Role set' : '   ⚠ Role update failed: ' + JSON.stringify(roleRes.body));

  console.log('\n✅ Demo account ready!\n');
  console.log('  URL:      https://linezheets.com/login');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log('\nThe "Try Demo" button on the login page will log in automatically.');
}

main().catch(err => { console.error(err); process.exit(1); });
