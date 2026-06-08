'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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

  const linkCls = 'text-[8px] uppercase tracking-[0.35em] transition-colors duration-200';
  const linkStyle = { color: '#888', fontFamily: 'var(--font-mono), monospace', fontWeight: 600 };

  if (loggedIn === null) return null;

  if (loggedIn) {
    return (
      <>
        <a href="/dashboard" className={linkCls} style={linkStyle}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#c9a84c')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#888')}>Dashboard</a>
        <SignOutButton />
      </>
    );
  }

  return (
    <>
      <a href="/login" className={linkCls} style={linkStyle}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#c9a84c')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#888')}>Log in</a>
      <a href="/join"
        className="text-[8px] uppercase tracking-[0.35em] transition-all duration-300 whitespace-nowrap"
        style={{
          color: '#000',
          background: 'linear-gradient(135deg,#e8c56b,#c9a84c)',
          padding: '0.6rem 1.4rem',
          textDecoration: 'none',
          fontFamily: 'var(--font-mono), monospace',
          fontWeight: 600,
          boxShadow: '0 0 20px rgba(201,168,76,0.2)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 35px rgba(201,168,76,0.45)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(201,168,76,0.2)'; }}>
        Apply for Access
      </a>
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
      className="text-[8px] uppercase tracking-[0.4em] transition-colors duration-200"
      style={{ color: '#888', fontFamily: 'var(--font-mono), monospace', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#c9a84c')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#888')}
    >
      Sign out
    </button>
  );
}
