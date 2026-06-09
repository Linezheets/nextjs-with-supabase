import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
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
    console.error('[auth/callback] provider error:', error, errorDesc);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', errorDesc ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) return NextResponse.redirect(new URL('/login', origin));

  // ── Cookie plumbing ──────────────────────────────────────────────────────
  // The session cookies Supabase issues during the code exchange MUST be
  // written onto the redirect response we return — otherwise (on Next 16) the
  // browser never receives them and every later request looks logged-out,
  // bouncing back to /login. We capture them here and replay them onto whatever
  // final response this handler returns.
  const cookieStore = await cookies();
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => {
            // Keep the request-local store in sync so the getUser() below sees
            // the freshly-exchanged session...
            try { cookieStore.set(name, value, options); } catch { /* read-only in some contexts */ }
            // ...and stash it to apply to the outgoing redirect.
            pendingCookies.push({ name, value, options: options ?? {} });
          });
        },
      },
    }
  );

  // Helper: build a redirect that carries the session cookies with it.
  const redirectWithSession = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[auth/callback] exchange failed:', exchangeError.message);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  if (next === '/auth/reset-password') {
    return redirectWithSession(next);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const userRole = user.user_metadata?.role ?? user.app_metadata?.role;
    const privRole = resolvePrivRole(user.email, userRole as string | null | undefined);

    // ── New-user check ──────────────────────────────────────────────────────
    // Skip for admins — they never have a buyer profile and should go straight
    // to /dashboard. Only run for regular buyers and brand users.
    if (!privRole) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let buyer = (await db.from('buyers').select('id, first_name').eq('id', user.id).maybeSingle()).data;
      if (!buyer) {
        buyer = (await db.from('buyers').select('id, first_name').eq('auth_user_id', user.id).maybeSingle()).data;
      }
      if (!buyer || !buyer.first_name) {
        return redirectWithSession('/onboard');
      }
    }

    // ── Privileged session stamp ────────────────────────────────────────────
    // Admin / brand accounts get a priv-session timebox cookie at login.
    const redirectRes = redirectWithSession(next);
    if (privRole) {
      stampPrivSession(redirectRes.cookies, privRole);
    }
    return redirectRes;
  }

  return redirectWithSession(next);
}
