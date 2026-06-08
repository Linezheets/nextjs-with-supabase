'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

const GOLD  = '#c9a84c';
const MONO  = 'var(--font-mono), "DM Mono", monospace';
const SERIF = 'var(--font-serif), Georgia, serif';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
  borderBottom: '1px solid #e0e0e0',
  padding: '0.5rem 0', fontSize: '13px', fontFamily: MONO,
  background: 'transparent', outline: 'none', color: '#222',
};

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready,    setReady]    = useState(false);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#000' }}>

      {/* Nav */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#000' }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
            <LogoMark size={28} />
            <span style={{ fontFamily: SERIF, fontSize: '13px', letterSpacing: '0.45em', color: '#fff', fontWeight: 400 }}>
              LINEZHEETS
            </span>
          </Link>
          <span style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            Private Access
          </span>
          <Link href="/join" style={{
            fontFamily: MONO, fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase',
            color: '#000', background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            padding: '0.55rem 1.25rem', textDecoration: 'none', fontWeight: 600,
          }}>
            Apply for Access
          </Link>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', background: '#fff' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, marginBottom: '1rem' }}>
                Buyer Portal
              </p>
              <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem,5vw,2.8rem)', fontWeight: 400, lineHeight: 1, color: '#0a0a0a' }}>
                {done ? 'Password Updated' : 'New Password'}
              </h1>
            </div>

            {done ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontFamily: MONO, fontSize: '12px', lineHeight: 2, color: '#555' }}>
                  Your password has been updated. Redirecting to your dashboard…
                </p>
                <div style={{ height: 1, background: GOLD, opacity: 0.35 }} />
              </div>
            ) : !ready && !error ? (
              <p style={{ fontFamily: MONO, fontSize: '12px', lineHeight: 2, color: '#aaa' }}>
                Verifying link…
              </p>
            ) : error && !ready ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#b91c1c' }}>
                  {error}
                </p>
                <a href="/forgot-password" style={{
                  display: 'block', textAlign: 'center', padding: '0.95rem',
                  fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.5em', textTransform: 'uppercase',
                  background: '#111', color: '#fff', textDecoration: 'none',
                }}>
                  Request New Link
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#aaa', marginBottom: '0.6rem' }}>
                    New Password
                  </label>
                  <input type="password" autoComplete="new-password" required minLength={8}
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#aaa', marginBottom: '0.6rem' }}>
                    Confirm Password
                  </label>
                  <input type="password" autoComplete="new-password" required minLength={8}
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {error && (
                  <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#b91c1c' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '0.95rem',
                    fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.5em', textTransform: 'uppercase',
                    background: '#111', color: '#fff', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}

            {!done && (
              <p style={{ marginTop: '2rem', textAlign: 'center', fontFamily: MONO, fontSize: '10px', color: '#bbb' }}>
                <a href="/login" style={{ color: '#888', borderBottom: '1px solid #ddd', textDecoration: 'none' }}>
                  Back to sign in
                </a>
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#000' }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '1.5rem 2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
        }}>
          <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} MXLLA Agency Ltd.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[{ label: 'Terms', href: '/terms' }, { label: 'Contact', href: '/contact' }].map(({ label, href }) => (
              <a key={href} href={href} style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
