'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/forgot-password', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ email }),
    });

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
              {sent ? 'Check Your Email' : 'Reset Password'}
            </h1>
          </div>

          {sent ? (
            <div className="space-y-6">
              <p className="text-[11px] leading-relaxed tracking-[0.05em]" style={{ color: '#555' }}>
                If an account exists for <span style={{ color: '#333' }}>{email}</span>, you will
                receive a password reset link shortly.
              </p>
              <div className="h-px" style={{ background: '#c9a84c', opacity: 0.4 }} />
              <a href="/login"
                 className="block w-full py-3 text-center text-[8px] uppercase tracking-[0.5em]
                            text-white transition-opacity hover:opacity-70"
                 style={{ background: '#111' }}>
                Back to Sign In
              </a>
            </div>
          ) : (
            <>
              <p className="mb-8 text-[11px] leading-relaxed tracking-[0.05em]" style={{ color: '#aaa' }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                         style={{ color: '#aaa' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
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
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-8 text-[10px] text-center" style={{ color: '#bbb' }}>
                <a href="/login"
                   className="hover:opacity-60 transition-opacity"
                   style={{ color: '#888', borderBottom: '1px solid #ddd' }}>
                  Back to sign in
                </a>
              </p>
            </>
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
