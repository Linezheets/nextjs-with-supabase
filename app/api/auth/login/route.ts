import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { sendEmail, loginNotificationHtml } from '@/lib/email';
import { checkRateLimit, getClientIp }      from '@/lib/rate-limit';
import { stampPrivSession, resolvePrivRole } from '@/lib/supabase/priv-session';
import { logActivity }                      from '@/lib/audit';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

export async function POST(req: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip        = getClientIp(req);
  const ipResult  = checkRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipResult.allowed) {
    logActivity({
      role: 'anonymous', action: 'login_rate_limited', status: 'blocked',
      detail: `IP rate limit hit`, ip,
    }, req);
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipResult.resetMs / 1000)) } }
    );
  }

  let body: { email?: string; password?: string; redirect?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { email, password, redirect: redirectTo } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const emailKey    = email.toLowerCase().trim();
  const emailResult = checkRateLimit(`login:email:${emailKey}`, 5, 15 * 60 * 1000);
  if (!emailResult.allowed) {
    logActivity({
      email, role: 'anonymous', action: 'login_rate_limited', status: 'blocked',
      detail: `Account rate limit hit for ${email}`, ip,
    }, req);
    return NextResponse.json(
      { error: 'Too many login attempts for this account. Please wait a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(emailResult.resetMs / 1000)) } }
    );
  }

  const supabase = await createClient();
  const { error, data: signInData } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log failed login attempt with full context
    logActivity({
      email, role: 'anonymous', action: 'login_failed', status: 'failure',
      detail: error.message, ip,
      metadata: { error_code: error.status },
    }, req);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const user     = signInData.user;
  const userRole = user?.user_metadata?.role ?? user?.app_metadata?.role;
  const privRole = resolvePrivRole(email, userRole as string | null | undefined);

  // Log successful login
  logActivity({
    user_id: user?.id, email, role: (privRole ?? 'buyer') as 'admin' | 'brand' | 'buyer',
    action: 'login', status: 'success',
    detail: `${privRole ?? 'buyer'} login`,
    ip,
    metadata: { priv_role: privRole, via: 'password' },
  }, req);

  const ipDisplay = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;
  const time = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short',
  }) + ' HKT';

  sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[Linezheets] Buyer login — ${email}`,
    html: loginNotificationHtml({ email, time, ip: ipDisplay }),
    text: `Buyer login: ${email} at ${time}${ipDisplay ? ` from ${ipDisplay}` : ''}`,
  }).catch((err: unknown) => console.error('[notify] login email failed:', err));

  const safeRedirect = (raw?: string) => {
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('://')) return raw;
    return '/dashboard';
  };

  const res = NextResponse.json({ redirect: safeRedirect(redirectTo) });

  if (privRole) {
    stampPrivSession(res.cookies, privRole);
    logActivity({
      user_id: user?.id, email, role: privRole,
      action: 'priv_session_start', status: 'success',
      detail: `${privRole} privileged session started`,
      ip, metadata: { priv_role: privRole },
    }, req);
  }

  return res;
}
