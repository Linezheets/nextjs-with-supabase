import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createClient as createCookieClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

/**
 * Resolves the current user from either:
 *  1. A Supabase session cookie (standard Next.js pages / dashboard)
 *  2. An Authorization: Bearer <jwt> header (buyer-shop.html static page)
 *
 * Returns { user, supabase } — supabase client is pre-authenticated.
 */
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    const supabase = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
    if (!error && user) return { user, supabase };
  }

  // Fall back to cookie-based session
  const supabase = await createCookieClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user: user ?? null, supabase };
}
