'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Step = 'loading' | 'enrolled' | 'unenrolled' | 'setup';

const inputCls = `w-full border border-zinc-200 px-4 py-3 text-[13px] bg-white
  focus:outline-none focus:border-zinc-500 transition-colors`;

export default function MFASection() {
  const [step,      setStep]      = useState<Step>('loading');
  const [factorId,  setFactorId]  = useState<string | null>(null);
  const [qrCode,    setQrCode]    = useState<string | null>(null);
  const [secret,    setSecret]    = useState<string | null>(null);
  const [newFactorId, setNewFactorId] = useState<string | null>(null);
  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find(f => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setStep('enrolled');
      } else {
        setStep('unenrolled');
      }
    })();
  }, []);

  async function startEnroll() {
    setBusy(true);
    setError('');
    const supabase = createClient();

    // Clean up any unverified TOTP factors left from a previous abandoned enrollment
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const unverified = existing?.totp?.filter(f => f.status !== 'verified') ?? [];
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Linezheets', friendlyName: 'Authenticator' });
    if (error || !data) {
      setError(error?.message ?? 'Enrollment failed');
      setBusy(false);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setNewFactorId(data.id);
    setStep('setup');
    setBusy(false);
  }

  async function verifyEnroll() {
    if (!newFactorId) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: newFactorId,
      code: code.replace(/\s/g, ''),
    });
    if (error) {
      setError('Invalid code — please try again');
      setCode('');
      setBusy(false);
      return;
    }
    setFactorId(newFactorId);
    setStep('enrolled');
    setCode('');
    setQrCode(null);
    setSecret(null);
    setBusy(false);
  }

  async function unenroll() {
    if (!factorId) return;
    setBusy(true);
    setError('');
    const supabase = createClient();

    // Supabase requires AAL2 (MFA verified this session) to unenroll.
    // Check first so we can show a clear message instead of a cryptic 422.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      setError('Sign out and log back in with your authenticator code before disabling 2FA.');
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    setFactorId(null);
    setStep('unenrolled');
    setBusy(false);
  }

  if (step === 'loading') return null;

  return (
    <section>
      <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
         style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
        Two-Factor Authentication
      </p>

      {step === 'enrolled' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#52b788' }} />
            <p className="text-[12px]" style={{ color: '#333', fontFamily: 'system-ui, sans-serif' }}>
              Authenticator app enabled
            </p>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
            Your account is protected with TOTP two-factor authentication.
          </p>
          {error && (
            <p className="text-[10px] uppercase tracking-[0.3em]"
               style={{ color: '#e07070', fontFamily: 'system-ui, sans-serif' }}>{error}</p>
          )}
          <button
            type="button"
            onClick={unenroll}
            disabled={busy}
            className="px-8 py-[12px] text-[8px] uppercase tracking-[0.4em] border border-zinc-300
                       hover:border-zinc-500 disabled:opacity-40 transition-colors"
            style={{ fontFamily: 'system-ui, sans-serif', color: '#666' }}
          >
            {busy ? 'Removing…' : 'Disable 2FA'}
          </button>
        </div>
      )}

      {step === 'unenrolled' && (
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
            Add an extra layer of security to your account by linking an authenticator app
            (Google Authenticator, Authy, 1Password, etc.).
          </p>
          {error && (
            <p className="text-[10px] uppercase tracking-[0.3em]"
               style={{ color: '#e07070', fontFamily: 'system-ui, sans-serif' }}>{error}</p>
          )}
          <button
            type="button"
            onClick={startEnroll}
            disabled={busy}
            className="px-8 py-[12px] text-[8px] uppercase tracking-[0.4em] bg-black text-white
                       hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {busy ? 'Setting up…' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {step === 'setup' && qrCode && (
        <div className="space-y-6 max-w-sm">
          <p className="text-[11px] leading-relaxed" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>

          <div className="border border-zinc-100 p-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR code" width={160} height={160} />
          </div>

          {secret && (
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.4em] mb-1"
                 style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
                Manual entry key
              </p>
              <p className="text-[11px] tracking-[0.15em] break-all"
                 style={{ color: '#555', fontFamily: 'var(--font-mono), monospace' }}>
                {secret}
              </p>
            </div>
          )}

          <div>
            <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                   style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
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
              className={inputCls + ' tracking-[0.4em] text-center text-[16px]'}
              style={{ fontFamily: 'var(--font-mono), monospace', color: '#333' }}
            />
          </div>

          {error && (
            <p className="text-[10px] uppercase tracking-[0.3em]"
               style={{ color: '#e07070', fontFamily: 'system-ui, sans-serif' }}>{error}</p>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={verifyEnroll}
              disabled={busy || code.length < 6}
              className="px-8 py-[12px] text-[8px] uppercase tracking-[0.4em] bg-black text-white
                         hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {busy ? 'Verifying…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('unenrolled'); setCode(''); setError(''); }}
              className="px-8 py-[12px] text-[8px] uppercase tracking-[0.4em] border border-zinc-200
                         hover:border-zinc-400 transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif', color: '#888' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
