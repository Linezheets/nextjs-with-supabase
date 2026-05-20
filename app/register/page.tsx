'use client';

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link             from 'next/link';

type Role = 'brand' | 'buyer';

const PLANS = [
  { id: 'starter',    label: 'Starter',    price: '$49',    period: '/mo', features: ['Up to 200 SKUs', 'Basic analytics', '1 user seat'],          popular: false },
  { id: 'studio',     label: 'Studio',     price: '$149',   period: '/mo', features: ['Unlimited SKUs', 'AI features', '5 user seats'],             popular: true  },
  { id: 'enterprise', label: 'Enterprise', price: 'Custom', period: '',    features: ['Unlimited everything', 'Dedicated support', 'Custom SLA'],   popular: false },
] as const;

export default function RegisterPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [role,    setRole]    = useState<Role>('brand');
  const [plan,    setPlan]    = useState<string>('studio');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [tab,     setTab]     = useState<'login' | 'register'>('register');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw,    setLoginPw]    = useState('');

  // Register state
  const [form, setForm] = useState({
    companyName: '',
    firstName  : '',
    lastName   : '',
    email      : '',
    phone      : '',
    password   : '',
    agree      : false,
  });

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail, password: loginPw,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.agree) { setError('Please accept the Terms of Service.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email   : form.email,
      password: form.password,
      options : {
        data: {
          role        : role,
          first_name  : form.firstName,
          last_name   : form.lastName,
          company_name: form.companyName,
          phone       : form.phone,
          plan        : role === 'brand' ? plan : undefined,
        },
      },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push(role === 'brand' ? '/dashboard/brand-store' : '/dashboard');
    router.refresh();
  }

  const gold = '#c9a84c';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between h-[56px]">
          <Link href="/" style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '15px', letterSpacing: '0.5em', color: '#fff', fontWeight: 400 }}>
            MXLLA
          </Link>
          <p className="text-[7.5px] uppercase tracking-[0.5em]" style={{ color: '#555' }}>Wholesale Platform</p>
          <Link href="/login" className="text-[7.5px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity" style={{ color: '#888' }}>
            Sign In
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-[520px]">

          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-8">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] transition-colors"
                style={{
                  color      : tab === t ? '#fff' : '#555',
                  borderBottom: tab === t ? `2px solid ${gold}` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t === 'login' ? 'Log In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field dark label="Email" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@brand.com" />
              <Field dark label="Password" type="password" required value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="••••••••" />
              {error && <p className="text-[10px] tracking-wide" style={{ color: '#e74c3c' }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 text-[8px] uppercase tracking-[0.5em] font-medium transition-opacity disabled:opacity-40"
                style={{ background: gold, color: '#000' }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <p className="text-center text-[10px]" style={{ color: '#555' }}>
                No account?{' '}
                <button type="button" onClick={() => setTab('register')} style={{ color: gold }} className="hover:opacity-70 transition-opacity">
                  Create one free
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">

              {/* Role selector */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { v: 'brand', icon: '🏷', title: 'Brand / Agency', sub: 'Sell Wholesale' },
                  { v: 'buyer', icon: '🏪', title: 'Buyer / Retailer', sub: 'Browse & Order' },
                ] as { v: Role; icon: string; title: string; sub: string }[]).map(r => (
                  <button
                    key={r.v}
                    type="button"
                    onClick={() => setRole(r.v)}
                    className="p-4 text-left border transition-colors"
                    style={{
                      borderColor: role === r.v ? gold : '#333',
                      background : role === r.v ? 'rgba(201,168,76,0.08)' : 'transparent',
                    }}
                  >
                    <div className="text-xl mb-2">{r.icon}</div>
                    <p className="text-[11px] font-medium" style={{ color: role === r.v ? '#fff' : '#888' }}>{r.title}</p>
                    <p className="text-[8px] uppercase tracking-[0.35em] mt-0.5" style={{ color: gold }}>{r.sub}</p>
                  </button>
                ))}
              </div>

              <Field dark label="Brand / Company Name" required value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="e.g. Maison Verdant" />

              <div className="grid grid-cols-2 gap-3">
                <Field dark label="First Name" required value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Isabelle" />
                <Field dark label="Last Name"  required value={form.lastName}  onChange={e => set('lastName',  e.target.value)} placeholder="Martel" />
              </div>

              <Field dark label="Work Email"       type="email"    required value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@brand.com" />
              <Field dark label="Phone (optional)" type="tel"               value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 212 555 0100" />

              {/* Password */}
              <div>
                <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: '#666' }}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full border-b bg-transparent outline-none py-2 pr-8 text-[13px] placeholder:text-[#333]"
                    style={{ borderColor: '#333', color: '#fff' }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-0 top-1.5 text-[11px] opacity-40 hover:opacity-70">
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* Plan picker — brand only */}
              {role === 'brand' && (
                <div>
                  <p className="text-[7.5px] uppercase tracking-[0.4em] mb-3" style={{ color: '#666' }}>
                    Choose Your Plan <span style={{ color: '#444' }}>(14-day free trial on all plans)</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        className="relative p-3 text-center border transition-colors"
                        style={{
                          borderColor: plan === p.id ? gold : '#333',
                          background : plan === p.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                        }}
                      >
                        {p.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[6.5px] uppercase tracking-[0.3em] px-2 py-0.5"
                                style={{ background: gold, color: '#000' }}>Popular</span>
                        )}
                        <p className="text-[11px]" style={{ color: plan === p.id ? '#fff' : '#888', fontFamily: 'var(--font-serif), Georgia, serif' }}>{p.label}</p>
                        <p className="mt-1" style={{ color: gold, fontFamily: 'var(--font-mono), monospace', fontSize: '15px' }}>
                          {p.price}<span className="text-[9px]" style={{ color: '#555' }}>{p.period}</span>
                        </p>
                        <ul className="mt-2 space-y-1">
                          {p.features.map(f => (
                            <li key={f} className="text-[8px]" style={{ color: '#555' }}>{f}</li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={e => set('agree', e.target.checked)}
                  className="mt-0.5 accent-[#c9a84c]"
                />
                <span className="text-[10px] leading-relaxed" style={{ color: '#666' }}>
                  I agree to the{' '}
                  <Link href="/terms" style={{ color: gold }} className="hover:opacity-70">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" style={{ color: gold }} className="hover:opacity-70">Privacy Policy</Link>
                </span>
              </label>

              {error && <p className="text-[10px] tracking-wide" style={{ color: '#e74c3c' }}>{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-4 text-[8px] uppercase tracking-[0.5em] font-medium transition-opacity disabled:opacity-40"
                style={{ background: gold, color: '#000' }}>
                {loading ? 'Creating account…' : 'Start Free Trial'}
              </button>

              <p className="text-center text-[8px] uppercase tracking-[0.3em]" style={{ color: '#444' }}>
                No credit card required · Cancel anytime
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

function Field({ dark, label, required, ...props }: {
  dark?: boolean;
  label: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: dark ? '#666' : '#999' }}>
        {label}{required && <span style={{ color: '#c9a84c' }}> *</span>}
      </label>
      <input
        {...props}
        required={required}
        className="w-full border-b bg-transparent outline-none py-2 text-[13px] placeholder:text-[#333]"
        style={{ borderColor: dark ? '#333' : '#ddd', color: dark ? '#fff' : '#333' }}
      />
    </div>
  );
}
