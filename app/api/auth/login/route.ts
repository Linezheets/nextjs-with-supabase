import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, loginNotificationHtml } from '@/lib/email';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

export async function POST(req: NextRequest) {
  const { email, password, redirect: redirectTo } = await req.json();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;
  const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }) + ' HKT';

  sendEmail({
    to     : NOTIFY_EMAIL,
    subject: `[Linezheets] Buyer login — ${email}`,
    html   : loginNotificationHtml({ email, time, ip }),
    text   : `Buyer login: ${email} at ${time}${ip ? ` from ${ip}` : ''}`,
  }).catch((err: unknown) => console.error('[notify] login email failed:', err));

  return NextResponse.json({ redirect: redirectTo ?? '/dashboard' });
}
