import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  checkPrivSession,
  refreshPrivActivity,
  clearPrivSession,
  resolvePrivRole,
  timeoutMessage,
} from './priv-session';
import { logActivity } from '@/lib/audit';

// Routes that require a privileged (admin or brand) session timebox check
const ADMIN_PATHS  = ['/dashboard/admin', '/api/admin'];
const BRAND_PATHS  = ['/dashboard/brand-store', '/api/brand', '/api/brand-store',
                      '/api/inventory', '/api/linesheets', '/api/products'];

export async function updateSession(request: NextRequest) {
  // ── Custom domain routing ────────────────────────────────────────────────
  const host = request.headers.get('host') ?? '';
  const ownHosts = [
    'localhost',
    'linezheets.com',
    'www.linezheets.com',
    'linezheets.vercel.app',
    'linezheets.up.railway.app',
    '.railway.app',
  ];
  const isOwnHost = ownHosts.some(h =>
    host === h ||
    host.startsWith(`${h}:`) ||
    (h.startsWith('.') && (host.endsWith(h) || host.includes(h)))
  );

  if (!isOwnHost && !request.nextUrl.pathname.startsWith('/_next') && !request.nextUrl.pathname.startsWith('/api')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/buyer_storefronts?custom_domain=eq.${encodeURIComponent(host)}&published=eq.true&select=slug&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const rows = await lookupRes.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]?.slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/store/${rows[0].slug}${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
    const brandLookupRes = await fetch(
      `${supabaseUrl}/rest/v1/brand_storefronts?custom_domain=eq.${encodeURIComponent(host)}&published=eq.true&select=slug&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const brandRows = await brandLookupRes.json().catch(() => []);
    if (Array.isArray(brandRows) && brandRows[0]?.slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/brand/${brandRows[0].slug}${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // ── 1. Unauthenticated: redirect protected pages to login ────────────────
  const protectedPaths = ['/dashboard', '/inquiries', '/checkout', '/onboard'];
  const isProtected    = protectedPaths.some(p => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // ── 2. MFA challenge check ───────────────────────────────────────────────
  if (user && isProtected) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
      const url = request.nextUrl.clone();
      url.pathname = '/mfa';
      url.searchParams.set('redirect', path);
      return NextResponse.redirect(url);
    }
  }

  // ── 3. Privileged session timebox ────────────────────────────────────────
  // Admin paths: 30 min absolute / 15 min inactivity
  // Brand paths: 2 h absolute  / 30 min inactivity
  if (user) {
    const isAdminPath = ADMIN_PATHS.some(p => path.startsWith(p));
    const isBrandPath = BRAND_PATHS.some(p => path.startsWith(p));

    const privRole = isAdminPath
      ? 'admin'
      : isBrandPath
        ? resolvePrivRole(user.email, user.user_metadata?.role ?? user.app_metadata?.role)
        : null;

    if (privRole) {
      const check = checkPrivSession(request, privRole);

      if (!check.valid) {
        // Log the timeout event before destroying the session
        logActivity({
          user_id: user.id, email: user.email,
          role: privRole,
          action: 'priv_session_timeout', status: 'blocked',
          detail: `${privRole} session expired: ${check.reason}`,
          metadata: { reason: check.reason, path },
        }, request);

        await supabase.auth.signOut();

        const isApiPath = path.startsWith('/api/');

        if (isApiPath) {
          // API callers get a JSON 401 with the reason
          const res = NextResponse.json(
            { error: 'Session expired', reason: check.reason },
            { status: 401 }
          );
          clearPrivSession(res.cookies);
          return res;
        }

        // Page navigation — redirect to login with a clear message
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('redirect', path);
        loginUrl.searchParams.set('msg', timeoutMessage(check.reason));
        const redirect = NextResponse.redirect(loginUrl);
        clearPrivSession(redirect.cookies);
        return redirect;
      }

      // Session is valid — refresh the activity timestamp
      refreshPrivActivity(request, supabaseResponse.cookies, privRole);
    }
  }

  // ── 4. Redirect logged-in users away from auth pages ─────────────────────
  if (user && ['/login', '/join', '/register'].includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
