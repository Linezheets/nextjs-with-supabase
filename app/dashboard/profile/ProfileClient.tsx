'use client';

import { useState } from 'react';
import MFASection from '@/components/MFASection';

type BuyerProfile = {
  id          : string;
  email       : string;
  first_name  : string | null;
  last_name   : string | null;
  phone       : string | null;
  store_name  : string | null;
  store_address: string | null;
  city        : string | null;
  country     : string | null;
  vat_number  : string | null;
  tax_country : string | null;
  store_url   : string | null;
  instagram   : string | null;
  tiktok      : string | null;
  linkedin    : string | null;
  other_socials: string | null;
  store_type  : string | null;
  categories_sold: string[];
  price_range_min: number | null;
  price_range_max: number | null;
  market_segment: string | null;
  annual_buy_budget: number | null;
  status      : string | null;
};

const STORE_TYPES = ['boutique', 'department', 'online', 'multi-brand', 'concept'];
const MARKET_SEGS = ['luxury', 'premium', 'contemporary', 'streetwear', 'fast-fashion'];
const CATEGORY_OPTIONS = ['Womenswear', 'Menswear', 'Accessories', 'Footwear', 'Jewellery', 'Bags', 'RTW', 'Eveningwear', 'Swimwear', 'Kidswear'];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[7.5px] uppercase tracking-[0.45em] mb-2"
         style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </p>
      {children}
      {hint && (
        <p className="text-[7px] mt-1" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const inputCls = `w-full border border-zinc-200 px-4 py-3 text-[13px] bg-white
  focus:outline-none focus:border-zinc-500 transition-colors`;

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} style={{ fontFamily: 'system-ui, sans-serif', color: '#333' }} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const { placeholder, children, ...rest } = props;
  return (
    <select {...rest} className={inputCls} style={{ fontFamily: 'system-ui, sans-serif', color: '#333' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export default function ProfileClient({ initialProfile }: { initialProfile: BuyerProfile }) {
  const [profile, setProfile]   = useState<BuyerProfile>(initialProfile);
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  function set<K extends keyof BuyerProfile>(key: K, value: BuyerProfile[K]) {
    setProfile(p => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function toggleCategory(cat: string) {
    const current = profile.categories_sold ?? [];
    set('categories_sold',
      current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/buyers/profile', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          first_name       : profile.first_name,
          last_name        : profile.last_name,
          phone            : profile.phone,
          store_name       : profile.store_name,
          store_address    : profile.store_address,
          city             : profile.city,
          country          : profile.country,
          vat_number       : profile.vat_number,
          tax_country      : profile.tax_country,
          store_url        : profile.store_url,
          instagram        : profile.instagram,
          tiktok           : profile.tiktok,
          linkedin         : profile.linkedin,
          other_socials    : profile.other_socials,
          store_type       : profile.store_type,
          categories_sold  : profile.categories_sold,
          price_range_min  : profile.price_range_min,
          price_range_max  : profile.price_range_max,
          market_segment   : profile.market_segment,
          annual_buy_budget: profile.annual_buy_budget,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const joinDate = initialProfile
    ? undefined
    : null;
  void joinDate;

  return (
    <div className="space-y-16">

      {/* ── Personal details ──────────────────────────────────────────────── */}
      <section>
        <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
           style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          Personal Details
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="First Name">
            <Input
              value={profile.first_name ?? ''}
              onChange={e => set('first_name', e.target.value || null)}
              placeholder="First name"
            />
          </Field>
          <Field label="Last Name">
            <Input
              value={profile.last_name ?? ''}
              onChange={e => set('last_name', e.target.value || null)}
              placeholder="Last name"
            />
          </Field>
          <Field label="Email Address">
            <Input value={profile.email} disabled style={{ fontFamily: 'system-ui, sans-serif', color: '#aaa', background: '#fafafa' }} />
          </Field>
          <Field label="Phone">
            <Input
              value={profile.phone ?? ''}
              onChange={e => set('phone', e.target.value || null)}
              placeholder="+1 555 000 0000"
              type="tel"
            />
          </Field>
        </div>
      </section>

      <div className="border-t border-zinc-100" />

      {/* ── Store details ─────────────────────────────────────────────────── */}
      <section>
        <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
           style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          Store Details
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Store Name">
            <Input
              value={profile.store_name ?? ''}
              onChange={e => set('store_name', e.target.value || null)}
              placeholder="Your store"
            />
          </Field>
          <Field label="Store Type">
            <Select
              value={profile.store_type ?? ''}
              onChange={e => set('store_type', e.target.value || null)}
              placeholder="Select type"
            >
              {STORE_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Store Address">
            <Input
              value={profile.store_address ?? ''}
              onChange={e => set('store_address', e.target.value || null)}
              placeholder="Street address"
            />
          </Field>
          <Field label="City">
            <Input
              value={profile.city ?? ''}
              onChange={e => set('city', e.target.value || null)}
              placeholder="City"
            />
          </Field>
          <Field label="Country">
            <Input
              value={profile.country ?? ''}
              onChange={e => set('country', e.target.value || null)}
              placeholder="Country"
            />
          </Field>
          <Field label="VAT / Tax Number" hint="Your business VAT registration number for cross-border wholesale invoicing">
            <Input
              value={profile.vat_number ?? ''}
              onChange={e => set('vat_number', e.target.value || null)}
              placeholder="e.g. GB123456789, FR12345678901"
            />
          </Field>
          <Field label="Store Website">
            <Input
              value={profile.store_url ?? ''}
              onChange={e => set('store_url', e.target.value || null)}
              placeholder="https://"
              type="url"
            />
          </Field>
        </div>
      </section>

      <div className="border-t border-zinc-100" />

      {/* ── Buying profile ────────────────────────────────────────────────── */}
      <section>
        <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
           style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          Buying Profile
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Market Segment">
            <Select
              value={profile.market_segment ?? ''}
              onChange={e => set('market_segment', e.target.value || null)}
              placeholder="Select segment"
            >
              {MARKET_SEGS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Annual Buy Budget (USD)">
            <Input
              value={profile.annual_buy_budget ?? ''}
              onChange={e => set('annual_buy_budget', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0"
              type="number"
              min="0"
            />
          </Field>
          <Field label="Wholesale Price Range — Min (USD)">
            <Input
              value={profile.price_range_min ?? ''}
              onChange={e => set('price_range_min', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0"
              type="number"
              min="0"
            />
          </Field>
          <Field label="Wholesale Price Range — Max (USD)">
            <Input
              value={profile.price_range_max ?? ''}
              onChange={e => set('price_range_max', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0"
              type="number"
              min="0"
            />
          </Field>
        </div>

        <div className="mt-6">
          <Field label="Categories Carried">
            <div className="flex flex-wrap gap-2 mt-1">
              {CATEGORY_OPTIONS.map(cat => {
                const active = (profile.categories_sold ?? []).includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="text-[8px] uppercase tracking-[0.3em] px-4 py-2 border transition-colors duration-150"
                    style={{
                      fontFamily  : 'system-ui, sans-serif',
                      borderColor : active ? '#111' : '#e4e4e4',
                      background  : active ? '#111' : '#fff',
                      color       : active ? '#fff' : '#888',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </section>

      <div className="border-t border-zinc-100" />

      {/* ── Social / web presence ─────────────────────────────────────────── */}
      <section>
        <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
           style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          Social Presence
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Instagram">
            <Input
              value={profile.instagram ?? ''}
              onChange={e => set('instagram', e.target.value || null)}
              placeholder="@handle"
            />
          </Field>
          <Field label="TikTok">
            <Input
              value={profile.tiktok ?? ''}
              onChange={e => set('tiktok', e.target.value || null)}
              placeholder="@handle"
            />
          </Field>
          <Field label="LinkedIn">
            <Input
              value={profile.linkedin ?? ''}
              onChange={e => set('linkedin', e.target.value || null)}
              placeholder="linkedin.com/in/..."
            />
          </Field>
          <Field label="Other">
            <Input
              value={profile.other_socials ?? ''}
              onChange={e => set('other_socials', e.target.value || null)}
              placeholder="Other URL or handle"
            />
          </Field>
        </div>
      </section>

      <div className="border-t border-zinc-100" />

      <MFASection />

      <div className="border-t border-zinc-100" />

      {/* ── Save bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-12 py-[14px] text-[8.5px] uppercase tracking-[0.5em] bg-black text-white
                     hover:bg-zinc-800 disabled:opacity-40 transition-colors duration-200"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>

        {saved && (
          <p className="text-[8px] uppercase tracking-[0.3em]"
             style={{ color: '#52b788', fontFamily: 'system-ui, sans-serif' }}>
            Saved
          </p>
        )}
        {error && (
          <p className="text-[8px] uppercase tracking-[0.3em]"
             style={{ color: '#e07070', fontFamily: 'system-ui, sans-serif' }}>
            {error}
          </p>
        )}
      </div>

    </div>
  );
}
