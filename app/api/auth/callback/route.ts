import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { stampPrivSession, resolvePrivRole } from '@/lib/supabase/priv-session';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code      = searchParams.get('code');
  const rawNext   = searchParams.get('next') ?? '/dashboard';
  const next      = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://')
    ? rawNext : '/dashboard';
  const error     = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  if (error) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', errorDesc ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) return NextResponse.redirect(new URL('/login', origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  if (next === '/auth/reset-password') {
    return NextResponse.redirect(new URL(next, origin));
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // ── MFA check ──────────────────────────────────────────────────────────
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      const mfaUrl = new URL('/mfa', origin);
      if (next !== '/dashboard') mfaUrl.searchParams.set('redirect', next);
      return NextResponse.redirect(mfaUrl);
    }

    // ── New-user check ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let buyer = (await db.from('buyers').select('id, first_name').eq('id', user.id).maybeSingle()).data;
    if (!buyer) {
      buyer = (await db.from('buyers').select('id, first_name').eq('auth_user_id', user.id).maybeSingle()).data;
    }
    if (!buyer || !buyer.first_name) {
      return NextResponse.redirect(new URL('/onboard', origin));
    }

    // ── Privileged session stamp ────────────────────────────────────────────
    // OAuth users also get the priv timebox if they are admin or brand.
    // This redirect response carries the Set-Cookie headers.
    const userRole = user.user_metadata?.role ?? user.app_metadata?.role;
    const privRole = resolvePrivRole(user.email, userRole as string | null | undefined);
    const redirectRes = NextResponse.redirect(new URL(next, origin));
    if (privRole) {
      stampPrivSession(redirectRes.cookies, privRole);
    }
    return redirectRes;
  }

  return NextResponse.redirect(new URL(next, origin));
}
