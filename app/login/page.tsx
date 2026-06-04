'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Only allow same-origin relative paths — rejects open redirect attacks. */
function safeRedirect(raw: string | null): string {
  const path = raw ?? '/dashboard';
  if (path.startsWith('/') && !path.startsWith('//') && !path.includes('://')) return path;
  return '/dashboard';
}

function LoginForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const redirectTo    = safeRedirect(searchParams.get('redirect'));
  const oauthError    = searchParams.get('error');
  // Session timeout message passed by proxy.ts when a privileged session expires
  const sessionMsg    = searchParams.get('msg');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(oauthError ?? sessionMsg ?? '');
  const [loading,  setLoading]  = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If the user has MFA enrolled, they need to verify before proceeding
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const mfaUrl = redirectTo !== '/dashboard'
        ? `/mfa?redirect=${encodeURIComponent(redirectTo)}`
        : '/mfa';
      router.push(mfaUrl);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  async function handleOAuth(provider: 'google' | 'facebook' | 'linkedin_oidc') {
    setSocialLoading(provider);
    setError('');
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/api/auth/callback${redirectTo !== '/dashboard' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    // Browser redirects away — no need to set loading false
  }

  const socialBtn = `w-full flex items-center justify-center gap-3 border border-zinc-200 px-4 py-3
    text-[11px] uppercase tracking-[0.3em] hover:border-zinc-400 hover:bg-zinc-50
    transition-colors duration-150 disabled:opacity-40`;

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
              Sign In
            </h1>
          </div>

          {/* ── Social login ─────────────────────────────────────────────── */}
          <div className="space-y-3 mb-8">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!socialLoading}
              className={socialBtn}
              style={{ color: '#444' }}
            >
              {/* Google icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span style={{ color: '#555' }}>
                {socialLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('facebook')}
              disabled={!!socialLoading}
              className={socialBtn}
              style={{ color: '#444' }}
            >
              {/* Facebook icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span style={{ color: '#555' }}>
                {socialLoading === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('linkedin_oidc')}
              disabled={!!socialLoading}
              className={socialBtn}
              style={{ color: '#444' }}
            >
              {/* LinkedIn icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span style={{ color: '#555' }}>
                {socialLoading === 'linkedin_oidc' ? 'Redirecting…' : 'Continue with LinkedIn'}
              </span>
            </button>
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: '#eee' }} />
            <span className="text-[8px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>
              or
            </span>
            <div className="flex-1 h-px" style={{ background: '#eee' }} />
          </div>

          {/* ── Email / password ──────────────────────────────────────────── */}
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[7.5px] uppercase tracking-[0.4em]"
                       style={{ color: '#aaa' }}>
                  Password
                </label>
                <a href="/forgot-password"
                   className="text-[7.5px] uppercase tracking-[0.3em] hover:opacity-60 transition-opacity"
                   style={{ color: '#888' }}>
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              {loading ? 'Signing In…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-[10px] text-center" style={{ color: '#bbb' }}>
            No account?{' '}
            <a href="/join"
               className="hover:opacity-60 transition-opacity"
               style={{ color: '#888', borderBottom: '1px solid #ddd' }}>
              Request access
            </a>
          </p>

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
