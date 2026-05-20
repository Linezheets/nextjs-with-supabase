'use client';

import { useState } from 'react';
import type { CatalogItem } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Storefront = {
  id           : string;
  slug         : string;
  name         : string;
  tagline      : string | null;
  description  : string | null;
  accent_color : string;
  contact_email: string | null;
  instagram    : string | null;
  website      : string | null;
  published    : boolean;
};

type SfProduct = {
  id             : string;
  catalog_item_id: string;
  consumer_price : number | null;
  featured       : boolean;
  published      : boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safeNum(v: unknown) {
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({
  initial,
  onSave,
}: {
  initial  : Partial<Storefront> | null;
  onSave   : (sf: Storefront) => void;
}) {
  const [form, setForm] = useState({
    slug         : initial?.slug          ?? '',
    name         : initial?.name          ?? '',
    tagline      : initial?.tagline       ?? '',
    description  : initial?.description  ?? '',
    accent_color : initial?.accent_color  ?? '#000000',
    contact_email: initial?.contact_email ?? '',
    instagram    : initial?.instagram     ?? '',
    website      : initial?.website       ?? '',
    published    : initial?.published     ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [saved,  setSaved]  = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/store', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave(data.storefront);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-xl">

      {/* Name + slug */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Store Name *">
          <input required value={form.name} onChange={e => {
            const name = e.target.value;
            setForm(p => ({ ...p, name, slug: p.slug || slugify(name) }));
          }} placeholder="Maison Dupont" />
        </Field>
        <Field label="URL Slug *" hint={`linezheets.com/store/${form.slug || 'your-store'}`}>
          <input required value={form.slug}
                 onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))}
                 placeholder="maison-dupont" />
        </Field>
      </div>

      <Field label="Tagline">
        <input value={form.tagline} onChange={set('tagline')} placeholder="Curated luxury for the discerning few" />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={set('description')} rows={3}
                  placeholder="Tell your customers who you are and what makes your curation special."
                  className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none
                             focus:border-black transition-colors resize-none placeholder:text-zinc-300"
                  style={{ color: '#333', fontFamily: 'system-ui' }} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Contact Email">
          <input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="hello@yourstore.com" />
        </Field>
        <Field label="Accent Colour">
          <div className="flex items-center gap-3">
            <input type="color" value={form.accent_color}
                   onChange={e => setForm(p => ({ ...p, accent_color: e.target.value }))}
                   className="w-10 h-10 border-0 bg-transparent cursor-pointer" />
            <span className="text-[11px]" style={{ color: '#888', fontFamily: 'system-ui' }}>{form.accent_color}</span>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Instagram">
          <input value={form.instagram} onChange={set('instagram')} placeholder="@yourstore" />
        </Field>
        <Field label="Website">
          <input value={form.website} onChange={set('website')} placeholder="https://yourstore.com" />
        </Field>
      </div>

      {/* Publish toggle */}
      <div className="flex items-center justify-between pt-4 pb-2 border-t border-zinc-100">
        <div>
          <p className="text-[8px] uppercase tracking-[0.4em] mb-1" style={{ color: '#888', fontFamily: 'system-ui' }}>Store Status</p>
          <p className="text-[11px]" style={{ color: form.published ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
            {form.published ? 'Published — visible to the public' : 'Draft — only you can see it'}
          </p>
        </div>
        <button type="button" onClick={() => setForm(p => ({ ...p, published: !p.published }))}
                className="w-12 h-6 relative transition-colors"
                style={{ background: form.published ? '#52b788' : '#e0e0e0', borderRadius: '12px' }}>
          <span className="absolute top-1 w-4 h-4 bg-white transition-all"
                style={{ left: form.published ? '26px' : '4px', borderRadius: '8px' }} />
        </button>
      </div>

      {error && <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#c0392b', fontFamily: 'system-ui' }}>{error}</p>}

      <button type="submit" disabled={saving}
              className="px-10 py-3 text-[8.5px] uppercase tracking-[0.5em] text-white disabled:opacity-40 transition-opacity"
              style={{ background: '#111', fontFamily: 'system-ui' }}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Store'}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
        {label}
      </label>
      {hint && <p className="text-[8px] mb-2" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>{hint}</p>}
      {children}
    </div>
  );
}

// ── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({
  catalog,
  published,
  onToggle,
  onPriceChange,
  onFeature,
}: {
  catalog      : CatalogItem[];
  published    : Set<string>;
  onToggle     : (id: string, item: CatalogItem) => void;
  onPriceChange: (id: string, price: number | null) => void;
  onFeature    : (id: string, featured: boolean) => void;
}) {
  const [search,   setSearch]   = useState('');
  const [editPrice, setEditPrice] = useState<string | null>(null);

  const filtered = catalog.filter(item => {
    const q = search.toLowerCase();
    return !q
      || String(item.title ?? '').toLowerCase().includes(q)
      || String(item.brand_name ?? '').toLowerCase().includes(q)
      || String(item.category ?? '').toLowerCase().includes(q);
  });

  const brands = [...new Set(catalog.map(i => String(i.brand_name ?? '')).filter(Boolean))].sort();
  const [activeBrand, setActiveBrand] = useState('All');

  const shown = activeBrand === 'All' ? filtered : filtered.filter(i => i.brand_name === activeBrand);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 border-b border-zinc-200 pb-2 text-[12px] outline-none focus:border-black transition-colors placeholder:text-zinc-300"
          style={{ color: '#333', fontFamily: 'system-ui' }}
        />
        <div className="flex gap-3 flex-wrap">
          {['All', ...brands].map(b => (
            <button key={b} onClick={() => setActiveBrand(b)}
                    className="text-[7.5px] uppercase tracking-[0.3em] pb-0.5 transition-colors"
                    style={{
                      fontFamily  : 'system-ui',
                      color       : activeBrand === b ? '#111' : '#bbb',
                      borderBottom: activeBrand === b ? '1px solid #111' : '1px solid transparent',
                    }}>
              {b}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[7.5px] uppercase tracking-[0.4em] mb-6" style={{ color: '#ccc', fontFamily: 'system-ui' }}>
        {published.size} of {catalog.length} products published · Click to add / remove
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {shown.map(item => {
          const id        = String(item.id);
          const isOn      = published.has(id);
          const retail    = safeNum(item.retail_price ?? item.price_usd);
          const imgSrc    = String(item.image_url ?? (Array.isArray(item.image_urls) ? item.image_urls[0] : '') ?? '');

          return (
            <div key={id} className="group relative cursor-pointer"
                 onClick={() => onToggle(id, item)}>

              {/* Image */}
              <div className="relative aspect-[2/3] bg-zinc-50 mb-2 overflow-hidden"
                   style={{ outline: isOn ? '2px solid #c9a84c' : '2px solid transparent', outlineOffset: '2px' }}>
                {imgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc} alt={String(item.title ?? '')}
                       className={`w-full h-full object-cover transition-all duration-500 ${isOn ? '' : 'grayscale opacity-50 group-hover:opacity-80'}`} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-px bg-zinc-200" />
                  </div>
                )}

                {/* Published badge */}
                {isOn && (
                  <div className="absolute top-2 left-2 px-2 py-0.5"
                       style={{ background: '#c9a84c' }}>
                    <p className="text-[6.5px] uppercase tracking-[0.3em]" style={{ color: '#fff', fontFamily: 'system-ui' }}>Published</p>
                  </div>
                )}

                {/* Hover overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isOn ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                     style={{ background: isOn ? 'rgba(0,0,0,0.5)' : 'rgba(201,168,76,0.15)' }}>
                  <p className="text-[8px] uppercase tracking-[0.4em]"
                     style={{ color: isOn ? '#fff' : '#c9a84c', fontFamily: 'system-ui' }}>
                    {isOn ? 'Remove' : '+ Publish'}
                  </p>
                </div>
              </div>

              {/* Info */}
              <p className="text-[7px] uppercase tracking-[0.25em] truncate"
                 style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                {String(item.brand_name ?? '')}
              </p>
              <p className="text-[11px] truncate"
                 style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>
                {String(item.title ?? '')}
              </p>

              {/* Price controls (only when published) */}
              {isOn && (
                <div className="mt-1" onClick={e => e.stopPropagation()}>
                  {editPrice === id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        autoFocus
                        type="number"
                        defaultValue={retail}
                        onBlur={e => {
                          const v = parseFloat(e.target.value);
                          onPriceChange(id, isFinite(v) ? v : null);
                          setEditPrice(null);
                        }}
                        className="w-20 border-b border-zinc-300 text-[10px] outline-none"
                        style={{ fontFamily: 'var(--font-mono)', color: '#333' }}
                      />
                      <span className="text-[8px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>USD</span>
                    </div>
                  ) : (
                    <button onClick={() => setEditPrice(id)}
                            className="text-[8px] hover:opacity-60 transition-opacity"
                            style={{ color: '#c9a84c', fontFamily: 'var(--font-mono)' }}>
                      ${retail.toFixed(2)} ✎
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StoreClient({
  initialStorefront,
  catalog,
  initialPublished,
}: {
  initialStorefront: Storefront | null;
  catalog          : CatalogItem[];
  initialPublished : SfProduct[];
}) {
  const [storefront, setStorefront] = useState<Storefront | null>(initialStorefront);
  const [sfProducts, setSfProducts] = useState<SfProduct[]>(initialPublished);
  const [tab, setTab]               = useState<'setup' | 'products'>('setup');

  const publishedIds = new Set(sfProducts.filter(p => p.published).map(p => p.catalog_item_id));

  async function toggleProduct(id: string, item: CatalogItem) {
    if (!storefront) { setTab('setup'); return; }

    if (publishedIds.has(id)) {
      await fetch(`/api/store/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSfProducts(p => p.filter(x => x.catalog_item_id !== id));
    } else {
      const retail = safeNum(item.retail_price ?? item.price_usd);
      const res = await fetch('/api/store/products', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ catalog_item_id: id, consumer_price: retail }),
      });
      const { product } = await res.json();
      if (product) setSfProducts(p => [...p, product]);
    }
  }

  async function updatePrice(id: string, price: number | null) {
    await fetch('/api/store/products', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ catalog_item_id: id, consumer_price: price }),
    });
    setSfProducts(p => p.map(x => x.catalog_item_id === id ? { ...x, consumer_price: price } : x));
  }

  async function toggleFeature(id: string, featured: boolean) {
    await fetch('/api/store/products', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ catalog_item_id: id, featured }),
    });
    setSfProducts(p => p.map(x => x.catalog_item_id === id ? { ...x, featured } : x));
  }

  const tabs = [
    { key: 'setup',    label: 'Store Setup' },
    { key: 'products', label: `Products (${publishedIds.size})` },
  ] as const;

  return (
    <>
      {/* Live store link */}
      {storefront?.published && (
        <div className="mb-10 flex items-center gap-4 px-6 py-4 border border-zinc-100 bg-zinc-50">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#52b788' }} />
          <div className="flex-1">
            <p className="text-[7px] uppercase tracking-[0.4em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>Your Store is Live</p>
            <a href={`/store/${storefront.slug}`} target="_blank"
               className="text-[12px] hover:opacity-60 transition-opacity"
               style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              linezheets.com/store/{storefront.slug} ↗
            </a>
          </div>
          <a href={`/store/${storefront.slug}`} target="_blank"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            Preview →
          </a>
        </div>
      )}

      {!storefront && tab === 'products' && (
        <div className="mb-8 px-6 py-4 border border-amber-100 bg-amber-50">
          <p className="text-[11px]" style={{ color: '#b45309', fontFamily: 'system-ui' }}>
            Complete your store setup first before selecting products.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-8 mb-12 border-b border-zinc-100">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className="pb-4 text-[8px] uppercase tracking-[0.4em] transition-colors"
                  style={{
                    fontFamily  : 'system-ui',
                    color       : tab === t.key ? '#111' : '#bbb',
                    borderBottom: tab === t.key ? '1px solid #111' : '1px solid transparent',
                  }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'setup' && (
        <SetupForm initial={storefront} onSave={sf => { setStorefront(sf); setTab('products'); }} />
      )}

      {tab === 'products' && (
        <ProductPicker
          catalog={catalog}
          published={publishedIds}
          onToggle={toggleProduct}
          onPriceChange={updatePrice}
          onFeature={toggleFeature}
        />
      )}
    </>
  );
}
