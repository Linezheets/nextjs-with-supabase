import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkPrivSession, resolvePrivRole, timeoutMessage } from './priv-session';
import { logActivity } from '@/lib/audit';
import { setAuditUser } from './set-audit-user';

// Driven by env so adding/removing admins doesn't require a code deploy.
// ADMIN_EMAILS is a comma-separated list: "hello@linezheets.com,info@mxlla.com"
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'hello@linezheets.com,info@mxlla.com')
  .split(',').map(e => e.trim()).filter(Boolean);

/**
 * Verify the request comes from an authenticated admin user WITH an active
 * privileged session timebox (≤ 30 min old, ≤ 15 min inactive).
 *
 * All access_denied and session_timeout events are automatically audit-logged.
 *
 * Returns { ok: true, user } or { ok: false, response }.
 */
export async function requireAdmin(req?: NextRequest): Promise<
  | { ok: true;  user: { id: string; email?: string } }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    logActivity({
      role: 'anonymous', action: 'access_denied', status: 'blocked',
      detail: 'Unauthenticated admin route access',
      resource: req?.nextUrl?.pathname,
    }, req);
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!ADMIN_EMAILS.includes(user.email ?? '')) {
    logActivity({
      user_id: user.id, email: user.email,
      role: (user.user_metadata?.role ?? 'buyer') as 'admin' | 'brand' | 'buyer',
      action: 'access_denied', status: 'blocked',
      detail: `Non-admin attempted admin route: ${req?.nextUrl?.pathname}`,
      resource: req?.nextUrl?.pathname,
    }, req);
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (req) {
    const privRole = resolvePrivRole(user.email, 'admin');
    if (privRole) {
      const check = checkPrivSession(req, privRole);
      if (!check.valid) {
        logActivity({
          user_id: user.id, email: user.email,
          role: 'admin',
          action: 'priv_session_timeout', status: 'blocked',
          detail: `Admin session expired at API layer: ${check.reason}`,
          resource: req.nextUrl?.pathname,
          metadata: { reason: check.reason },
        }, req);
        await supabase.auth.signOut();
        return {
          ok      : false,
          response: NextResponse.json(
            { error: timeoutMessage(check.reason), reason: check.reason },
            { status: 401 }
          ),
        };
      }
    }
  }

  // Stamp app.user_id + app.user_role into the DB session so the
  // db_audit_trail trigger records the real admin UUID, not 'postgres'.
  await setAuditUser(supabase, user as import('@supabase/supabase-js').User);

  return { ok: true, user };
}
