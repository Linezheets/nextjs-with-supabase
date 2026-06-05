'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Screen = 'options' | 'email-sent' | 'totp';

function MFAForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect') ?? '/dashboard';

  const [screen,    setScreen]    = useState<Screen>('options');
  const [userEmail, setUserEmail] = useState('');
  const [factorId,  setFactorId]  = useState<string | null>(null);
  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [hasTOTP,   setHasTOTP]   = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserEmail(user.email ?? '');
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find(f => f.status === 'verified');
      if (totp) { setHasTOTP(true); setFactorId(totp.id); }
    })();
  }, [router]);

  // ── Social re-auth ───────────────────────────────────────────────────────
  async function handleOAuth(provider: 'google' | 'facebook' | 'linkedin_oidc') {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/api/auth/callback${redirectTo !== '/dashboard' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl } });
    if (error) { setError(error.message); setBusy(false); return; }
    if (data.url) window.location.href = data.url;
  }

  // ── Email OTP — send ─────────────────────────────────────────────────────
  async function sendEmailCode() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/api/auth/callback${redirectTo !== '/dashboard' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { shouldCreateUser: false, emailRedirectTo: callbackUrl },
    });
    if (error) { setError(error.message); setBusy(false); return; }
    setScreen('email-sent');
    setBusy(false);
  }

  // ── TOTP verify ──────────────────────────────────────────────────────────
  async function verifyTOTP() {
    if (!factorId) return;
    setBusy(true); setError('');
    const supabase = createClient();
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr || !challenge) { setError(challengeErr?.message ?? 'Challenge failed'); setBusy(false); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.replace(/\s/g, '') });
    if (verifyErr) { setError('Invalid code — please try again'); setCode(''); setBusy(false); return; }
    window.location.href = redirectTo;
  }

  // ── Email OTP — verify ───────────────────────────────────────────────────
  async function verifyEmailCode() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: code.replace(/\s/g, ''),
      type : 'email',
    });
    if (error) {
      setError('Invalid or expired code — please try again');
      setCode('');
      setBusy(false);
      return;
    }
    window.location.href = redirectTo;
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
          <a href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>LINEZHEETS</a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Private Access</span>
          <span />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          <div className="mb-10">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-4" style={{ color: '#c9a84c' }}>
              Two-Factor Authentication
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, lineHeight: 1, color: '#0a0a0a',
            }}>
              Verify Identity
            </h1>
            <p className="mt-4 text-[11px] leading-relaxed" style={{ color: '#aaa' }}>
              {screen === 'options'
                ? 'Choose how you want to verify your identity.'
                : `We sent a 6-digit code to ${userEmail}`}
            </p>
          </div>

          {/* ── Options ───────────────────────────────────────────────────── */}
          {screen === 'options' && (
            <div className="space-y-3">

              <button type="button" onClick={() => handleOAuth('google')}
                      disabled={busy} className={socialBtn} style={{ color: '#444' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span style={{ color: '#555' }}>{busy ? 'Redirecting…' : 'Verify with Google'}</span>
              </button>

              <button type="button" onClick={() => handleOAuth('facebook')}
                      disabled={busy} className={socialBtn} style={{ color: '#444' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span style={{ color: '#555' }}>{busy ? 'Redirecting…' : 'Verify with Facebook'}</span>
              </button>

              <button type="button" onClick={() => handleOAuth('linkedin_oidc')}
                      disabled={busy} className={socialBtn} style={{ color: '#444' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span style={{ color: '#555' }}>{busy ? 'Redirecting…' : 'Verify with LinkedIn'}</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px" style={{ background: '#eee' }} />
                <span className="text-[8px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>or</span>
                <div className="flex-1 h-px" style={{ background: '#eee' }} />
              </div>

              {/* TOTP — only show if enrolled */}
              {hasTOTP && (
                <button type="button" onClick={() => { setScreen('totp'); setCode(''); setError(''); }}
                        disabled={busy} className={socialBtn} style={{ color: '#444' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" aria-hidden="true">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <circle cx="12" cy="17" r="1" fill="#888"/>
                    <path d="M9 7h6M9 11h4"/>
                  </svg>
                  <span style={{ color: '#555' }}>Use authenticator app</span>
                </button>
              )}

              {/* Email OTP */}
              <button type="button" onClick={sendEmailCode}
                      disabled={busy || !userEmail} className={socialBtn} style={{ color: '#444' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="#888" strokeWidth="1.5" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m2 7 10 7 10-7"/>
                </svg>
                <span style={{ color: '#555' }}>
                  {busy ? 'Sending…' : `Send code to ${userEmail || 'your email'}`}
                </span>
              </button>

              {error && (
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>{error}</p>
              )}
            </div>
          )}

          {/* ── TOTP code entry ───────────────────────────────────────────── */}
          {screen === 'totp' && (
            <div className="space-y-5">
              <div>
                <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: '#aaa' }}>
                  Authenticator Code
                </label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                       value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                       placeholder="000000"
                       className="w-full border border-zinc-200 px-4 py-3 text-[18px] outline-none
                                  focus:border-zinc-400 transition-colors tracking-[0.4em] text-center"
                       style={{ color: '#333', fontFamily: 'var(--font-mono), monospace' }} />
              </div>
              {error && <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>{error}</p>}
              <button type="button" onClick={verifyTOTP} disabled={busy || code.length < 6}
                      className="w-full py-3 text-[8px] uppercase tracking-[0.5em] text-white transition-opacity disabled:opacity-40"
                      style={{ background: '#111' }}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
              <button type="button" onClick={() => { setScreen('options'); setCode(''); setError(''); }}
                      className="w-full py-3 text-[8px] uppercase tracking-[0.4em] border border-zinc-200 hover:border-zinc-400 transition-colors"
                      style={{ color: '#888' }}>
                Back
              </button>
            </div>
          )}

          {/* ── Email code entry ───────────────────────────────────────────── */}
          {screen === 'email-sent' && (
            <div className="space-y-5">
              <div>
                <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                       style={{ color: '#aaa' }}>
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full border border-zinc-200 px-4 py-3 text-[18px] outline-none
                             focus:border-zinc-400 transition-colors tracking-[0.4em] text-center"
                  style={{ color: '#333', fontFamily: 'var(--font-mono), monospace' }}
                />
              </div>

              {error && (
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>{error}</p>
              )}

              <button type="button" onClick={verifyEmailCode}
                      disabled={busy || code.length < 6}
                      className="w-full py-3 text-[8px] uppercase tracking-[0.5em] text-white
                                 transition-opacity disabled:opacity-40"
                      style={{ background: '#111' }}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>

              <button type="button"
                      onClick={() => { setScreen('options'); setCode(''); setError(''); }}
                      className="w-full py-3 text-[8px] uppercase tracking-[0.4em] border border-zinc-200
                                 hover:border-zinc-400 transition-colors"
                      style={{ color: '#888' }}>
                Back
              </button>

              <p className="text-[10px] text-center" style={{ color: '#bbb' }}>
                Didn't receive it?{' '}
                <button type="button" onClick={sendEmailCode} disabled={busy}
                        className="hover:opacity-60 transition-opacity disabled:opacity-40"
                        style={{ color: '#888', borderBottom: '1px solid #ddd' }}>
                  Resend
                </button>
              </p>
            </div>
          )}

          <p className="mt-10 text-[10px] text-center" style={{ color: '#bbb' }}>
            Need help?{' '}
            <a href="mailto:info@mxlla.com" className="hover:opacity-60 transition-opacity"
               style={{ color: '#888', borderBottom: '1px solid #ddd' }}>
              Contact support
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

export default function MFAPage() {
  return (
    <Suspense>
      <MFAForm />
    </Suspense>
  );
}
