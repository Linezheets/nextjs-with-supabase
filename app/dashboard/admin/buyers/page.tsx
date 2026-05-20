'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Buyer {
  id         : string;
  email      : string;
  store_name : string;
  status     : string;
}

interface PricingRule {
  id           : string;
  buyer_id     : string;
  rule_type    : 'global' | 'category' | 'brand' | 'sku';
  target       : string | null;
  discount_pct : number | null;
  fixed_price  : number | null;
  active       : boolean;
  note         : string | null;
}

interface VisibilityRule {
  id        : string;
  buyer_id  : string;
  rule_type : 'hide_category' | 'hide_brand' | 'hide_sku' | 'show_only_category' | 'show_only_brand';
  target    : string;
  active    : boolean;
  note      : string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRICING_RULE_TYPES = ['global', 'category', 'brand', 'sku'] as const;
const VISIBILITY_RULE_TYPES = [
  'hide_category', 'hide_brand', 'hide_sku',
  'show_only_category', 'show_only_brand',
] as const;

function label(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const gold = '#c9a84c';

// ── Sub-components ────────────────────────────────────────────────────────────

function Tag({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-[7px] uppercase tracking-[0.35em] border"
      style={{
        borderColor: active ? gold         : '#ddd',
        color       : active ? gold         : '#bbb',
        background  : active ? '#fffbf0'   : 'transparent',
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[7px] uppercase tracking-[0.5em] mb-4" style={{ color: '#bbb' }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-zinc-100 my-6" />;
}

// ── Pricing Rules Panel ───────────────────────────────────────────────────────

function PricingPanel({ buyerId }: { buyerId: string }) {
  const [rules,   setRules]   = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    rule_type   : 'global' as PricingRule['rule_type'],
    target      : '',
    discount_pct: '',
    fixed_price : '',
    note        : '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/buyers/${buyerId}/rules`);
    const json = await res.json();
    setRules(json.rules ?? []);
    setLoading(false);
  }, [buyerId]);

  useEffect(() => { load(); }, [load]);

  async function addRule() {
    setErr('');
    if (!form.discount_pct && !form.fixed_price) { setErr('Discount % or fixed price required'); return; }
    if (form.rule_type !== 'global' && !form.target) { setErr('Target required'); return; }
    setSaving(true);
    const body: Record<string, unknown> = { rule_type: form.rule_type };
    if (form.target)       body.target       = form.target;
    if (form.discount_pct) body.discount_pct = parseFloat(form.discount_pct);
    if (form.fixed_price)  body.fixed_price  = parseFloat(form.fixed_price);
    if (form.note)         body.note         = form.note;
    const res = await fetch(`/api/admin/buyers/${buyerId}/rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { setForm({ rule_type: 'global', target: '', discount_pct: '', fixed_price: '', note: '' }); load(); }
    else { const j = await res.json(); setErr(j.error ?? 'Error'); }
  }

  async function toggleRule(rule: PricingRule) {
    await fetch(`/api/admin/buyers/${buyerId}/rules`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_id: rule.id, active: !rule.active }),
    });
    load();
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/admin/buyers/${buyerId}/rules?rule_id=${ruleId}`, { method: 'DELETE' });
    load();
  }

  const inputCls = 'border border-zinc-200 px-3 py-2 text-[11px] outline-none focus:border-zinc-400 w-full bg-white';

  return (
    <div>
      <SectionHead>Pricing Rules</SectionHead>

      {/* Existing rules */}
      {loading ? (
        <p className="text-[9px] tracking-widest" style={{ color: '#ccc' }}>Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-[9px] tracking-widest mb-4" style={{ color: '#ddd' }}>No rules — standard pricing applies</p>
      ) : (
        <div className="space-y-2 mb-6">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-3 border border-zinc-100 px-4 py-3 group">
              <Tag active={r.active}>{r.rule_type}</Tag>
              {r.target && <span className="text-[10px]" style={{ color: '#666' }}>{r.target}</span>}
              <span className="text-[10px] flex-1" style={{ color: '#111' }}>
                {r.discount_pct != null ? `${r.discount_pct}% off` : ''}
                {r.fixed_price  != null ? `Fixed $${r.fixed_price}` : ''}
              </span>
              {r.note && <span className="text-[9px] hidden group-hover:inline" style={{ color: '#bbb' }}>{r.note}</span>}
              <button
                onClick={() => toggleRule(r)}
                className="text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors"
                style={{ borderColor: r.active ? '#ddd' : gold, color: r.active ? '#bbb' : gold }}
              >
                {r.active ? 'Pause' : 'Enable'}
              </button>
              <button
                onClick={() => deleteRule(r.id)}
                className="text-[8px] uppercase tracking-widest px-2 py-1 border border-zinc-100 hover:border-red-200 hover:text-red-400 transition-colors"
                style={{ color: '#ccc' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add rule form */}
      <div className="border border-zinc-100 p-5 space-y-3">
        <p className="text-[7.5px] uppercase tracking-[0.45em] mb-3" style={{ color: '#999' }}>Add Rule</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>Type</p>
            <select
              className={inputCls}
              value={form.rule_type}
              onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as PricingRule['rule_type'], target: '' }))}
            >
              {PRICING_RULE_TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
          {form.rule_type !== 'global' && (
            <div>
              <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>
                {form.rule_type === 'sku' ? 'SKU' : label(form.rule_type) + ' Name'}
              </p>
              <input
                className={inputCls}
                placeholder={form.rule_type === 'sku' ? 'e.g. LZ-BLZ-001' : `e.g. OUTERWEAR`}
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>Discount %</p>
            <input
              className={inputCls}
              type="number"
              min={0} max={100} step={0.5}
              placeholder="e.g. 15"
              value={form.discount_pct}
              onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value, fixed_price: '' }))}
            />
          </div>
          <div>
            <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>or Fixed WSP ($)</p>
            <input
              className={inputCls}
              type="number"
              min={0} step={0.01}
              placeholder="e.g. 420.00"
              value={form.fixed_price}
              onChange={e => setForm(f => ({ ...f, fixed_price: e.target.value, discount_pct: '' }))}
            />
          </div>
        </div>

        <div>
          <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>Note (optional)</p>
          <input
            className={inputCls}
            placeholder="e.g. VIP deal SS27"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
        </div>

        {err && <p className="text-[9px]" style={{ color: '#e57373' }}>{err}</p>}

        <button
          onClick={addRule}
          disabled={saving}
          className="px-6 py-2 text-[8px] uppercase tracking-[0.45em] text-white transition-opacity disabled:opacity-40"
          style={{ background: gold }}
        >
          {saving ? 'Saving…' : 'Add Rule'}
        </button>
      </div>
    </div>
  );
}

// ── Visibility Rules Panel ────────────────────────────────────────────────────

function VisibilityPanel({ buyerId }: { buyerId: string }) {
  const [rules,   setRules]   = useState<VisibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    rule_type: 'hide_category' as VisibilityRule['rule_type'],
    target   : '',
    note     : '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/buyers/${buyerId}/visibility`);
    const json = await res.json();
    setRules(json.rules ?? []);
    setLoading(false);
  }, [buyerId]);

  useEffect(() => { load(); }, [load]);

  async function addRule() {
    setErr('');
    if (!form.target) { setErr('Target required'); return; }
    setSaving(true);
    const res = await fetch(`/api/admin/buyers/${buyerId}/visibility`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_type: form.rule_type, target: form.target, note: form.note || undefined }),
    });
    setSaving(false);
    if (res.ok) { setForm({ rule_type: 'hide_category', target: '', note: '' }); load(); }
    else { const j = await res.json(); setErr(j.error ?? 'Error'); }
  }

  async function toggleRule(rule: VisibilityRule) {
    await fetch(`/api/admin/buyers/${buyerId}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_id: rule.id, active: !rule.active }),
    });
    load();
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/admin/buyers/${buyerId}/visibility?rule_id=${ruleId}`, { method: 'DELETE' });
    load();
  }

  const isWhitelist = (t: string) => t.startsWith('show_only_');
  const inputCls = 'border border-zinc-200 px-3 py-2 text-[11px] outline-none focus:border-zinc-400 w-full bg-white';

  return (
    <div>
      <SectionHead>Visibility Rules</SectionHead>
      <p className="text-[9px] mb-5" style={{ color: '#bbb' }}>
        <strong style={{ color: '#aaa' }}>hide_*</strong> blocks matching items.
        {' '}<strong style={{ color: '#aaa' }}>show_only_*</strong> whitelists — if any show_only rule exists, only matching items are shown for that dimension.
      </p>

      {loading ? (
        <p className="text-[9px] tracking-widest" style={{ color: '#ccc' }}>Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-[9px] tracking-widest mb-4" style={{ color: '#ddd' }}>No rules — full catalog visible</p>
      ) : (
        <div className="space-y-2 mb-6">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-3 border border-zinc-100 px-4 py-3 group">
              <Tag active={r.active && !isWhitelist(r.rule_type)}>{r.rule_type}</Tag>
              <span className="text-[10px] flex-1" style={{ color: '#666' }}>{r.target}</span>
              {r.note && <span className="text-[9px] hidden group-hover:inline" style={{ color: '#bbb' }}>{r.note}</span>}
              <button
                onClick={() => toggleRule(r)}
                className="text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors"
                style={{ borderColor: r.active ? '#ddd' : gold, color: r.active ? '#bbb' : gold }}
              >
                {r.active ? 'Pause' : 'Enable'}
              </button>
              <button
                onClick={() => deleteRule(r.id)}
                className="text-[8px] uppercase tracking-widest px-2 py-1 border border-zinc-100 hover:border-red-200 hover:text-red-400 transition-colors"
                style={{ color: '#ccc' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-zinc-100 p-5 space-y-3">
        <p className="text-[7.5px] uppercase tracking-[0.45em] mb-3" style={{ color: '#999' }}>Add Rule</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>Type</p>
            <select
              className={inputCls}
              value={form.rule_type}
              onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as VisibilityRule['rule_type'] }))}
            >
              {VISIBILITY_RULE_TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>
              {form.rule_type.includes('sku') ? 'SKU' : form.rule_type.includes('brand') ? 'Brand Name' : 'Category Name'}
            </p>
            <input
              className={inputCls}
              placeholder={form.rule_type.includes('sku') ? 'e.g. LZ-BLZ-001' : form.rule_type.includes('brand') ? 'e.g. Maison Léa' : 'e.g. OUTERWEAR'}
              value={form.target}
              onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: '#bbb' }}>Note (optional)</p>
          <input
            className={inputCls}
            placeholder="e.g. Confidential line, not for this buyer"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
        </div>

        {err && <p className="text-[9px]" style={{ color: '#e57373' }}>{err}</p>}

        <button
          onClick={addRule}
          disabled={saving}
          className="px-6 py-2 text-[8px] uppercase tracking-[0.45em] text-white transition-opacity disabled:opacity-40"
          style={{ background: '#111' }}
        >
          {saving ? 'Saving…' : 'Add Rule'}
        </button>
      </div>
    </div>
  );
}

// ── Buyer Row / Detail ────────────────────────────────────────────────────────

function BuyerRow({ buyer }: { buyer: Buyer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-5 px-6 py-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0" style={{ color: '#aaa' }}>
          {buyer.store_name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: '#111' }}>{buyer.store_name}</p>
          <p className="text-[9px] truncate" style={{ color: '#aaa' }}>{buyer.email}</p>
        </div>
        <Tag active={buyer.status === 'active'}>{buyer.status}</Tag>
        <span className="text-[10px] ml-2" style={{ color: '#ccc' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-6 py-8 space-y-0">
          <PricingPanel    buyerId={buyer.id} />
          <Divider />
          <VisibilityPanel buyerId={buyer.id} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBuyersPage() {
  const [buyers,  setBuyers]  = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetch('/api/admin/buyers')
      .then(r => r.json())
      .then(j => { setBuyers(j.buyers ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = buyers.filter(b =>
    !search ||
    b.store_name.toLowerCase().includes(search.toLowerCase()) ||
    b.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-8 py-16">

        {/* Header */}
        <div className="mb-12">
          <p className="text-[7.5px] uppercase tracking-[0.6em] mb-3" style={{ color: gold }}>Admin</p>
          <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 400, color: '#111' }}>
            Buyer Rules
          </h1>
          <p className="text-[10px] mt-3" style={{ color: '#aaa' }}>
            Set per-buyer pricing discounts, WSP overrides, and product visibility.
          </p>
        </div>

        {/* Search */}
        <div className="border border-zinc-200 flex items-center gap-3 px-4 py-3 mb-6">
          <span className="text-[10px]" style={{ color: '#ccc' }}>⌕</span>
          <input
            className="flex-1 text-[11px] outline-none bg-transparent placeholder:text-zinc-300"
            style={{ color: '#333' }}
            placeholder="Search buyers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Buyer list */}
        {loading ? (
          <p className="text-[9px] uppercase tracking-widest" style={{ color: '#ccc' }}>Loading buyers…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[9px] uppercase tracking-widest" style={{ color: '#ccc' }}>
            {search ? 'No buyers match' : 'No buyers found'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(b => <BuyerRow key={b.id} buyer={b} />)}
          </div>
        )}

      </div>
    </div>
  );
}
