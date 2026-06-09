'use client';

import { useState } from 'react';

const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const GOLD  = '#c9a84c';

type Settings = {
  default_margin_pct?  : number;
  min_margin_pct?      : number;
  target_markup?       : number;
  currency?            : string;
  payment_terms_days?  : number;
  discount_tiers?      : { min_order: number; discount_pct: number }[];
  [key: string]: unknown;
};

export default function MarginSettingsClient({ initial }: { initial?: Settings | null }) {
  const [form, setForm]   = useState<Settings>({ default_margin_pct: 50, min_margin_pct: 30, target_markup: 2.5, currency: 'USD', payment_terms_days: 30, discount_tiers: [], ...(initial ?? {}) });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const res  = await fetch('/api/brand/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  const field = (label: string, key: keyof Settings, type: 'number' | 'text' | 'select', opts?: string[]) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>{label}</span>
      {type === 'select' ? (
        <select value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ padding: '10px 12px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none', background: '#fff' }}>
          {opts?.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          style={{ padding: '10px 12px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none' }} />
      )}
    </label>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '36px 64px 28px' }}>
        <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>Brand Store / Margins</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: '#111', marginBottom: 4 }}>Margin Settings</h1>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Set your wholesale margins, markups, and volume discount tiers.</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ background: saving ? '#ccc' : '#111', color: '#fff', border: 'none', padding: '10px 24px', fontFamily: SANS, fontSize: 8.5, letterSpacing: '0.3em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer' }}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ padding: '40px 64px', maxWidth: 760 }}>
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 400, color: '#111', marginBottom: 24 }}>Pricing Defaults</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {field('Default Margin %', 'default_margin_pct', 'number')}
            {field('Minimum Margin %', 'min_margin_pct', 'number')}
            {field('Target Markup (×)', 'target_markup', 'number')}
            {field('Default Currency', 'currency', 'select', ['USD','EUR','GBP','HKD','JPY','CNY'])}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 400, color: '#111', marginBottom: 8 }}>Payment Terms</h2>
          <p style={{ fontFamily: SANS, fontSize: 12, color: '#888', marginBottom: 24 }}>Default NET payment window for wholesale invoices.</p>
          <div style={{ maxWidth: 280 }}>
            {field('Payment Terms (days NET)', 'payment_terms_days', 'number')}
          </div>
        </div>

        <div style={{ background: '#fff9ee', border: `1px solid rgba(201,168,76,0.25)`, padding: '20px 24px' }}>
          <p style={{ fontFamily: SANS, fontSize: 12, color: '#555' }}>
            <span style={{ color: GOLD, fontWeight: 600 }}>✦ Tip:</span> Set volume discount tiers in{' '}
            <a href="/dashboard/brand-store/payment-terms" style={{ color: GOLD }}>Sales Terms</a> to automatically apply discounts for large orders.
          </p>
        </div>
      </div>
    </div>
  );
}
