'use client';

import { useState, useEffect, useCallback } from 'react';
import { TIER_COLORS, TIER_LABELS, type TopAccount, type AccountTier } from '@/lib/top-accounts';

// ── Types ─────────────────────────────────────────────────────────────────────

type Promotion = {
  id            : string;
  name          : string;
  headline      : string;
  description   : string | null;
  promo_type    : string;
  discount_pct  : number;
  min_qty       : number | null;
  min_spend     : number | null;
  target_category: string | null;
  min_tier      : string;
  product_ids   : number[];
  expires_at    : string | null;
  active        : boolean;
  total_assigned: number;
  created_at    : string;
};

type Assignment = {
  id           : string;
  buyer_id     : string;
  buyer_email  : string;
  store_name   : string;
  city         : string | null;
  country      : string;
  account_tier : AccountTier;
  account_score: number;
  status       : string;
  email_sent   : boolean;
  assigned_at  : string;
};

type InventoryItem = {
  id       : number;
  name     : string;
  image_url: string | null;
  wsp_usd  : number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PROMO_TYPES = [
  { value: 'volume_discount',  label: 'Volume Discount',   hint: 'Buy min qty → % off' },
  { value: 'spend_threshold',  label: 'Spend Threshold',   hint: 'Spend min amount → % off' },
  { value: 'category_deal',    label: 'Category Deal',     hint: '% off a specific category' },
  { value: 'loyalty_reward',   label: 'Loyalty Reward',    hint: 'Flat % off everything' },
];

const MIN_TIERS: { value: string; label: string }[] = [
  { value: 'silver',   label: 'Silver+' },
  { value: 'gold',     label: 'Gold+' },
  { value: 'platinum', label: 'Platinum only' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: AccountTier }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[8px] uppercase tracking-[0.25em] font-medium"
          style={{ background: TIER_COLORS[tier] + '22', color: TIER_COLORS[tier], fontFamily: 'system-ui' }}>
      {TIER_LABELS[tier]}
    </span>
  );
}

function ScoreBar({ score, breakdown }: { score: number; breakdown?: TopAccount['score_breakdown'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: '#c9a84c' }} />
      </div>
      <span className="text-[9px] tabular-nums" style={{ color: '#888', fontFamily: 'DM Mono, monospace' }}>
        {score}
      </span>
      {breakdown && (
        <span className="text-[8px]" style={{ color: '#555', fontFamily: 'system-ui' }}>
          A{breakdown.affinity} M{breakdown.match} $S{breakdown.spend} L{breakdown.loyalty}
        </span>
      )}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Account List ──────────────────────────────────────────────────────────────

function AccountList({
  accounts,
  selected,
  onToggle,
  minTier,
}: {
  accounts: TopAccount[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  minTier: string;
}) {
  const tierOrder: AccountTier[] = ['rising', 'silver', 'gold', 'platinum'];
  const minIdx = tierOrder.indexOf(minTier as AccountTier);

  const filtered = accounts.filter(a => tierOrder.indexOf(a.tier) >= minIdx);
  const rest = accounts.filter(a => tierOrder.indexOf(a.tier) < minIdx);

  return (
    <div>
      {filtered.length === 0 && (
        <p className="text-[10px] py-4 text-center" style={{ color: '#555', fontFamily: 'system-ui' }}>
          No accounts meet the minimum tier requirement.
        </p>
      )}
      {filtered.map(a => (
        <button
          key={a.id}
          onClick={() => onToggle(a.id)}
          className="w-full text-left px-4 py-3 border-b transition-colors"
          style={{
            borderColor: '#1e1e1e',
            background: selected.has(a.id) ? '#1a1a12' : 'transparent',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-4 h-4 border flex-shrink-0 flex items-center justify-center"
                   style={{ borderColor: selected.has(a.id) ? '#c9a84c' : '#333',
                            background: selected.has(a.id) ? '#c9a84c' : 'transparent' }}>
                {selected.has(a.id) && <span style={{ color: '#000', fontSize: 9 }}>✓</span>}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium truncate" style={{ color: '#fff', fontFamily: 'system-ui' }}>
                  {a.store_name}
                </div>
                <div className="text-[9px] truncate" style={{ color: '#666', fontFamily: 'system-ui' }}>
                  {a.email}{a.city ? ` · ${a.city}` : ''}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <TierBadge tier={a.tier} />
              <div className="mt-1 text-[8px]" style={{ color: '#555', fontFamily: 'DM Mono, monospace' }}>
                {fmt(a.total_spend)} · {a.total_orders} orders
              </div>
            </div>
          </div>
          <div className="mt-2 pl-6">
            <ScoreBar score={a.score} breakdown={a.score_breakdown} />
          </div>
        </button>
      ))}
      {rest.length > 0 && (
        <div className="px-4 py-2 text-[8px] uppercase tracking-[0.3em]" style={{ color: '#333', fontFamily: 'system-ui' }}>
          {rest.length} account{rest.length > 1 ? 's' : ''} below minimum tier (not eligible)
        </div>
      )}
    </div>
  );
}

// ── Create Promotion Form ─────────────────────────────────────────────────────

function CreatePromoForm({
  onCreated,
  inventory,
}: {
  onCreated: (p: Promotion) => void;
  inventory: InventoryItem[];
}) {
  const [form, setForm] = useState({
    name: '',
    headline: '',
    description: '',
    promo_type: 'volume_discount',
    discount_pct: 10,
    min_qty: '',
    min_spend: '',
    target_category: '',
    min_tier: 'silver',
    expires_at: '',
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name || !form.headline) { setError('Name and headline required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/brand/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount_pct: Number(form.discount_pct),
          min_qty: form.min_qty ? Number(form.min_qty) : null,
          min_spend: form.min_spend ? Number(form.min_spend) : null,
          target_category: form.target_category || null,
          expires_at: form.expires_at || null,
          product_ids: Array.from(selectedProducts),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create'); return; }
      onCreated(data);
      setForm({ name: '', headline: '', description: '', promo_type: 'volume_discount',
                discount_pct: 10, min_qty: '', min_spend: '', target_category: '',
                min_tier: 'silver', expires_at: '' });
      setSelectedProducts(new Set());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="text-[9px] uppercase tracking-[0.4em] mb-5" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
        New Promotion
      </h3>

      {/* Promo type */}
      <div className="mb-4">
        <label className="block text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#666', fontFamily: 'system-ui' }}>Type</label>
        <div className="grid grid-cols-2 gap-2">
          {PROMO_TYPES.map(pt => (
            <button key={pt.value} onClick={() => set('promo_type', pt.value)}
                    className="px-3 py-2 border text-left transition-colors"
                    style={{
                      borderColor: form.promo_type === pt.value ? '#c9a84c' : '#2a2a2a',
                      background: form.promo_type === pt.value ? '#1a1a12' : 'transparent',
                    }}>
              <div className="text-[9px] font-medium" style={{ color: form.promo_type === pt.value ? '#c9a84c' : '#ccc', fontFamily: 'system-ui' }}>{pt.label}</div>
              <div className="text-[8px]" style={{ color: '#555', fontFamily: 'system-ui' }}>{pt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Internal name */}
      <div className="mb-3">
        <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Internal Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SS26 Gold Launch Deal"
               className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
               style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
      </div>

      {/* Headline */}
      <div className="mb-3">
        <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Buyer-Facing Headline</label>
        <input value={form.headline} onChange={e => set('headline', e.target.value)} placeholder="e.g. Exclusive 15% Off for Gold Partners"
               className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
               style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Description (optional)</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                  placeholder="Additional context for the buyer…"
                  className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none resize-none"
                  style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
      </div>

      {/* Mechanics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Discount %</label>
          <input type="number" value={form.discount_pct} onChange={e => set('discount_pct', e.target.value)} min={1} max={80}
                 className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
                 style={{ borderColor: '#2a2a2a', color: '#c9a84c', fontFamily: 'DM Mono, monospace' }} />
        </div>
        {form.promo_type === 'volume_discount' && (
          <div>
            <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Min Qty</label>
            <input type="number" value={form.min_qty} onChange={e => set('min_qty', e.target.value)} placeholder="e.g. 10"
                   className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
                   style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
          </div>
        )}
        {form.promo_type === 'spend_threshold' && (
          <div>
            <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Min Spend ($)</label>
            <input type="number" value={form.min_spend} onChange={e => set('min_spend', e.target.value)} placeholder="e.g. 2500"
                   className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
                   style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
          </div>
        )}
        {form.promo_type === 'category_deal' && (
          <div>
            <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Category</label>
            <input value={form.target_category} onChange={e => set('target_category', e.target.value)} placeholder="e.g. Outerwear"
                   className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
                   style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
          </div>
        )}
      </div>

      {/* Targeting */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Min Tier</label>
          <select value={form.min_tier} onChange={e => set('min_tier', e.target.value)}
                  className="w-full px-3 py-2 text-[11px] bg-[#111] border outline-none"
                  style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }}>
            {MIN_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: '#666', fontFamily: 'system-ui' }}>Expires</label>
          <input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)}
                 className="w-full px-3 py-2 text-[11px] bg-transparent border outline-none"
                 style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
        </div>
      </div>

      {/* Featured products */}
      {inventory.length > 0 && (
        <div className="mb-5">
          <label className="block text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#666', fontFamily: 'system-ui' }}>
            Featured Products (shown in email)
          </label>
          <div className="flex flex-wrap gap-2">
            {inventory.slice(0, 12).map(item => (
              <button key={item.id} onClick={() => setSelectedProducts(s => {
                const next = new Set(s);
                next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                return next;
              })}
                className="relative w-12 h-12 border overflow-hidden flex-shrink-0 transition-all"
                style={{ borderColor: selectedProducts.has(item.id) ? '#c9a84c' : '#2a2a2a' }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-[#1a1a1a]" />}
                {selectedProducts.has(item.id) && (
                  <div className="absolute inset-0 flex items-center justify-center"
                       style={{ background: '#c9a84c44' }}>
                    <span style={{ color: '#c9a84c', fontSize: 14 }}>✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-[8px] mt-1" style={{ color: '#444', fontFamily: 'system-ui' }}>
            {selectedProducts.size} selected
          </p>
        </div>
      )}

      {error && <p className="text-[10px] mb-3" style={{ color: '#e87c7c', fontFamily: 'system-ui' }}>{error}</p>}

      <button onClick={submit} disabled={saving}
              className="w-full py-3 text-[9px] uppercase tracking-[0.4em] font-medium transition-opacity disabled:opacity-50"
              style={{ background: '#c9a84c', color: '#000', fontFamily: 'system-ui' }}>
        {saving ? 'Creating…' : 'Create Promotion'}
      </button>
    </div>
  );
}

// ── Promotion Card ────────────────────────────────────────────────────────────

function PromoCard({
  promo,
  onSelect,
  selected,
}: {
  promo: Promotion;
  onSelect: () => void;
  selected: boolean;
}) {
  const promoLabel = PROMO_TYPES.find(p => p.value === promo.promo_type)?.label ?? promo.promo_type;

  return (
    <button onClick={onSelect} className="w-full text-left px-4 py-3 border-b transition-colors"
            style={{ borderColor: '#1e1e1e', background: selected ? '#1a1a12' : 'transparent' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium truncate" style={{ color: selected ? '#c9a84c' : '#ddd', fontFamily: 'system-ui' }}>
            {promo.name}
          </div>
          <div className="text-[8px] mt-0.5" style={{ color: '#555', fontFamily: 'system-ui' }}>
            {promoLabel} · {promo.discount_pct}% off · min tier: {promo.min_tier}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[9px] font-bold" style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>
            −{promo.discount_pct}%
          </div>
          <div className="text-[8px]" style={{ color: '#444', fontFamily: 'system-ui' }}>
            {promo.total_assigned} assigned
          </div>
        </div>
      </div>
      {!promo.active && (
        <span className="text-[7px] uppercase tracking-[0.25em] px-1.5 py-0.5 mt-1 inline-block"
              style={{ background: '#2a2a2a', color: '#666', fontFamily: 'system-ui' }}>Inactive</span>
      )}
    </button>
  );
}

// ── Assignments View ──────────────────────────────────────────────────────────

function AssignmentsView({ promoId }: { promoId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/brand/promotions/${promoId}/assignments`)
      .then(r => r.json())
      .then(d => { setAssignments(Array.isArray(d) ? d : []); setLoading(false); });
  }, [promoId]);

  async function revoke(assignmentId: string) {
    await fetch(`/api/brand/promotions/${promoId}/assignments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId, status: 'revoked' }),
    });
    setAssignments(a => a.map(x => x.id === assignmentId ? { ...x, status: 'revoked' } : x));
  }

  if (loading) return <p className="text-[10px] py-6 text-center" style={{ color: '#444', fontFamily: 'system-ui' }}>Loading…</p>;
  if (!assignments.length) return <p className="text-[10px] py-6 text-center" style={{ color: '#444', fontFamily: 'system-ui' }}>No assignments yet. Select accounts below and assign.</p>;

  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.3em] px-4 py-2 border-b" style={{ color: '#444', borderColor: '#1e1e1e', fontFamily: 'system-ui' }}>
        {assignments.length} assignment{assignments.length > 1 ? 's' : ''}
      </div>
      {assignments.map(a => (
        <div key={a.id} className="flex items-center justify-between px-4 py-2 border-b gap-2"
             style={{ borderColor: '#1a1a1a' }}>
          <div className="min-w-0">
            <div className="text-[10px] font-medium truncate" style={{ color: '#ddd', fontFamily: 'system-ui' }}>{a.store_name}</div>
            <div className="text-[8px]" style={{ color: '#555', fontFamily: 'system-ui' }}>{a.buyer_email}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <TierBadge tier={a.account_tier} />
            <span className="text-[8px]" style={{ color: a.email_sent ? '#6b9' : '#555', fontFamily: 'system-ui' }}>
              {a.email_sent ? '✓ sent' : '○ unsent'}
            </span>
            <span className="text-[8px] px-1.5 py-0.5"
                  style={{ background: a.status === 'active' ? '#1a2a1a' : '#2a1a1a',
                           color: a.status === 'active' ? '#6b9' : '#e87', fontFamily: 'system-ui' }}>
              {a.status}
            </span>
            {a.status === 'active' && (
              <button onClick={() => revoke(a.id)}
                      className="text-[7.5px] uppercase tracking-[0.2em] hover:opacity-60 transition-opacity"
                      style={{ color: '#555', fontFamily: 'system-ui' }}>
                Revoke
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const [accounts, setAccounts] = useState<TopAccount[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rightPanel, setRightPanel] = useState<'create' | 'assign'>('create');
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/brand/promotions/top-accounts').then(r => r.json()),
      fetch('/api/brand/promotions').then(r => r.json()),
      fetch('/api/brand/recommendations/inventory').then(r => r.json()),
    ]).then(([accs, promos, inv]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setPromotions(Array.isArray(promos) ? promos : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setLoading(false);
    });
  }, []);

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccounts(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  function selectAll() {
    const minTier = selectedPromo?.min_tier ?? 'silver';
    const tierOrder: AccountTier[] = ['rising', 'silver', 'gold', 'platinum'];
    const minIdx = tierOrder.indexOf(minTier as AccountTier);
    const eligible = accounts.filter(a => tierOrder.indexOf(a.tier) >= minIdx).map(a => a.id);
    setSelectedAccounts(new Set(eligible));
  }

  async function assign() {
    if (!selectedPromo || selectedAccounts.size === 0) return;
    setAssigning(true); setAssignResult('');
    try {
      const res = await fetch(`/api/brand/promotions/${selectedPromo.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_ids: Array.from(selectedAccounts), send_email: sendEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignResult(`✓ Assigned to ${data.assigned} account${data.assigned !== 1 ? 's' : ''}`);
        setPromotions(ps => ps.map(p => p.id === selectedPromo.id
          ? { ...p, total_assigned: p.total_assigned + data.assigned } : p));
        setSelectedAccounts(new Set());
      } else {
        setAssignResult(`Error: ${data.error}`);
      }
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: '#444', fontFamily: 'system-ui' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div className="border-b px-8 py-4 flex items-center justify-between" style={{ borderColor: '#1e1e1e' }}>
        <div className="flex items-center gap-6">
          <a href="/dashboard/brand-store"
             className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
             style={{ color: '#555' }}>
            ← Brand Store
          </a>
          <h1 className="text-[10px] uppercase tracking-[0.5em]" style={{ color: '#c9a84c' }}>
            Top Accounts & Promotions
          </h1>
        </div>
        <div className="flex items-center gap-4 text-[8px] uppercase tracking-[0.3em]" style={{ color: '#444' }}>
          <span>{accounts.length} accounts scored</span>
          <span>{promotions.length} promotions</span>
        </div>
      </div>

      <div className="flex" style={{ minHeight: 'calc(100vh - 57px)' }}>
        {/* Left: Account list */}
        <div className="w-80 border-r flex-shrink-0 overflow-y-auto" style={{ borderColor: '#1e1e1e' }}>
          <div className="sticky top-0 px-4 py-3 border-b z-10" style={{ background: '#0d0d0d', borderColor: '#1e1e1e' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] uppercase tracking-[0.35em]" style={{ color: '#666' }}>
                Top Accounts
              </span>
              <button onClick={selectAll} className="text-[7.5px] uppercase tracking-[0.25em] hover:opacity-60"
                      style={{ color: '#555' }}>
                Select eligible
              </button>
            </div>
            {/* Tier summary */}
            <div className="flex gap-2">
              {(['platinum', 'gold', 'silver', 'rising'] as AccountTier[]).map(tier => {
                const count = accounts.filter(a => a.tier === tier).length;
                return count > 0 ? (
                  <div key={tier} className="text-[7.5px]" style={{ color: TIER_COLORS[tier] }}>
                    {count} {TIER_LABELS[tier]}
                  </div>
                ) : null;
              })}
            </div>
          </div>

          <AccountList
            accounts={accounts}
            selected={selectedAccounts}
            onToggle={toggleAccount}
            minTier={selectedPromo?.min_tier ?? 'rising'}
          />
        </div>

        {/* Center: Promotions list */}
        <div className="w-72 border-r flex-shrink-0 flex flex-col" style={{ borderColor: '#1e1e1e' }}>
          <div className="sticky top-0 px-4 py-3 border-b z-10" style={{ background: '#0d0d0d', borderColor: '#1e1e1e' }}>
            <div className="flex items-center justify-between">
              <span className="text-[8px] uppercase tracking-[0.35em]" style={{ color: '#666' }}>
                Promotions
              </span>
              <button onClick={() => { setRightPanel('create'); setSelectedPromo(null); }}
                      className="text-[7.5px] uppercase tracking-[0.25em] hover:opacity-60"
                      style={{ color: selectedPromo === null && rightPanel === 'create' ? '#c9a84c' : '#555' }}>
                + New
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {promotions.length === 0 ? (
              <p className="text-[10px] py-8 text-center" style={{ color: '#333' }}>No promotions yet</p>
            ) : (
              promotions.map(p => (
                <PromoCard key={p.id} promo={p} selected={selectedPromo?.id === p.id}
                           onSelect={() => { setSelectedPromo(p); setRightPanel('assign'); setAssignResult(''); }} />
              ))
            )}
          </div>
        </div>

        {/* Right: Create or Assign panel */}
        <div className="flex-1 overflow-y-auto">
          {rightPanel === 'create' ? (
            <div className="p-6 max-w-lg">
              <CreatePromoForm
                inventory={inventory}
                onCreated={p => { setPromotions(ps => [p, ...ps]); setSelectedPromo(p); setRightPanel('assign'); }}
              />
            </div>
          ) : selectedPromo ? (
            <div className="p-6">
              {/* Promo summary */}
              <div className="mb-6 p-4 border" style={{ borderColor: '#2a2a2a' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[13px] font-medium" style={{ color: '#fff' }}>{selectedPromo.name}</h2>
                    <p className="text-[10px] mt-1" style={{ color: '#888' }}>{selectedPromo.headline}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold" style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>
                      −{selectedPromo.discount_pct}%
                    </div>
                    <div className="text-[8px]" style={{ color: '#555' }}>
                      {PROMO_TYPES.find(p => p.value === selectedPromo.promo_type)?.label}
                    </div>
                  </div>
                </div>
                {selectedPromo.description && (
                  <p className="text-[9px] mt-2" style={{ color: '#666' }}>{selectedPromo.description}</p>
                )}
                <div className="flex gap-4 mt-3 text-[8px]" style={{ color: '#555' }}>
                  {selectedPromo.min_qty && <span>Min qty: {selectedPromo.min_qty}</span>}
                  {selectedPromo.min_spend && <span>Min spend: {fmt(selectedPromo.min_spend)}</span>}
                  {selectedPromo.target_category && <span>Category: {selectedPromo.target_category}</span>}
                  {selectedPromo.expires_at && <span>Expires: {selectedPromo.expires_at.slice(0, 10)}</span>}
                  <span>Min tier: {selectedPromo.min_tier}</span>
                </div>
              </div>

              {/* Assign controls */}
              <div className="mb-6 p-4 border" style={{ borderColor: '#2a2a2a' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] uppercase tracking-[0.35em]" style={{ color: '#666' }}>
                    Assign to {selectedAccounts.size} selected account{selectedAccounts.size !== 1 ? 's' : ''}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                           className="accent-[#c9a84c]" />
                    <span className="text-[8px] uppercase tracking-[0.25em]" style={{ color: '#666' }}>
                      Send email
                    </span>
                  </label>
                </div>
                {assignResult && (
                  <p className="text-[10px] mb-3" style={{ color: assignResult.startsWith('✓') ? '#6b9' : '#e87' }}>
                    {assignResult}
                  </p>
                )}
                <button onClick={assign} disabled={assigning || selectedAccounts.size === 0}
                        className="w-full py-2.5 text-[9px] uppercase tracking-[0.4em] transition-opacity disabled:opacity-40"
                        style={{ background: '#c9a84c', color: '#000' }}>
                  {assigning ? 'Assigning…' : `Assign Promotion${sendEmail ? ' & Email' : ''}`}
                </button>
              </div>

              {/* Existing assignments */}
              <div className="border" style={{ borderColor: '#2a2a2a' }}>
                <div className="px-4 py-2 border-b" style={{ borderColor: '#1e1e1e' }}>
                  <span className="text-[8px] uppercase tracking-[0.35em]" style={{ color: '#666' }}>Existing Assignments</span>
                </div>
                <AssignmentsView promoId={selectedPromo.id} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
