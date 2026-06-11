import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js only runs a root file literally named `middleware.ts` exporting `middleware`.
// This logic previously lived in proxy.ts, which never executed because of the name —
// so neither of the two jobs below was happening in production.
//
//  1. Host isolation — api.linezheets.com (and the Railway *.up.railway.app host) serve
//     ONLY the public /v1 API plus the Railway health check; everything else 404s. The
//     web app, dashboard, auth UI and internal /api routes are never served there.
//  2. Supabase session refresh (lib/supabase/proxy.ts:updateSession) on web hosts, which
//     keeps auth cookies in sync on every request. Without it, server components consume
//     refresh tokens they can't persist, so later route handlers see no session (401) —
//     which caused both the OAuth login bounce and the silent "Save Store" failure.

function notFoundJson() {
  return NextResponse.json({ error: { type: 'not_found', message: 'Not found' } }, { status: 404 });
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const path = request.nextUrl.pathname;

  // api.linezheets.com (and the Railway backend) host ONLY the public /v1 API.
  const isApiHost = host.startsWith('api.') || host.endsWith('.up.railway.app');
  if (isApiHost) {
    if (path.startsWith('/v1/') || path === '/api/health') return NextResponse.next();
    return notFoundJson();
  }

  // Web hosts (www, *.vercel.app, root domain): the public API is api-host only.
  // localhost is allowed through so /v1 can be tested in local dev.
  if (path.startsWith('/v1/')) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (!isLocal) return notFoundJson();
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
