'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    <div className="min-h-screen bg-white flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/"
             style={{
               fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
               fontSize    : '15px',
               letterSpacing: '0.5em',
               fontWeight  : 400,
             }}>
            LINEZHEETS
          </a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
            Private Access
          </span>
          <a href="/join"
             className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
             style={{ color: '#888' }}>
            Request Access
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          <div className="mb-10">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-4" style={{ color: '#c9a84c' }}>
              Buyer Portal
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize  : 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 400,
              lineHeight: 1,
              color     : '#0a0a0a',
            }}>
              {done ? 'Password Updated' : 'New Password'}
            </h1>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="text-[11px] tracking-[0.1em]" style={{ color: '#555' }}>
                Your password has been updated. Redirecting to your dashboard…
              </p>
              <div className="h-px" style={{ background: '#c9a84c', opacity: 0.4 }} />
            </div>
          ) : !ready && !error ? (
            <p className="text-[11px] tracking-[0.1em]" style={{ color: '#aaa' }}>
              Verifying link…
            </p>
          ) : error ? (
            <div className="space-y-6">
              <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>
                {error}
              </p>
              <a href="/forgot-password"
                 className="block w-full py-3 text-center text-[8px] uppercase tracking-[0.5em]
                            text-white transition-opacity hover:opacity-70"
                 style={{ background: '#111' }}>
                Request New Link
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                       style={{ color: '#aaa' }}>
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none
                             focus:border-zinc-400 transition-colors"
                  style={{ color: '#333' }}
                />
              </div>

              <div>
                <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                       style={{ color: '#aaa' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none
                             focus:border-zinc-400 transition-colors"
                  style={{ color: '#333' }}
                />
              </div>

              {error && (
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-[8px] uppercase tracking-[0.5em] text-white
                           transition-opacity disabled:opacity-40 mt-2"
                style={{ background: '#111' }}
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}

          {!done && (
            <p className="mt-8 text-[10px] text-center" style={{ color: '#bbb' }}>
              <a href="/login"
                 className="hover:opacity-60 transition-opacity"
                 style={{ color: '#888', borderBottom: '1px solid #ddd' }}>
                Back to sign in
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-8 flex items-center justify-between">
          <p className="text-[7.5px] uppercase tracking-[0.28em]" style={{ color: '#ccc' }}>
            Private Showroom · Authorised Retailers Only
          </p>
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#d8d8d8' }}>
            © {new Date().getFullYear()} Linezheets ·{' '}
            <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
