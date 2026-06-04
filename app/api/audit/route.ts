/**
 * GET /api/audit — admin-only activity log query endpoint.
 *
 * Query parameters:
 *   user_id        filter by user UUID
 *   email          filter by email (partial match)
 *   role           admin | brand | buyer | anonymous | system
 *   action         exact action string
 *   status         success | failure | blocked | error
 *   ip             exact IP address
 *   country        2-letter country code (e.g. HK, US, FR)
 *   device_type    desktop | mobile | tablet
 *   from           ISO date string (inclusive)
 *   to             ISO date string (inclusive)
 *   priv_role      admin | brand (only privileged session events)
 *   limit          1–200 (default 50)
 *   offset         pagination offset (default 0)
 *   format         json (default) | csv
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin }              from '@/lib/supabase/requireAdmin';
import { createAdminClient }         from '@/lib/supabase/server';
import { logActivity }               from '@/lib/audit';

export async function GET(req: NextRequest) {
  // ── Admin gate ────────────────────────────────────────────────────────────
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const db = createAdminClient();
  const sp = req.nextUrl.searchParams;

  // ── Parse params ──────────────────────────────────────────────────────────
  const user_id   = sp.get('user_id');
  const email     = sp.get('email');
  const role      = sp.get('role');
  const action    = sp.get('action');
  const status    = sp.get('status');
  const ip        = sp.get('ip');
  const country   = sp.get('country');
  const device    = sp.get('device_type');
  const from      = sp.get('from');
  const to        = sp.get('to');
  const privRole  = sp.get('priv_role');
  const limit     = Math.min(Math.max(1, parseInt(sp.get('limit')  ?? '50')),  200);
  const offset    = Math.max(0, parseInt(sp.get('offset') ?? '0'));
  const format    = sp.get('format') ?? 'json';

  // ── Build query ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db as any)
    .from('platform_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (user_id)    q = q.eq('user_id', user_id);
  if (email)      q = q.ilike('email', `%${email}%`);
  if (role)       q = q.eq('role', role);
  if (action)     q = q.eq('action', action);
  if (status)     q = q.eq('status', status);
  if (ip)         q = q.eq('ip', ip);
  if (country)    q = q.eq('country', country.toUpperCase());
  if (device)     q = q.eq('device_type', device);
  if (privRole)   q = q.eq('priv_role', privRole);
  if (from)       q = q.gte('created_at', from);
  if (to) {
    // 'to' is inclusive — add 1 day if it looks like a date-only string
    const toCap = to.includes('T') ? to : `${to}T23:59:59.999Z`;
    q = q.lte('created_at', toCap);
  }

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log this admin access itself (meta audit)
  logActivity({
    user_id : guard.user.id,
    email   : guard.user.email,
    role    : 'admin',
    action  : 'admin_view_stats',   // reuse closest existing action
    resource: 'platform_audit_log',
    status  : 'success',
    detail  : `Audit log query: ${JSON.stringify(Object.fromEntries(sp.entries()))}`,
  }, req);

  // ── CSV export ─────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const rows = data ?? [];
    if (!rows.length) {
      return new NextResponse('No data', {
        status : 200,
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit.csv"' },
      });
    }

    const cols = Object.keys(rows[0]) as string[];
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n\r]/.test(s) ? `"${s}"` : s;
    };

    const header = cols.join(',');
    const lines  = rows.map((r: Record<string, unknown>) => cols.map(c => escape(r[c])).join(','));
    const csv    = [header, ...lines].join('\n');

    return new NextResponse(csv, {
      status : 200,
      headers: {
        'Content-Type'       : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ── JSON response ─────────────────────────────────────────────────────────
  return NextResponse.json({
    logs  : data ?? [],
    total : count ?? 0,
    offset,
    limit,
  });
}
