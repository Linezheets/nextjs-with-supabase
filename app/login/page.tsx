'use client';

import { useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

const GOLD        = '#c9a84c';
const GOLD_BRIGHT = '#e8c56b';
const MONO        = 'var(--font-mono), "DM Mono", monospace';
const SERIF       = 'var(--font-serif), Georgia, serif';

// ── Minimal monochrome social button ────────────────────────────────────────

function SocialButton({
  onClick, disabled, loading, label, icon,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.75rem', padding: '0.8rem',
        border: `1px solid ${hov ? '#c9a84c' : '#e4e4e4'}`,
        background: hov ? 'rgba(201,168,76,0.04)' : '#fff',
        color: '#444', fontFamily: MONO,
        fontSize: '9px', letterSpacing: '0.35em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {loading ? 'Redirecting…' : label}
    </button>
  );
}

// ── Monochrome icons ─────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M12 12c0-1.1-.9-2-2-2H6.5C5.7 10 5 10.7 5 11.5c0 1.4 1.1 2.5 2.5 2.5h1c.3 0 .5.2.5.5 0 .3-.2.5-.5.5H7C4.8 15 3 13.2 3 11s1.8-4 4-4h3.3C11.8 7 13 8.1 13 9.5V12h-1z" />
    <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c2.4 0 4.5.9 6.1 2.4" />
    <path d="M21 3v5h-5" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.44-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM3.56 20.45h3.56V9H3.56v11.45z"/>
  </svg>
);

const GoogleIconMono = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="currentColor" style={{ opacity: 0.55 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── Form ─────────────────────────────────────────────────────────────────────

function LoginForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const redirectTo   = searchParams.get('redirect') ?? '/dashboard';
  const oauthError   = searchParams.get('error');

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [error,         setError]         = useState(oauthError ?? '');
  const [loading,       setLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [demoLoading,   setDemoLoading]   = useState(false);

  async function handleDemoLogin() {
    setDemoLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/demo-login', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Demo login failed.'); return; }
      router.push(json.redirect ?? '/dashboard');
      router.refresh();
    } catch {
      setError('Demo login failed. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!turnstileToken) {
      setError('Please complete the human verification.');
      setLoading(false);
      return;
    }

    const verifyRes = await fetch('/api/auth/verify-turnstile', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ token: turnstileToken }),
    });
    if (!verifyRes.ok) {
      setError('Verification failed. Please try again.');
      turnstileRef.current?.reset();
      setTurnstileToken('');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

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
    const supabase   = createClient();
    const callbackUrl = `${window.location.origin}/api/auth/callback${redirectTo !== '/dashboard' ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl } });
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#000' }}>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background  : '#000',
      }}>
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

          <Link
            href="/join"
            style={{
              fontFamily: MONO, fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase',
              color: '#000', background: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`,
              padding: '0.55rem 1.25rem', textDecoration: 'none', fontWeight: 600,
            }}
          >
            Apply for Access
          </Link>
        </div>
      </header>

      {/* ── Main split layout ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex' }}>

        {/* Left — brand panel (dark) */}
        <aside style={{
          display: 'none', flexDirection: 'column', justifyContent: 'space-between',
          width: 420, flexShrink: 0, background: '#000',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '4rem 3.5rem',
        }}
          className="lg:flex">
          <div>
            <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.65em', textTransform: 'uppercase', color: GOLD, marginBottom: '2.5rem' }}>
              VIP Wholesale Access
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: '2.6rem', fontWeight: 400, lineHeight: 1.05, color: '#fff', marginBottom: '2rem' }}>
              Welcome back<br />
              <em style={{ color: GOLD, fontStyle: 'italic' }}>to the showroom</em>
            </h2>
            <p style={{ fontFamily: MONO, fontSize: '12px', lineHeight: 2, color: 'rgba(255,255,255,0.35)' }}>
              Sign in to access your private wholesale dashboard, manage orders, and discover new collections.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              'Private buyer pricing on all collections',
              'Direct access to luxury brand catalogues',
              'AI-curated brand & product matching',
              'Real-time order and inventory management',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: GOLD, fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>✦</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', lineHeight: 1.8, color: 'rgba(255,255,255,0.35)' }}>{f}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right — form panel (white) */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', padding: '3rem 2rem',
        }}>
          <div style={{ width: '100%', maxWidth: 380 }}>

            {/* Header */}
            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, marginBottom: '1rem' }}>
                Buyer Portal
              </p>
              <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem,5vw,2.8rem)', fontWeight: 400, lineHeight: 1, color: '#0a0a0a' }}>
                Sign In
              </h1>
            </div>

            {/* Try Demo */}
            <div style={{ marginBottom: '1.75rem' }}>
              <TryDemoButton loading={demoLoading} onClick={handleDemoLogin} />
              <p style={{ marginTop: '0.6rem', textAlign: 'center', fontFamily: MONO, fontSize: '7px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#ccc' }}>
                Explore the platform · No account needed
              </p>
            </div>

            <Divider label="or sign in" />

            {/* Social logins — monochrome */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
              <SocialButton
                onClick={() => handleOAuth('google')}
                disabled={!!socialLoading}
                loading={socialLoading === 'google'}
                label="Continue with Google"
                icon={<GoogleIconMono />}
              />
              <SocialButton
                onClick={() => handleOAuth('linkedin_oidc')}
                disabled={!!socialLoading}
                loading={socialLoading === 'linkedin_oidc'}
                label="Continue with LinkedIn"
                icon={<LinkedInIcon />}
              />
            </div>

            <Divider label="or" />

            {/* Email / password form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
              <Field label="Email">
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field
                label="Password"
                aside={
                  <a href="/forgot-password" style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#aaa', textDecoration: 'none' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#aaa')}>
                    Forgot?
                  </a>
                }
              >
                <input
                  type="password" autoComplete="current-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
                options={{ theme: 'light', size: 'flexible' }}
              />

              {error && (
                <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#b91c1c' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '0.95rem',
                  fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.5em', textTransform: 'uppercase',
                  background: loading ? '#555' : '#111', color: '#fff',
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? 'Signing In…' : 'Sign In'}
              </button>
            </form>

            <p style={{ marginTop: '2rem', textAlign: 'center', fontFamily: MONO, fontSize: '10px', color: '#bbb' }}>
              No account?{' '}
              <a href="/join" style={{ color: '#888', borderBottom: '1px solid #ddd', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = GOLD; (e.currentTarget as HTMLElement).style.borderBottomColor = GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.borderBottomColor = '#ddd'; }}>
                Apply for access
              </a>
            </p>

          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#000' }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '1.5rem 2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
        }}>
          <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            Private Showroom · Authorised Retailers Only
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/terms#data-collected' }, { label: 'Contact', href: '/contact' }].map(({ label, href }) => (
              <a key={href} href={href} style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)')}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
  borderBottom: '1px solid #e0e0e0',
  padding: '0.5rem 0', fontSize: '13px', fontFamily: MONO,
  background: 'transparent', outline: 'none', color: '#222',
};

function Field({ label, children, aside }: { label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <label style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#aaa' }}>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
      <span style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#ccc' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
    </div>
  );
}

function TryDemoButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button" onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '0.85rem',
        border: `1px solid ${hov ? GOLD : '#ddd'}`,
        background: hov ? 'rgba(201,168,76,0.04)' : '#fff',
        fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.45em', textTransform: 'uppercase',
        color: hov ? GOLD : '#666',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
        transition: 'all 0.2s',
      }}
    >
      {loading ? 'Opening Demo…' : 'Try Demo'}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
