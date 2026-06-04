import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────
  // 3 reset requests per IP per 30 minutes — prevents email spam bombs.
  const ip     = getClientIp(req);
  const result = checkRateLimit(`forgot:ip:${ip}`, 3, 30 * 60 * 1000);
  if (!result.allowed) {
    // Still return 200 so we don't leak timing information, but don't send.
    return NextResponse.json({ ok: true });
  }

  let body: { email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { email } = body;
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const supabase = await createClient();
  // Fire-and-forget — never reveal whether the email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://linezheets.com'}/auth/callback?next=/auth/reset-password`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
