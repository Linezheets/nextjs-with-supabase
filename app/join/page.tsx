'use client';

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link             from 'next/link';

export const dynamic = 'force-dynamic';

const BUSINESS_TYPES = [
  'Boutique',
  'Multi-brand Store',
  'Department Store',
  'Online Retailer',
  'Concept Store',
  'Showroom',
  'Other',
];

export default function JoinPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [step, setStep]       = useState<1 | 2 | 'done'>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    businessName: '',
    businessType: '',
    country     : '',
    website     : '',
    email       : '',
    password    : '',
    confirm     : '',
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  function nextStep(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email   : form.email,
      password: form.password,
      options : {
        data: {
          business_name: form.businessName,
          business_type: form.businessType,
          country      : form.country,
          website      : form.website,
          role         : 'buyer',
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Supabase may require email confirmation — show success screen instead of
    // redirecting to dashboard (where they'd be bounced back as unconfirmed).
    setStep('done');
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>
            LINEZHEETS
          </Link>
          <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
            Buyer Registration
          </p>
          <Link href="/login"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888' }}>
            Sign In
          </Link>
        </div>
      </header>

      <div className="flex-1 flex">

        {/* Left — brand panel */}
        <aside className="hidden lg:flex flex-col justify-between w-[420px] shrink-0
                          bg-black text-white px-14 py-20">
          <div>
            <p className="text-[7.5px] uppercase tracking-[0.6em] mb-16" style={{ color: '#c9a84c' }}>
              VIP Wholesale Access
            </p>
            <h2 style={{
              fontFamily  : 'var(--font-serif), Georgia, serif',
              fontSize    : '2.8rem',
              fontWeight  : 400,
              lineHeight  : 1.05,
              marginBottom: '2rem',
            }}>
              Trade with the<br />
              <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>world's finest</em><br />
              designer houses
            </h2>
            <p className="text-[13px] leading-[1.9]" style={{ color: '#555' }}>
              Register your business for free and get instant access to the
              Linezheets private wholesale showroom.
            </p>
          </div>

          <ul className="space-y-5">
            {[
              'Full wholesale pricing on all collections',
              'Direct communication with designer houses',
              'AI-powered brand & product matching',
              'Intelligent POS & stock management',
              'Shopify and multi-channel sync',
              'B2C storefront generation from your catalogue',
            ].map(f => (
              <li key={f} className="flex items-start gap-3">
                <span style={{ color: '#c9a84c', marginTop: '2px', flexShrink: 0 }}>✦</span>
                <span className="text-[11px] leading-[1.7]" style={{ color: '#666' }}>{f}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right — form */}
        <div className="flex-1 flex items-center justify-center px-8 py-20">
          <div className="w-full max-w-md">

            {/* Progress bar — hidden on done screen */}
            {step !== 'done' && <div className="flex items-center gap-2 mb-14">
              {([1, 2] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-10 h-px" style={{ background: (step as number) >= s ? '#111' : '#e8e8e8' }} />}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 flex items-center justify-center text-[8px]"
                      style={{
                        background: (step as number) >= s ? '#000' : '#f4f4f4',
                        color     : (step as number) >= s ? '#fff' : '#ccc',
                        fontFamily: 'var(--font-mono), monospace',
                      }}
                    >
                      {(step as number) > s ? '✓' : s}
                    </div>
                    <span className="text-[8px] uppercase tracking-[0.3em]"
                          style={{ color: (step as number) >= s ? '#333' : '#ccc' }}>
                      {s === 1 ? 'Business' : 'Account'}
                    </span>
                  </div>
                </div>
              ))}
            </div>}

            {/* Step 1 — Business */}
            {step === 1 && (
              <form onSubmit={nextStep}>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: '2rem', fontWeight: 400, color: '#111', marginBottom: '2.5rem',
                }}>
                  Your Business
                </h1>

                <div className="space-y-8">
                  <TextField
                    label="Business Name"
                    type="text"
                    required
                    placeholder="e.g. Maison Dupont"
                    value={form.businessName}
                    onChange={set('businessName')}
                  />

                  <div>
                    <label className="block text-[8px] uppercase tracking-[0.4em] mb-3"
                           style={{ color: '#999' }}>
                      Business Type <span style={{ color: '#c9a84c' }}>*</span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={form.businessType}
                        onChange={set('businessType')}
                        className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-white
                                   outline-none appearance-none focus:border-black transition-colors pr-6"
                        style={{ color: form.businessType ? '#333' : '#ccc' }}
                      >
                        <option value="" disabled>Select type</option>
                        {BUSINESS_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="absolute right-0 top-1 text-[10px] pointer-events-none"
                            style={{ color: '#bbb' }}>▾</span>
                    </div>
                  </div>

                  <TextField
                    label="Country"
                    type="text"
                    required
                    placeholder="e.g. France"
                    value={form.country}
                    onChange={set('country')}
                  />

                  <TextField
                    label="Website (optional)"
                    type="url"
                    placeholder="https://yourboutique.com"
                    value={form.website}
                    onChange={set('website')}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-12 w-full py-4 text-[8.5px] uppercase tracking-[0.5em]
                             bg-black text-white hover:bg-zinc-900 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  Continue →
                </button>

                <p className="mt-8 text-[11px] text-center" style={{ color: '#bbb' }}>
                  Already have an account?{' '}
                  <Link href="/login" className="hover:opacity-60 transition-opacity" style={{ color: '#888' }}>
                    Sign in
                  </Link>
                </p>
              </form>
            )}

            {/* Step 2 — Account */}
            {step === 'done' && (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-8 flex items-center justify-center bg-black text-white text-lg">
                  ✓
                </div>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: '2rem', fontWeight: 400, color: '#111', marginBottom: '1.5rem',
                }}>
                  Application Received
                </h1>
                <p className="text-[13px] leading-[1.9] mb-4" style={{ color: '#666' }}>
                  We've sent a confirmation email to <strong>{form.email}</strong>.
                </p>
                <p className="text-[12px] leading-[1.8] mb-10" style={{ color: '#aaa' }}>
                  Click the link in your inbox to activate your account and access the Linezheets platform.
                  Check your spam folder if you don't see it within a few minutes.
                </p>
                <Link
                  href="/login"
                  className="inline-block py-3 px-8 text-[8.5px] uppercase tracking-[0.5em] bg-black text-white hover:bg-zinc-900 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  Go to Sign In
                </Link>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit}>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: '2rem', fontWeight: 400, color: '#111', marginBottom: '2.5rem',
                }}>
                  Your Account
                </h1>

                <div className="space-y-8">
                  <TextField
                    label="Email Address"
                    type="email"
                    required
                    placeholder="you@yourbusiness.com"
                    value={form.email}
                    onChange={set('email')}
                  />

                  <TextField
                    label="Password"
                    type="password"
                    required
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set('password')}
                  />

                  <TextField
                    label="Confirm Password"
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={form.confirm}
                    onChange={set('confirm')}
                  />
                </div>

                {error && (
                  <p className="mt-6 text-[11px] leading-[1.7]" style={{ color: '#c0392b' }}>{error}</p>
                )}

                <div className="mt-4 p-4 bg-zinc-50 border border-zinc-100">
                  <p className="text-[9px] uppercase tracking-[0.3em] mb-1" style={{ color: '#bbb' }}>
                    Registering as
                  </p>
                  <p className="text-[12px]" style={{ color: '#666' }}>
                    {form.businessName} · {form.businessType} · {form.country}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-8 w-full py-4 text-[8.5px] uppercase tracking-[0.5em]
                             bg-black text-white hover:bg-zinc-900 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {loading ? 'Creating account…' : 'Create Account & Enter'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="mt-4 w-full py-3 text-[8px] uppercase tracking-[0.4em]
                             text-zinc-400 hover:text-zinc-700 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  ← Back
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Clean text field ──────────────────────────────────────────────────────────

function TextField({
  label,
  required,
  ...props
}: {
  label    : string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[8px] uppercase tracking-[0.4em] mb-3" style={{ color: '#999' }}>
        {label}
        {required && <span style={{ color: '#c9a84c' }}> *</span>}
      </label>
      <input
        {...props}
        required={required}
        className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none
                   focus:border-black transition-colors placeholder:text-zinc-300"
        style={{ color: '#333' }}
      />
    </div>
  );
}
