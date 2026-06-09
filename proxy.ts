import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

function notFoundJson() {
  return NextResponse.json({ error: { type: 'not_found', message: 'Not found' } }, { status: 404 });
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const path = request.nextUrl.pathname;

  // api.linezheets.com (and the Railway backend) host ONLY the public /v1 API.
  // The web app, dashboard, auth UI and internal /api routes are never served
  // there. The health check stays reachable for Railway.
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
