/**
 * Stamps the current authenticated user's ID and role into the PostgreSQL
 * session config so the db_audit_trail trigger can record `changed_by`.
 *
 * Call this ONCE at the top of any API route that mutates critical tables:
 *
 *   const { user, supabase } = await getUserFromRequest(req);
 *   if (user) await setAuditUser(supabase, user);
 *   // ... then do your INSERT / UPDATE / DELETE
 *
 * Under the hood it runs:
 *   SET LOCAL app.user_id   = '<user_uuid>';
 *   SET LOCAL app.user_role = 'admin|brand|buyer';
 *
 * SET LOCAL scopes these to the current transaction, so they never leak
 * between requests in a connection-pooled environment.
 *
 * If the RPC call fails (e.g. in tests or if the function isn't deployed)
 * it fails silently — audit trail will fall back to current_user (postgres role).
 */

import type { User } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['hello@linezheets.com', 'info@mxlla.com'];

function resolveRole(user: User): string {
  const meta = user.user_metadata?.role ?? user.app_metadata?.role;
  if (meta === 'admin' || ADMIN_EMAILS.includes(user.email ?? '')) return 'admin';
  if (meta === 'brand') return 'brand';
  return 'buyer';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setAuditUser(supabase: any, user: User): Promise<void> {
  try {
    const role = resolveRole(user);
    await supabase.rpc('fn_set_audit_user_params', {
      p_user_id  : user.id,
      p_user_role: role,
    });
  } catch {
    // Non-critical — audit trail falls back to postgres role name
  }
}
