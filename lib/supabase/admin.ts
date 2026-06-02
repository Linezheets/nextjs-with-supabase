// lib/supabase/admin.ts
// Server-side Supabase client that bypasses RLS.
// Lazy-initialised so the module can be imported without crashing when
// SUPABASE_SERVICE_ROLE_KEY is not set in local dev.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let _admin: ReturnType<typeof createClient<Database>> | null = null;

function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role environment variables.');
  _admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Proxy — safe to import anywhere; only instantiates on first method call.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop) {
    return (getAdmin() as never)[prop as keyof ReturnType<typeof createClient<Database>>];
  },
});
