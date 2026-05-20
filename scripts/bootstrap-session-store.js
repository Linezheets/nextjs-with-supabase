/**
 * Run once to create the session_store table:
 *   node scripts/bootstrap-session-store.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

// Supabase exposes a /rest/v1/rpc endpoint — we create a pg function first,
// call it to run DDL, then drop it.
async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_session_store`, {
    method : 'POST',
    headers: {
      apikey        : SUPABASE_SERVICE,
      Authorization : `Bearer ${SUPABASE_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  return res;
}

async function run() {
  // Step 1: create the helper function via the pg REST approach
  // Supabase doesn't allow raw DDL via REST — use the management API
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

  const ddl = `
    create table if not exists public.session_store (
      id         uuid        primary key default gen_random_uuid(),
      session_id text        not null,
      type       text        not null check (type in ('cart','saved','offer')),
      data       jsonb       not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default (now() + interval '30 days')
    );
    create index if not exists session_store_session_type on public.session_store (session_id, type);
    alter table public.session_store enable row level security;
    drop policy if exists "owner access" on public.session_store;
    create policy "owner access" on public.session_store
      using  (session_id = coalesce(auth.uid()::text, session_id))
      with check (session_id = coalesce(auth.uid()::text, session_id));
  `;

  console.log('Creating session_store table via Supabase management API...\n');

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Management API requires a personal access token, not service key
      // Get yours from: https://supabase.com/dashboard/account/tokens
      'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`,
    },
    body: JSON.stringify({ query: ddl }),
  });

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('─────────────────────────────────────────────────────────');
    console.log('No SUPABASE_ACCESS_TOKEN found.');
    console.log('');
    console.log('Option A — Paste this SQL into the Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/xvoemjakdsihgzfddtjx/editor');
    console.log('');
    console.log(ddl);
    console.log('─────────────────────────────────────────────────────────');
    console.log('Option B — Add SUPABASE_ACCESS_TOKEN=<your-token> to backend/.env');
    console.log('  Get token at: https://supabase.com/dashboard/account/tokens');
    console.log('  Then re-run: node scripts/bootstrap-session-store.js');
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed:', data);
    return;
  }
  console.log('✅  session_store table created successfully.');
}

run().catch(console.error);
