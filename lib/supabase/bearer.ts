import { createClient as createAnonClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createCookieClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

/**
 * Decode the `aal` claim from a Supabase JWT without a network round-trip.
 * Supabase JWTs are standard HS256 — the payload is safe to read client-side
 * because we verify authenticity via supabase.auth.getUser() separately.
 */
function jwtAal(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    );
    return (payload as { aal?: string }).aal ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the current user from either:
 *  1. A Supabase session cookie  (standard Next.js pages / dashboard)
 *  2. An Authorization: Bearer <jwt> header (buyer-shop.html static page)
 *
 * MFA enforcement (both paths):
 *  - If the user has MFA enrolled (nextLevel === 'aal2') but the session/token
 *    is only AAL1, we return { user: null } — treated as unauthenticated.
 *  - Bearer path: AAL is read directly from the JWT `aal` claim (no extra
 *    network call), then validated against the user's enrolled factors via
 *    getAuthenticatorAssuranceLevel() on the anon client.
 *
 * Returns { user, supabase } — user is null when unauthenticated or AAL insufficient.
 */
export async function getUserFromRequest(req: NextRequest): Promise<{
  user    : import('@supabase/supabase-js').User | null;
  supabase: AnySupabase;
}> {
  const authHeader  = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    // ── Bearer path ──────────────────────────────────────────────────────────
    // Create a stateless anon client. Passing the token to getUser() validates
    // the signature and expiry server-side via Supabase Auth.
    const supabase = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);

    if (error || !user) {
      // Invalid / expired token — fall through to cookie path
    } else {
      // ── MFA check for bearer tokens ─────────────────────────────────────
      // Read AAL from the JWT payload directly (no extra network call).
      // If the user has MFA enrolled but this token is only AAL1, reject.
      const tokenAal = jwtAal(bearerToken);

      if (tokenAal !== 'aal2') {
        // Check whether this user actually has MFA enrolled
        // (only then should we enforce AAL2 — unenrolled users stay AAL1).
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === 'aal2') {
          // Enrolled but token is not AAL2 — reject the request.
          return { user: null, supabase };
        }
      }

      return { user, supabase };
    }
  }

  // ── Cookie path ─────────────────────────────────────────────────────────
  const supabase = await createCookieClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, supabase };

  // ── MFA AAL check for cookie sessions ───────────────────────────────────
  // Reject sessions where MFA is enrolled but TOTP has not been verified
  // this session. This prevents AAL1 cookie sessions from hitting API routes.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
    return { user: null, supabase };
  }

  return { user, supabase };
}
