'use client';

/**
 * Mandatory MFA enrollment gate.
 *
 * Shown the FIRST time a user reaches /dashboard without a verified TOTP factor.
 * The user cannot proceed until they complete enrollment.
 * After enrollment, a full page reload re-runs the server component which
 * detects the verified factor and renders the normal dashboard.
 */

import { useState, useEffect } from 'react';
import { createClient }        from '@/lib/supabase/client';

type Step = 'loading' | 'setup' | 'enrolled';

export default function MFAEnrollmentGate({ email }: { email: string }) {
  const [step,       setStep]       = useState<Step>('loading');
  const [qrCode,     setQrCode]     = useState<string | null>(null);
  const [secret,     setSecret]     = useState<string | null>(null);
  const [factorId,   setFactorId]   = useState<string | null>(null);
  const [code,       setCode]       = useState('');
  const [error,      setError]      = useState('');
  const [busy,       setBusy]       = useState(false);

  // Start enrollment automatically on mount
  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // Clean up any leftover unverified factors first
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of (existing?.totp ?? []).filter(f => f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType  : 'totp',
        issuer      : 'Linezheets',
        friendlyName: 'Authenticator',
      });

      if (error || !data) {
        setError(error?.message ?? 'Could not start 2FA setup. Please refresh.');
        setStep('setup');
        return;
      }

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('setup');
    })();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\s/g, ''),
    });

    if (error) {
      setError('Invalid code — please try again');
      setCode('');
      setBusy(false);
      return;
    }

    setStep('enrolled');
    // Reload so the server component re-runs and detects the verified factor
    setTimeout(() => window.location.reload(), 1200);
  }

  const gold = '#c9a84c';

  return (
    <div className="min-h-screen bg-white flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/" style={{
            fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize    : '15px',
            letterSpacing: '0.5em',
            fontWeight  : 400,
          }}>LINEZHEETS</a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
            Account Security
          </span>
          <form action="/api/auth/signout" method="post">
            <button type="submit"
              className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
              style={{ color: '#888' }}>
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {step === 'enrolled' ? (
            /* ── Success ── */
            <div className="text-center space-y-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: '#f0faf4' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="#52b788" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize  : '1.8rem',
                  fontWeight: 400,
                  color     : '#111',
                }}>
                  2FA Enabled
                </h1>
                <p className="mt-3 text-[12px] leading-relaxed" style={{ color: '#aaa' }}>
                  Your account is now protected. Loading your dashboard…
                </p>
              </div>
              <div className="h-px w-16 mx-auto" style={{ background: gold }} />
            </div>

          ) : step === 'loading' ? (
            /* ── Loading ── */
            <div className="text-center space-y-4">
              <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
                Preparing setup…
              </p>
            </div>

          ) : (
            /* ── Setup form ── */
            <>
              <div className="mb-10">
                <p className="text-[8px] uppercase tracking-[0.6em] mb-4" style={{ color: gold }}>
                  Security Required
                </p>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize  : 'clamp(1.8rem, 5vw, 2.6rem)',
                  fontWeight: 400,
                  lineHeight: 1.1,
                  color     : '#0a0a0a',
                }}>
                  Set Up Two-Factor<br />Authentication
                </h1>
                <p className="mt-4 text-[11px] leading-[1.8]" style={{ color: '#888' }}>
                  Linezheets requires 2FA for all accounts.
                  Scan the QR code with your authenticator app
                  (Google Authenticator, Authy, or 1Password).
                </p>
                <p className="mt-2 text-[10px]" style={{ color: '#bbb' }}>
                  Signed in as {email}
                </p>
              </div>

              {error && !qrCode && (
                <p className="mb-6 text-[10px] uppercase tracking-[0.3em]"
                   style={{ color: '#c0392b' }}>
                  {error}
                </p>
              )}

              {qrCode && (
                <form onSubmit={handleVerify} className="space-y-6">

                  {/* QR code */}
                  <div className="border border-zinc-100 p-4 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="Scan to enroll 2FA" width={160} height={160} />
                  </div>

                  {/* Manual key */}
                  {secret && (
                    <div>
                      <p className="text-[7.5px] uppercase tracking-[0.4em] mb-1"
                         style={{ color: '#bbb' }}>
                        Can't scan? Enter this key manually
                      </p>
                      <p className="text-[11px] tracking-[0.12em] break-all"
                         style={{ color: '#555', fontFamily: 'var(--font-mono), monospace' }}>
                        {secret}
                      </p>
                    </div>
                  )}

                  {/* Code input */}
                  <div>
                    <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                           style={{ color: '#aaa' }}>
                      Enter the 6-digit code to confirm
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
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
                    <p className="text-[10px] uppercase tracking-[0.3em]"
                       style={{ color: '#c0392b' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy || code.length < 6}
                    className="w-full py-3 text-[8px] uppercase tracking-[0.5em] text-white
                               transition-opacity disabled:opacity-40"
                    style={{ background: '#111' }}
                  >
                    {busy ? 'Verifying…' : 'Enable 2FA & Continue'}
                  </button>

                  <p className="text-[9px] leading-[1.7]" style={{ color: '#ccc' }}>
                    You will be asked for this code each time you sign in.
                    Store your backup codes safely — lost access?{' '}
                    <a href="mailto:info@mxlla.com"
                       style={{ color: '#aaa', borderBottom: '1px solid #ddd' }}>
                      Contact support
                    </a>
                  </p>

                </form>
              )}
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
            <span style={{ color: gold }}>Linezheets</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
