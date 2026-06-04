'use client';

import { useState } from 'react';

type Terms = {
  payment_methods  : string[];
  flow             : string;
  deadline_days    : number | null;
  installment_count: number;
  installment_days : number;
};

export default function PaymentTermsClient({
  brandName,
  stripeAccountStatus,
  initialTerms,
}: {
  brandName          : string;
  stripeAccountStatus: string | null;
  initialTerms       : Terms;
}) {
  const [terms,          setTerms]          = useState<Terms>(initialTerms);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError,   setConnectError]   = useState<string | null>(null);

  const toggleMethod = (m: string) => {
    setTerms(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(m)
        ? prev.payment_methods.filter(x => x !== m)
        : [...prev.payment_methods, m],
    }));
  };

  const connectStripe = async () => {
    setConnectLoading(true);
    setConnectError(null);
    const res = await fetch('/api/payments/stripe-connect', { method: 'POST' });
    const data = await res.json();
    setConnectLoading(false);
    if (!res.ok) { setConnectError(data.error ?? 'Failed to connect Stripe'); return; }
    // Redirect to Stripe hosted onboarding
    window.location.href = data.url;
  };

  const save = async () => {
    if (!terms.payment_methods.length) {
      setError('Select at least one payment method.');
      return;
    }
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch(`/api/payments/terms/${encodeURIComponent(brandName)}`, {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(terms),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json(); setError(d.error ?? 'Save failed'); }
  };

  const methods = [
    { id: 'card', label: 'Credit / Debit Card',      desc: 'Instant — Visa, Mastercard, Amex' },
    { id: 'ach',  label: 'ACH Bank Transfer',         desc: '3–5 business days · US only' },
    { id: 'wire', label: 'Wire / SEPA Transfer',      desc: '1–3 business days · International' },
  ];

  const flows = [
    { id: 'immediate',    label: 'Immediate',     desc: 'Buyer pays at checkout' },
    { id: 'pay_later',    label: 'Pay Later',      desc: 'Buyer pays within your deadline' },
    { id: 'installments', label: 'Instalments',   desc: 'Split into equal instalments' },
  ];

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/" style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400 }}>LINEZHEETS</a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Brand Portal</span>
          <div className="flex items-center gap-6">
            <a href="/dashboard/brand-store" className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>Brand Store</a>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>Sign Out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="pt-[60px]">
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6" style={{ color: '#c9a84c' }}>Brand Portal</p>
            <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(28px, 4vw, 56px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Payment Terms
            </h1>
            <p className="mt-4 text-[11px] text-zinc-500 max-w-lg leading-relaxed">
              Configure which payment methods your buyers can use and whether they may pay immediately, on a deadline, or in instalments.
            </p>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 max-w-2xl">
          <div className="space-y-16">

            {/* Stripe Connect */}
            <section>
              <p className="text-[8px] uppercase tracking-[0.5em] mb-6" style={{ color: '#c9a84c' }}>Stripe Payouts</p>
              {stripeAccountStatus === 'active' ? (
                <div className="flex items-center gap-3 p-5 border border-zinc-100">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-[11px]">Stripe Connected — payouts enabled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Connect your Stripe account to receive payments from buyers. Required before buyers can check out.
                  </p>
                  {stripeAccountStatus === 'pending' && (
                    <p className="text-[10px] text-amber-600">Onboarding in progress — complete Stripe setup to activate payouts.</p>
                  )}
                  {connectError && (
                    <p className="text-[11px] text-red-500">{connectError}</p>
                  )}
                  <button
                    onClick={connectStripe}
                    disabled={connectLoading}
                    className="px-10 py-4 text-[9px] uppercase tracking-[0.4em] bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  >
                    {connectLoading ? 'Redirecting…' : stripeAccountStatus === 'pending' ? 'Continue Stripe Setup' : 'Connect Stripe'}
                  </button>
                </div>
              )}
            </section>

            {/* Accepted methods */}
            <section>
              <p className="text-[8px] uppercase tracking-[0.5em] mb-6" style={{ color: '#c9a84c' }}>Accepted Methods</p>
              <div className="space-y-3">
                {methods.map(m => (
                  <label
                    key={m.id}
                    className="flex items-start gap-4 p-5 border cursor-pointer transition-colors"
                    style={{ borderColor: terms.payment_methods.includes(m.id) ? '#000' : '#e5e5e5' }}
                  >
                    <input
                      type="checkbox"
                      checked={terms.payment_methods.includes(m.id)}
                      onChange={() => toggleMethod(m.id)}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <p className="text-[11px] font-medium">{m.label}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Payment flow */}
            <section>
              <p className="text-[8px] uppercase tracking-[0.5em] mb-6" style={{ color: '#c9a84c' }}>Payment Flow</p>
              <div className="space-y-3">
                {flows.map(f => (
                  <label
                    key={f.id}
                    className="flex items-start gap-4 p-5 border cursor-pointer transition-colors"
                    style={{ borderColor: terms.flow === f.id ? '#000' : '#e5e5e5' }}
                  >
                    <input
                      type="radio"
                      name="flow"
                      value={f.id}
                      checked={terms.flow === f.id}
                      onChange={() => setTerms(prev => ({ ...prev, flow: f.id }))}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <p className="text-[11px] font-medium">{f.label}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{f.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Pay-later deadline */}
            {terms.flow === 'pay_later' && (
              <section>
                <p className="text-[8px] uppercase tracking-[0.5em] mb-4" style={{ color: '#c9a84c' }}>Deadline</p>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={terms.deadline_days ?? 30}
                    onChange={e => setTerms(prev => ({ ...prev, deadline_days: Number(e.target.value) }))}
                    className="w-24 border border-zinc-200 px-3 py-2 text-[12px] focus:outline-none focus:border-black"
                  />
                  <span className="text-[11px] text-zinc-500">days after order for buyer to pay</span>
                </div>
              </section>
            )}

            {/* Instalment settings */}
            {terms.flow === 'installments' && (
              <section>
                <p className="text-[8px] uppercase tracking-[0.5em] mb-4" style={{ color: '#c9a84c' }}>Instalment Settings</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] text-zinc-500 w-40">Number of instalments</label>
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={terms.installment_count}
                      onChange={e => setTerms(prev => ({ ...prev, installment_count: Number(e.target.value) }))}
                      className="w-20 border border-zinc-200 px-3 py-2 text-[12px] focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] text-zinc-500 w-40">Days between each</label>
                    <input
                      type="number"
                      min={7}
                      max={90}
                      value={terms.installment_days}
                      onChange={e => setTerms(prev => ({ ...prev, installment_days: Number(e.target.value) }))}
                      className="w-20 border border-zinc-200 px-3 py-2 text-[12px] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Save */}
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <div className="flex items-center gap-6">
              <button
                onClick={save}
                disabled={saving}
                className="px-10 py-4 text-[9px] uppercase tracking-[0.4em] bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Terms'}
              </button>
              {saved && (
                <span className="text-[9px] uppercase tracking-[0.4em]" style={{ color: '#c9a84c' }}>Saved</span>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
