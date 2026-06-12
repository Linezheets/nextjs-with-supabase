import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, loginNotificationHtml } from '@/lib/email';
import { stampPrivSession, resolvePrivRole } from '@/lib/supabase/priv-session';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

export async function POST(req: NextRequest) {
  const { email, password, redirect: redirectTo, captchaToken } = await req.json();
  const supabase = await createClient();

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;
  const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }) + ' HKT';

  sendEmail({
    to     : NOTIFY_EMAIL,
    subject: `[Linezheets] Buyer login — ${email}`,
    html   : loginNotificationHtml({ email, time, ip }),
    text   : `Buyer login: ${email} at ${time}${ip ? ` from ${ip}` : ''}`,
  }).catch((err: unknown) => console.error('[notify] login email failed:', err));

  const res = NextResponse.json({ redirect: redirectTo ?? '/dashboard' });

  // Stamp privileged-session timebox cookies for admin / brand accounts.
  // Without this, requireAdmin() → checkPrivSession() returns no_session → 401.
  const user = signInData?.user;
  if (user) {
    const privRole = resolvePrivRole(user.email, user.user_metadata?.role ?? user.app_metadata?.role);
    if (privRole) stampPrivSession(res.cookies, privRole);
  }

  return res;
}
