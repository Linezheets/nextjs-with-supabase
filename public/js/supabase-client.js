/**
 * Shared Supabase client.
 * Import this once per page — do NOT call createClient elsewhere.
 *
 * In Vercel: set these two vars in Project → Settings → Environment Variables
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * For local dev: create public/js/env.js (git-ignored) that sets
 *   window.__SUPABASE_URL and window.__SUPABASE_ANON_KEY
 * OR just hardcode the values below during dev.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = window.__SUPABASE_URL      ?? '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY ?? '__SUPABASE_ANON_KEY__';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession : true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // handles OAuth + magic link callbacks
  }
});

/** Returns the current session user, or null. */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Returns the buyer or brand profile attached to the current user. */
export async function getProfile(user) {
  if (!user) return null;
  const role = user.user_metadata?.role;
  if (role === 'brand') {
    const { data } = await supabase
      .from('brands')
      .select('*, brand_stores(*)')
      .eq('user_id', user.id)
      .single();
    return data;
  }
  if (role === 'buyer') {
    const { data } = await supabase
      .from('buyers')
      .select('*')
      .eq('user_id', user.id)
      .single();
    return data;
  }
  return null;
}

/** Redirect to /login if no active session. */
export async function requireAuth(redirectTo = '/login') {
  const user = await getUser();
  if (!user) window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`;
  return user;
}
