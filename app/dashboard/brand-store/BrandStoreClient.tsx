'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type BrandStorefront = {
  id             : string;
  slug           : string;
  display_name   : string;
  brand_name     : string;
  tagline        : string | null;
  description    : string | null;
  contact_email  : string | null;
  instagram      : string | null;
  website        : string | null;
  published      : boolean;
  custom_domain  : string | null;
  domain_verified: boolean;
};

type InventoryItem = {
  id        : number;
  title     : string | null;
  brand_name: string;
  srp       : number | null;
  image_urls: string[] | null;
  category  : string | null;
  color     : string | null;
  season    : string | null;
};

type SfProduct = {
  id            : string;
  inventory_id  : number;
  consumer_price: number | null;
  featured      : boolean;
  published     : boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safeNum(v: unknown) {
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

// ── Field ─────────────────────────────────────────────────────────────────────

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

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({ initial, onSave }: { initial: Partial<BrandStorefront> | null; onSave: (sf: BrandStorefront) => void }) {
  const [form, setForm] = useState({
    slug         : initial?.slug          ?? '',
    display_name : initial?.display_name  ?? '',
    brand_name   : initial?.brand_name    ?? '',
    tagline      : initial?.tagline       ?? '',
    description  : initial?.description   ?? '',
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
    try {
      const res  = await fetch('/api/brand-store', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(form),
      });
      // Never assume the body is JSON — a 500/redirect returns HTML and would
      // otherwise throw here and leave the button stuck on "Saving…".
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status}). Please try again.`);
        return;
      }
      if (!data.storefront) {
        setError('Save failed — unexpected response from the server.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave(data.storefront);
    } catch (err) {
      setError(err instanceof Error ? `Save failed — ${err.message}` : 'Save failed — network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-xl">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Display Name *">
          <input required value={form.display_name} onChange={e => {
            const display_name = e.target.value;
            setForm(p => ({ ...p, display_name, slug: p.slug || slugify(display_name) }));
          }} placeholder="Maison Laurent" className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300" style={{ color: '#333', fontFamily: 'system-ui' }} />
        </Field>
        <Field label="URL Slug *" hint={`linezheets.com/brand/${form.slug || 'your-brand'}`}>
          <input required value={form.slug}
                 onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))}
                 placeholder="maison-laurent"
                 className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
                 style={{ color: '#333', fontFamily: 'system-ui' }} />
        </Field>
      </div>

      <Field label="Brand Name *" hint="Must match your inventory brand name exactly">
        <input required value={form.brand_name} onChange={set('brand_name')}
               placeholder="Maison Laurent"
               className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
               style={{ color: '#333', fontFamily: 'system-ui' }} />
      </Field>

      <Field label="Tagline">
        <input value={form.tagline} onChange={set('tagline')} placeholder="Timeless pieces for the modern wardrobe"
               className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
               style={{ color: '#333', fontFamily: 'system-ui' }} />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={set('description')} rows={3}
                  placeholder="Tell your customers who you are and what defines your collection."
                  className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors resize-none placeholder:text-zinc-300"
                  style={{ color: '#333', fontFamily: 'system-ui' }} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Contact Email">
          <input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="hello@yourbrand.com"
                 className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
                 style={{ color: '#333', fontFamily: 'system-ui' }} />
        </Field>
        <Field label="Instagram">
          <input value={form.instagram} onChange={set('instagram')} placeholder="@yourbrand"
                 className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
                 style={{ color: '#333', fontFamily: 'system-ui' }} />
        </Field>
      </div>

      <Field label="Website">
        <input value={form.website} onChange={set('website')} placeholder="https://yourbrand.com"
               className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none focus:border-black transition-colors placeholder:text-zinc-300"
               style={{ color: '#333', fontFamily: 'system-ui' }} />
      </Field>

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

// ── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({
  inventory,
  published,
  onToggle,
  onPriceChange,
}: {
  inventory    : InventoryItem[];
  published    : Set<number>;
  onToggle     : (item: InventoryItem) => void;
  onPriceChange: (id: number, price: number | null) => void;
}) {
  const [search,    setSearch]    = useState('');
  const [editPrice, setEditPrice] = useState<number | null>(null);

  const filtered = inventory.filter(item => {
    const q = search.toLowerCase();
    return !q
      || String(item.title ?? '').toLowerCase().includes(q)
      || String(item.category ?? '').toLowerCase().includes(q)
      || String(item.color ?? '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 border-b border-zinc-200 pb-2 text-[12px] outline-none focus:border-black transition-colors placeholder:text-zinc-300"
          style={{ color: '#333', fontFamily: 'system-ui' }}
        />
      </div>

      <p className="text-[7.5px] uppercase tracking-[0.4em] mb-6" style={{ color: '#ccc', fontFamily: 'system-ui' }}>
        {published.size} of {inventory.length} products published · Click to add / remove
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map(item => {
          const isOn   = published.has(item.id);
          const srp    = safeNum(item.srp);
          const imgSrc = item.image_urls?.[0] ?? '';

          return (
            <div key={item.id} className="group relative cursor-pointer"
                 onClick={() => onToggle(item)}>

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

                {isOn && (
                  <div className="absolute top-2 left-2 px-2 py-0.5" style={{ background: '#c9a84c' }}>
                    <p className="text-[6.5px] uppercase tracking-[0.3em]" style={{ color: '#fff', fontFamily: 'system-ui' }}>Published</p>
                  </div>
                )}

                <div className={`absolute inset-0 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100`}
                     style={{ background: isOn ? 'rgba(0,0,0,0.5)' : 'rgba(201,168,76,0.15)' }}>
                  <p className="text-[8px] uppercase tracking-[0.4em]"
                     style={{ color: isOn ? '#fff' : '#c9a84c', fontFamily: 'system-ui' }}>
                    {isOn ? 'Remove' : '+ Publish'}
                  </p>
                </div>
              </div>

              <p className="text-[7px] uppercase tracking-[0.25em] truncate" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                {item.color ?? item.category ?? ''}
              </p>
              <p className="text-[11px] truncate" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>
                {item.title ?? ''}
              </p>

              {isOn && (
                <div className="mt-1" onClick={e => e.stopPropagation()}>
                  {editPrice === item.id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        autoFocus
                        type="number"
                        defaultValue={srp}
                        onBlur={e => {
                          const v = parseFloat(e.target.value);
                          onPriceChange(item.id, isFinite(v) ? v : null);
                          setEditPrice(null);
                        }}
                        className="w-20 border-b border-zinc-300 text-[10px] outline-none"
                        style={{ fontFamily: 'var(--font-mono)', color: '#333' }}
                      />
                      <span className="text-[8px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>USD</span>
                    </div>
                  ) : (
                    <button onClick={() => setEditPrice(item.id)}
                            className="text-[8px] hover:opacity-60 transition-opacity"
                            style={{ color: '#c9a84c', fontFamily: 'var(--font-mono)' }}>
                      ${srp.toFixed(2)} SRP ✎
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

export default function BrandStoreClient({
  initialStorefront,
  inventory,
  initialPublished,
}: {
  initialStorefront: BrandStorefront | null;
  inventory        : InventoryItem[];
  initialPublished : SfProduct[];
}) {
  const [storefront, setStorefront] = useState<BrandStorefront | null>(initialStorefront);
  const [sfProducts, setSfProducts] = useState<SfProduct[]>(initialPublished);
  const [tab, setTab]               = useState<'setup' | 'products'>('setup');

  const publishedIds = new Set(sfProducts.filter(p => p.published).map(p => p.inventory_id));

  async function toggleProduct(item: InventoryItem) {
    if (!storefront) { setTab('setup'); return; }

    if (publishedIds.has(item.id)) {
      await fetch(`/api/brand-store/products?id=${item.id}`, { method: 'DELETE' });
      setSfProducts(p => p.filter(x => x.inventory_id !== item.id));
    } else {
      const res = await fetch('/api/brand-store/products', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ inventory_id: item.id, consumer_price: item.srp }),
      });
      const { product } = await res.json();
      if (product) setSfProducts(p => [...p, product]);
    }
  }

  async function updatePrice(id: number, price: number | null) {
    await fetch('/api/brand-store/products', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ inventory_id: id, consumer_price: price }),
    });
    setSfProducts(p => p.map(x => x.inventory_id === id ? { ...x, consumer_price: price } : x));
  }

  const tabs = [
    { key: 'setup',    label: 'Store Setup' },
    { key: 'products', label: `Products (${publishedIds.size})` },
  ] as const;

  return (
    <>
      {storefront?.published && (
        <div className="mb-10 flex items-center gap-4 px-6 py-4 border border-zinc-100 bg-zinc-50">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#52b788' }} />
          <div className="flex-1">
            <p className="text-[7px] uppercase tracking-[0.4em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>Your Store is Live</p>
            <a href={`/brand/${storefront.slug}`} target="_blank"
               className="text-[12px] hover:opacity-60 transition-opacity"
               style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              linezheets.com/brand/{storefront.slug} ↗
            </a>
          </div>
          <a href="/dashboard/brand-store/editor"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            Visual Editor →
          </a>
          <a href="/dashboard/brand-store/reports"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            Reports →
          </a>
          <a href="/dashboard/brand-store/recommendations"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            Recommendations ✉ →
          </a>
          <a href="/dashboard/brand-store/promotions"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            Top Accounts ★ →
          </a>
          <a href="/dashboard/brand-store/analytics"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            Sell-Through →
          </a>
          <a href="/dashboard/brand-store/orders"
             className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
             style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            Orders →
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
          inventory={inventory}
          published={publishedIds}
          onToggle={toggleProduct}
          onPriceChange={updatePrice}
        />
      )}
    </>
  );
}
