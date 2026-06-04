'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * NavBarAuth — client component rendering auth-aware links
 * in the top-right of the public landing navbar.
 */
export function NavBarAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const cls = 'text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity';
  const s = { color: '#888', fontFamily: 'system-ui, sans-serif' };

  if (loggedIn === null) return null;

  if (loggedIn) {
    return (
      <>
        <a href="/dashboard" className={cls} style={s}>Dashboard</a>
        <SignOutButton />
      </>
    );
  }

  return (
    <>
      <a href="/login" className={cls} style={s}>Log in</a>
      <a href="/join" className={cls} style={{ ...s, color: '#c9a84c' }}>Join</a>
    </>
  );
}

function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
      style={{ color: '#888', fontFamily: 'system-ui, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      Sign out
    </button>
  );
}
