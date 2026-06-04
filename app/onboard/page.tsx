'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['Womenswear', 'Menswear', 'Accessories', 'Footwear', 'Childrenswear', 'Lingerie', 'Swimwear', 'Sportswear', 'Outerwear', 'Denim'];
const SEGMENTS   = ['Luxury', 'Contemporary', 'Premium', 'Mid-market', 'Accessible'];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '',
    city: '', country: '', store_url: '',
    instagram: '', linkedin: '',
    store_type: '', market_segment: '',
    categories_sold: [] as string[],
    price_range_min: '', price_range_max: '',
    annual_buy_budget: '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleCategory = (c: string) =>
    set('categories_sold', form.categories_sold.includes(c)
      ? form.categories_sold.filter(x => x !== c)
      : [...form.categories_sold, c]);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/buyers/activate', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      router.push('/pending-approval');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none focus:border-zinc-400 transition-colors';
  const labelCls = 'block text-[7.5px] uppercase tracking-[0.4em] mb-2 text-zinc-400';

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 flex items-center h-[60px]">
          <span style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 15, letterSpacing: '0.5em' }}>LINEZHEETS</span>
          <span className="ml-auto text-[8px] uppercase tracking-[0.5em] text-zinc-300">Setup Profile</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-16">
        <p className="text-[8px] uppercase tracking-[0.6em] mb-4" style={{ color: '#c9a84c' }}>
          Step {step} of 2
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 400, color: '#0a0a0a', lineHeight: 1 }}>
          {step === 1 ? 'Your Details' : 'Buying Profile'}
        </h1>

        <div className="mt-10 space-y-5">
          {step === 1 && <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name</label>
                <input className={inputCls} value={form.first_name} onChange={e => set('first_name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input className={inputCls} value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={inputCls} value={form.country} onChange={e => set('country', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Store / Website URL</label>
              <input className={inputCls} type="url" value={form.store_url} onChange={e => set('store_url', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <label className={labelCls}>LinkedIn</label>
                <input className={inputCls} value={form.linkedin} onChange={e => set('linkedin', e.target.value)} />
              </div>
            </div>
          </>}

          {step === 2 && <>
            <div>
              <label className={labelCls}>Store Type</label>
              <select className={inputCls} value={form.store_type} onChange={e => set('store_type', e.target.value)}>
                <option value="">Select…</option>
                {['Boutique', 'Department Store', 'Online Retailer', 'Multi-brand', 'Concept Store', 'Pop-up'].map(t =>
                  <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Market Segment</label>
              <select className={inputCls} value={form.market_segment} onChange={e => set('market_segment', e.target.value)}>
                <option value="">Select…</option>
                {SEGMENTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Categories You Buy</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleCategory(c)}
                    className="px-3 py-1.5 text-[9px] uppercase tracking-widest border transition-colors"
                    style={{
                      borderColor: form.categories_sold.includes(c) ? '#c9a84c' : '#e4e4e7',
                      color      : form.categories_sold.includes(c) ? '#c9a84c' : '#888',
                      background : form.categories_sold.includes(c) ? 'rgba(201,168,76,0.08)' : 'transparent',
                    }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Price Range Min (USD)</label>
                <input className={inputCls} type="number" value={form.price_range_min} onChange={e => set('price_range_min', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Price Range Max (USD)</label>
                <input className={inputCls} type="number" value={form.price_range_max} onChange={e => set('price_range_max', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Annual Buy Budget (USD)</label>
              <input className={inputCls} type="number" value={form.annual_buy_budget} onChange={e => set('annual_buy_budget', e.target.value)} />
            </div>
          </>}
        </div>

        {error && <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-red-600">{error}</p>}

        <div className="mt-8 flex gap-3">
          {step === 2 && (
            <button onClick={() => setStep(1)}
              className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] border border-zinc-200 text-zinc-500 hover:border-zinc-400 transition-colors">
              Back
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(2)}
              className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] text-white"
              style={{ background: '#111' }}>
              Continue
            </button>
          )}
          {step === 2 && (
            <button onClick={submit} disabled={loading}
              className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] text-white disabled:opacity-40"
              style={{ background: '#111' }}>
              {loading ? 'Saving…' : 'Complete Setup'}
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-zinc-400">
          <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-600 transition-colors">
            Skip for now →
          </button>
        </p>
      </div>
    </div>
  );
}
