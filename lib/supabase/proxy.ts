import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the user session on every request so it never silently expires.
// Add to middleware.ts at the project root.
export async function updateSession(request: NextRequest) {
  // ── Custom domain routing ────────────────────────────────────────────────
  // If the request comes from a custom domain (not our own host), rewrite it
  // to the corresponding /store/[slug] route.
  const host = request.headers.get('host') ?? '';
  const ownHosts = [
    'localhost',
    'linezheets.com',
    'www.linezheets.com',
    'linezheets.vercel.app',
    'linezheets.up.railway.app',
    // Allow any Railway preview domains
    '.railway.app',
  ];
  const isOwnHost = ownHosts.some(h =>
    host === h ||
    host.startsWith(`${h}:`) ||    // localhost:3001 style
    (h.startsWith('.') && (host.endsWith(h) || host.includes(h)))  // .railway.app wildcard
  );

  if (!isOwnHost && !request.nextUrl.pathname.startsWith('/_next') && !request.nextUrl.pathname.startsWith('/api')) {
    // Look up the storefront by custom_domain
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

    // Also check brand_storefronts
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

  // Protect authenticated-only routes
  const protectedPaths = ['/dashboard', '/inquiries', '/checkout', '/onboard'];
  const isProtected    = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If user is logged in but hasn't completed MFA challenge, redirect to /mfa
  if (user && isProtected) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
      const url = request.nextUrl.clone();
      url.pathname = '/mfa';
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  // Redirect already-logged-in users away from auth pages
  if (user && ['/login', '/join', '/register'].includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
