'use client';

import { useState, useRef } from 'react';

type Item = {
  id         : number;
  title      : string;
  sku        : string | null;
  category   : string;
  season     : string | null;
  color      : string | null;
  stock_total: number;
  moq        : number;
  wsp_usd    : number;
  srp        : number;
  status     : string;
  image_urls : string[];
  updated_at : string;
  [key: string]: unknown;
};

type Summary = { total_skus: number; total_units: number; low_stock: number; out_of_stock: number };

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

export default function InventoryClient({
  initialItems,
  summary: initSummary,
  brandName,
  currency,
}: {
  initialItems: Record<string, unknown>[];
  summary     : Summary;
  brandName   : string;
  currency    : string;
}) {
  const [items, setItems]     = useState<Item[]>(initialItems as Item[]);
  const [summary, setSummary] = useState(initSummary);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | 'low' | 'out'>('all');
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [pending, setPending] = useState<Record<number, number>>({});
  const bulkRef = useRef<HTMLTextAreaElement>(null);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 0 }).format(n);

  const visible = items.filter(i => {
    const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.sku ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'low' ? i.stock_total > 0 && i.stock_total < 5 :
      i.stock_total === 0;
    return matchSearch && matchFilter;
  });

  async function adjust(id: number, delta: number) {
    const type = delta >= 0 ? 'add' : 'subtract';
    const res  = await fetch('/api/inventory/adjust', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ product_id: id, adjustment: Math.abs(delta), type }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    setItems(is => is.map(i => i.id === id ? { ...i, stock_total: json.after } : i));
    setSummary(s => ({ ...s, total_units: s.total_units + (json.after - json.before) }));
  }

  async function setStock(id: number, value: number) {
    const res  = await fetch('/api/inventory/adjust', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ product_id: id, adjustment: value, type: 'set' }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    const diff = json.after - json.before;
    setItems(is => is.map(i => i.id === id ? { ...i, stock_total: json.after } : i));
    setSummary(s => ({ ...s, total_units: s.total_units + diff, out_of_stock: items.filter(i => i.id !== id ? i.stock_total === 0 : json.after === 0).length }));
    setPending(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function runBulkAdjust() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const adjustments = lines.flatMap(line => {
      const [sku, qty] = line.split(/[\t,;]/);
      if (!sku || !qty) return [];
      return [{ sku: sku.trim(), stock_total: parseInt(qty.trim()) }];
    });
    if (!adjustments.length) { setBulkStatus('No valid rows parsed. Format: SKU<tab>qty per line.'); return; }

    setBulkStatus('Uploading…');
    const res  = await fetch('/api/inventory/bulk-adjust', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ adjustments }),
    });
    const json = await res.json();
    if (!res.ok) { setBulkStatus(json.error); return; }
    setBulkStatus(`Done — ${json.updated} updated, ${json.failed} failed.`);

    // Refresh inventory
    const refreshRes = await fetch('/api/inventory');
    const refreshJson = await refreshRes.json();
    if (refreshRes.ok) {
      setItems(refreshJson.inventory);
      setSummary(refreshJson.summary);
    }
  }

  const statCards = [
    { label: 'Total SKUs',   value: summary.total_skus,   color: '#111' },
    { label: 'Total Units',  value: summary.total_units,  color: '#111' },
    { label: 'Low Stock',    value: summary.low_stock,    color: GOLD   },
    { label: 'Out of Stock', value: summary.out_of_stock, color: '#df1b41' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
          Brand Store / Inventory
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 400, color: '#111' }}>
          Stock Management
        </h1>
        <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888', marginTop: 4 }}>{brandName}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#f0f0f0', margin: '32px 64px 0' }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background: '#fff', padding: '24px 28px' }}>
            <p style={{ fontFamily: SANS, fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontFamily: MONO, fontSize: '28px', color: c.color, fontWeight: 400 }}>{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: '24px 64px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search title or SKU…"
          style={{ flex: 1, maxWidth: 300, padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, outline: 'none' }}
        />
        {(['all','low','out'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? '#111' : '#fff', color: filter === f ? '#fff' : '#888',
              border: '1px solid #e5e5e5', padding: '6px 16px', fontSize: '9px', letterSpacing: '0.3em',
              textTransform: 'uppercase', cursor: 'pointer', fontFamily: SANS }}>
            {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: '24px 64px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['Product','SKU','Category','Season','WSP','Stock',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(item => {
              const stockColor = item.stock_total === 0 ? '#df1b41' : item.stock_total < 5 ? GOLD : '#111';
              const pendingVal = pending[item.id];
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.image_urls[0]
                        ? <img src={item.image_urls[0]} alt={item.title} style={{ width: 32, height: 32, objectFit: 'cover', background: '#f5f5f5' }} />
                        : <div style={{ width: 32, height: 32, background: '#f5f5f5' }} />}
                      <span style={{ fontFamily: SERIF, fontSize: '13px', color: '#111' }}>{item.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: MONO, fontSize: '11px', color: '#888' }}>{item.sku ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: SANS, fontSize: '11px', color: '#666' }}>{item.category}</td>
                  <td style={{ padding: '12px 16px', fontFamily: SANS, fontSize: '11px', color: '#666' }}>{item.season ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: MONO, fontSize: '12px', color: '#111' }}>{fmt(item.wsp_usd)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => adjust(item.id, -1)}
                        style={{ width: 22, height: 22, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>−</button>
                      <input
                        type="number" min={0}
                        value={pendingVal !== undefined ? pendingVal : item.stock_total}
                        onChange={e => setPending(p => ({ ...p, [item.id]: parseInt(e.target.value) || 0 }))}
                        onBlur={() => { if (pendingVal !== undefined) setStock(item.id, pendingVal); }}
                        onKeyDown={e => { if (e.key === 'Enter' && pendingVal !== undefined) setStock(item.id, pendingVal); }}
                        style={{ width: 52, textAlign: 'center', border: '1px solid #e5e5e5', fontFamily: MONO, fontSize: '12px', color: stockColor, padding: '2px 4px', outline: 'none' }}
                      />
                      <button onClick={() => adjust(item.id, 1)}
                        style={{ width: 22, height: 22, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {item.stock_total === 0 && (
                      <span style={{ fontFamily: SANS, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#df1b41' }}>Out of stock</span>
                    )}
                    {item.stock_total > 0 && item.stock_total < 5 && (
                      <span style={{ fontFamily: SANS, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD }}>Low stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk Import */}
      <div style={{ margin: '0 64px 64px', padding: 28, background: '#fff', border: '1px solid #f0f0f0' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 12 }}>Bulk Stock Update</p>
        <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888', marginBottom: 12 }}>Paste SKU and quantity pairs, one per line (tab or comma-separated).</p>
        <textarea
          ref={bulkRef}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={'SKU-001\t24\nSKU-002\t8\nSKU-003\t0'}
          rows={5}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e5e5', fontFamily: MONO, fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
          <button onClick={runBulkAdjust}
            style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 24px', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Apply
          </button>
          {bulkStatus && <span style={{ fontFamily: SANS, fontSize: '12px', color: bulkStatus.startsWith('Done') ? '#2d7a4f' : '#df1b41' }}>{bulkStatus}</span>}
        </div>
      </div>
    </div>
  );
}
