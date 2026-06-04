'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Reject anything that is not a safe relative path — prevents open redirect. */
function safeRedirect(raw: string | null): string {
  const path = raw ?? '/dashboard';
  // Must start with / but not // (protocol-relative) and must not contain a colon
  // before the first slash (which would indicate a scheme like https:)
  if (path.startsWith('/') && !path.startsWith('//') && !path.includes('://')) {
    return path;
  }
  return '/dashboard';
}

function MFAForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = safeRedirect(searchParams.get('redirect'));

  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [factorId,  setFactorId]  = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.totp?.length) {
        // No MFA factor enrolled — skip straight to destination
        router.replace(redirectTo);
        return;
      }
      setFactorId(data.totp[0].id);
    })();
  }, [redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? 'Could not start challenge');
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ''),
    });

    if (verifyError) {
      setError('Invalid code — please try again');
      setCode('');
      setLoading(false);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
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
              fontSize  : 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 400,
              lineHeight: 1,
              color     : '#0a0a0a',
            }}>
              Verify Identity
            </h1>
            <p className="mt-4 text-[11px] leading-relaxed" style={{ color: '#aaa' }}>
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                     style={{ color: '#aaa' }}>
                Authenticator Code
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
              <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-3 text-[8px] uppercase tracking-[0.5em] text-white
                         transition-opacity disabled:opacity-40 mt-2"
              style={{ background: '#111' }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          <p className="mt-8 text-[10px] text-center" style={{ color: '#bbb' }}>
            Lost access to your authenticator?{' '}
            <a href="mailto:info@mxlla.com"
               className="hover:opacity-60 transition-opacity"
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
