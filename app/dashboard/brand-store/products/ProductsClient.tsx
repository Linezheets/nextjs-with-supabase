'use client';

import { useState } from 'react';

type Product = {
  id           : number;
  title        : string;
  sku          : string | null;
  category     : string;
  season       : string | null;
  color        : string | null;
  wsp_usd      : number;
  srp          : number;
  stock_total  : number;
  moq          : number;
  status       : string;
  image_urls   : string[];
  description  : string | null;
  delivery_window: string | null;
  tags         : string[];
  [key: string]: unknown;
};

type Props = {
  initialProducts: Record<string, unknown>[];
  brandName      : string;
  tier           : string;
};

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active  : { bg: '#f0faf4', color: '#2d7a4f' },
  draft   : { bg: '#f5f5f5', color: '#888'    },
  archived: { bg: '#fff0f0', color: '#c0392b' },
};

const CATEGORIES = ['TOPS','BOTTOMS','DRESSES','OUTERWEAR','KNITWEAR','ACCESSORIES','BAGS','SHOES','GENERAL'];

const EMPTY: Product = {
  id: 0, title: '', sku: '', category: 'GENERAL', season: '', color: '',
  wsp_usd: 0, srp: 0, stock_total: 0, moq: 1, status: 'active',
  image_urls: [], description: '', delivery_window: '', tags: [],
};

export default function ProductsClient({ initialProducts, brandName, tier }: Props) {
  const [products, setProducts]   = useState<Product[]>(initialProducts as Product[]);
  const [modal, setModal]         = useState<'none' | 'create' | 'edit'>('none');
  const [form, setForm]           = useState<Product>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const visible = products.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function openCreate() {
    setForm(EMPTY);
    setErr('');
    setModal('create');
  }

  function openEdit(p: Product) {
    setForm({ ...p });
    setErr('');
    setModal('edit');
  }

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      const isEdit = modal === 'edit' && form.id;
      const url    = isEdit ? `/api/products/${form.id}` : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ ...form, tags: typeof form.tags === 'string' ? (form.tags as string).split(',').map(t => t.trim()).filter(Boolean) : form.tags }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      if (isEdit) {
        setProducts(ps => ps.map(p => p.id === form.id ? json.product : p));
      } else {
        setProducts(ps => [json.product, ...ps]);
      }
      setModal('none');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: number) {
    if (!confirm('Archive this product?')) return;
    const res  = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    setProducts(ps => ps.filter(p => p.id !== id));
  }

  async function quickAdjust(id: number, delta: number) {
    const res  = await fetch('/api/inventory/adjust', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ product_id: id, adjustment: delta, type: delta > 0 ? 'add' : 'subtract' }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    setProducts(ps => ps.map(p => p.id === id ? { ...p, stock_total: json.after } : p));
  }

  const maxProducts = tier === 'starter' ? 50 : -1;

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
          Brand Store / Products
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 400, color: '#111', marginBottom: 4 }}>
              Product Catalogue
            </h1>
            <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888' }}>
              {brandName} · {products.filter(p => p.status === 'active').length} active
              {maxProducts > 0 && ` / ${maxProducts} on ${tier}`}
            </p>
          </div>
          <button onClick={openCreate}
            style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + New Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '24px 64px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or SKU…"
          style={{ flex: 1, maxWidth: 320, padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, background: '#fff', outline: 'none' }}
        />
        {['all','active','draft','archived'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ background: filterStatus === s ? '#111' : '#fff', color: filterStatus === s ? '#fff' : '#888',
              border: '1px solid #e5e5e5', padding: '6px 16px', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: SANS }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: '24px 64px' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb', fontFamily: SANS, fontSize: '12px' }}>
            No products found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['Product','SKU','Category','WSP','SRP','Stock','Status',''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {p.image_urls[0] ? (
                          <img src={p.image_urls[0]} alt={p.title} style={{ width: 36, height: 36, objectFit: 'cover', background: '#f5f5f5' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, background: '#f5f5f5' }} />
                        )}
                        <span style={{ fontFamily: SERIF, fontSize: '13px', color: '#111' }}>{p.title}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '11px', color: '#888' }}>{p.sku ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontFamily: SANS, fontSize: '11px', color: '#666' }}>{p.category}</td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '12px', color: '#111' }}>{fmt(p.wsp_usd)}</td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '12px', color: '#666' }}>{fmt(p.srp)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => quickAdjust(p.id, -1)} style={{ width: 20, height: 20, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontFamily: MONO, fontSize: '12px', minWidth: 28, textAlign: 'center', color: p.stock_total === 0 ? '#df1b41' : p.stock_total < 5 ? GOLD : '#111' }}>{p.stock_total}</span>
                        <button onClick={() => quickAdjust(p.id, 1)} style={{ width: 20, height: 20, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ ...badge, padding: '3px 10px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#666', fontFamily: SANS }}>Edit</button>
                        <button onClick={() => handleArchive(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', fontFamily: SANS }}>Archive</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal !== 'none' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 40 }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
              {modal === 'create' ? 'New Product' : 'Edit Product'}
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 400, color: '#111', marginBottom: 28 }}>
              {modal === 'create' ? 'Add to Catalogue' : form.title}
            </h2>

            {err && <p style={{ color: '#df1b41', fontFamily: SANS, fontSize: '12px', marginBottom: 16 }}>{err}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {([
                ['Title *', 'title', 'text', true],
                ['SKU', 'sku', 'text', false],
                ['Wholesale Price (WSP)', 'wsp_usd', 'number', false],
                ['Retail Price (SRP)', 'srp', 'number', false],
                ['Stock Total', 'stock_total', 'number', false],
                ['MOQ', 'moq', 'number', false],
                ['Color', 'color', 'text', false],
                ['Season', 'season', 'text', false],
                ['Delivery Window', 'delivery_window', 'text', false],
              ] as [string, keyof Product, string, boolean][]).map(([label, key, type]) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>{label}</span>
                  <input
                    type={type}
                    value={String(form[key] ?? '')}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}
                  />
                </label>
              ))}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Category</span>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Status</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}>
                  {['active','draft','archived'].map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Description</span>
              <textarea
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none', resize: 'vertical' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Tags (comma-separated)</span>
              <input
                value={Array.isArray(form.tags) ? form.tags.join(', ') : String(form.tags ?? '')}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, background: saving ? '#ccc' : '#111', color: '#fff', border: 'none', padding: '12px 0', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Add Product' : 'Save Changes'}
              </button>
              <button onClick={() => setModal('none')} disabled={saving}
                style={{ padding: '12px 24px', background: '#fff', border: '1px solid #e5e5e5', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer', color: '#888' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
