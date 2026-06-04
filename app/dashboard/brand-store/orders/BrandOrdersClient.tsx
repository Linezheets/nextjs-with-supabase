'use client';

import { useState, useMemo, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Item = {
  brand_name      ?: string;
  title           ?: string;
  name            ?: string;
  style_number    ?: string;
  sku             ?: string;
  colour          ?: string;
  color           ?: string;
  image_url       ?: string | null;
  wholesale_price ?: number;
  wsp_usd         ?: number;
  retail_price    ?: number;
  sizes           ?: Record<string, number>;
  qty             ?: number;
  total_qty       ?: number;
  fulfillment_type?: string;
};

export type Order = {
  id              : string;
  buyer_id        : string | null;
  buyer_name      : string | null;
  status          : string;
  payment_status  : string | null;
  total_usd       : number;
  terms           : string | null;
  notes           : string | null;
  items           : Item[];
  created_at      : string;
  fulfillment_type: string | null;
  brand_items     : Item[];
  brand_total     : number;
};

type SortKey = 'date' | 'total' | 'status' | 'buyer';
type SortDir = 'asc' | 'desc';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  offer    : '#c9a84c',
  new      : '#c9a84c',
  confirmed: '#52b788',
  preparing: '#7cb9e8',
  shipped  : '#a8dadc',
  delivered: '#52b788',
  cancelled: '#4a4a4a',
};

// Which status a brand can advance to, and which can be cancelled
const NEXT_STATUS: Record<string, { label: string; to: string } | null> = {
  new      : { label: 'Confirm',  to: 'confirmed' },
  confirmed: { label: 'Preparing', to: 'preparing' },
  preparing: { label: 'Shipped',  to: 'shipped'   },
};
const CAN_CANCEL = new Set(['new', 'confirmed']);

const PAYMENT_INFO: Record<string, { label: string; color: string }> = {
  unpaid            : { label: 'Unpaid',       color: '#e87c7c' },
  pending_wire      : { label: 'Wire Pending',  color: '#c9a84c' },
  payment_processing: { label: 'Processing',   color: '#7cb9e8' },
  paid              : { label: 'Paid',          color: '#52b788' },
  payment_failed    : { label: 'Failed',        color: '#e87c7c' },
};

const STATUS_ORDER = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'offer'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const itemTitle = (i: Item) => i.title ?? i.name ?? '—';
const itemSku   = (i: Item) => i.sku ?? i.style_number ?? null;
const itemColor = (i: Item) => i.colour ?? i.color ?? null;
const itemWsp   = (i: Item) => Number(i.wholesale_price ?? i.wsp_usd ?? 0);
const itemQty   = (i: Item) => Number(i.qty ?? i.total_qty ?? 1);

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#555';
  return (
    <span className="inline-block text-[7px] uppercase tracking-[0.3em] px-2 py-0.5"
          style={{ background: color + '20', color, fontFamily: 'system-ui', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

// ── Expanded item list ────────────────────────────────────────────────────────

function ItemList({ items }: { items: Item[] }) {
  if (!items.length) return (
    <div className="px-6 py-6 text-center text-[10px]" style={{ color: '#444', fontFamily: 'system-ui' }}>
      No items from your brand in this order.
    </div>
  );

  return (
    <div>
      {/* Mini header */}
      <div className="grid px-6 py-2 border-b"
           style={{ borderColor: '#1e1e1e', gridTemplateColumns: '44px 1fr 70px 80px 90px 90px' }}>
        {['', 'Item', 'Color', 'Sizes', 'WSP', 'Subtotal'].map(h => (
          <p key={h} className="text-[7px] uppercase tracking-[0.35em]"
             style={{ color: '#3a3a3a', fontFamily: 'system-ui',
                      textAlign: h === 'WSP' || h === 'Subtotal' ? 'right' : undefined }}>
            {h}
          </p>
        ))}
      </div>
      {items.map((item, idx) => {
        const wsp    = itemWsp(item);
        const qty    = itemQty(item);
        const sizes  = Object.entries(item.sizes ?? {}).filter(([, v]) => Number(v) > 0);

        return (
          <div key={idx}
               className="grid px-6 py-3 items-center border-b last:border-0 hover:bg-[#0c0c0c] transition-colors"
               style={{ borderColor: '#181818', gridTemplateColumns: '44px 1fr 70px 80px 90px 90px' }}>
            {/* Thumbnail */}
            <div className="w-8 h-10 flex-shrink-0 overflow-hidden" style={{ background: '#1a1a1a' }}>
              {item.image_url
                ? <img src={item.image_url} alt="" className="w-full h-full object-cover"
                       style={{ filter: 'grayscale(50%)' }} />
                : <div className="w-full h-full flex items-center justify-center">
                    <div className="w-3 h-px" style={{ background: '#333' }} />
                  </div>
              }
            </div>

            {/* Title + SKU + badge */}
            <div className="min-w-0 pr-2">
              <p className="text-[11px] truncate leading-tight"
                 style={{ color: '#d0d0d0', fontFamily: 'system-ui' }}>
                {itemTitle(item)}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {itemSku(item) && (
                  <span className="text-[8px]" style={{ color: '#444', fontFamily: 'DM Mono, monospace' }}>
                    {itemSku(item)}
                  </span>
                )}
                {item.fulfillment_type === 'FUTURE_ALLOCATION' && (
                  <span className="text-[6.5px] uppercase tracking-[0.2em] px-1 py-0.5"
                        style={{ background: '#7cb9e818', color: '#7cb9e8', fontFamily: 'system-ui' }}>
                    Pre-order
                  </span>
                )}
              </div>
            </div>

            {/* Color */}
            <p className="text-[10px]" style={{ color: '#666', fontFamily: 'system-ui' }}>
              {itemColor(item) ?? '—'}
            </p>

            {/* Sizes */}
            <div className="flex flex-wrap gap-1">
              {sizes.length > 0
                ? sizes.map(([sz, v]) => (
                    <span key={sz} className="text-[7px] px-1 py-px border"
                          style={{ borderColor: '#2a2a2a', color: '#666', fontFamily: 'DM Mono, monospace' }}>
                      {sz}:{v}
                    </span>
                  ))
                : <span className="text-[9px]" style={{ color: '#444' }}>×{qty}</span>
              }
            </div>

            {/* WSP */}
            <p className="text-[10px] text-right tabular-nums"
               style={{ color: '#888', fontFamily: 'DM Mono, monospace' }}>
              {fmtUSD(wsp)}
            </p>

            {/* Subtotal */}
            <p className="text-[11px] text-right tabular-nums font-medium"
               style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>
              {fmtUSD(wsp * qty)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onAdvance,
  onCancel,
}: {
  order    : Order;
  onAdvance: (id: string, to: string) => Promise<string | null>;
  onCancel : (id: string) => Promise<string | null>;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [busy,     setBusy]       = useState(false);
  const [rowError, setRowError]   = useState('');

  const next        = NEXT_STATUS[order.status] ?? null;
  const canCancel   = CAN_CANCEL.has(order.status);
  const statusColor = STATUS_COLOR[order.status] ?? '#666';
  const payInfo     = PAYMENT_INFO[order.payment_status ?? 'unpaid']
                   ?? { label: order.payment_status ?? '—', color: '#666' };

  async function run(fn: () => Promise<string | null>) {
    setRowError('');
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) setRowError(err);
  }

  return (
    <div className="border-b" style={{ borderColor: '#181818' }}>
      {/* Main row — click anywhere to expand */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(ex => !ex)}
        className="grid items-center px-5 py-4 cursor-pointer hover:bg-[#0f0f0f] transition-colors select-none"
        style={{ gridTemplateColumns: '22px 1fr 130px 110px 100px 100px 200px' }}
      >
        {/* Chevron */}
        <span className="text-[8px]" style={{ color: '#383838' }}>{expanded ? '▼' : '▶'}</span>

        {/* Buyer + ID */}
        <div className="min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: '#ddd', fontFamily: 'system-ui' }}>
            {order.buyer_name ?? 'Unknown Buyer'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[8px] truncate" style={{ color: '#3a3a3a', fontFamily: 'DM Mono, monospace' }}>
              {order.id}
            </p>
            {order.terms && (
              <p className="text-[8px]" style={{ color: '#4a4a4a', fontFamily: 'system-ui' }}>{order.terms}</p>
            )}
            {order.fulfillment_type === 'FUTURE_ALLOCATION' && (
              <span className="text-[6.5px] uppercase tracking-[0.15em] px-1"
                    style={{ background: '#7cb9e815', color: '#7cb9e8', fontFamily: 'system-ui' }}>
                Pre-order
              </span>
            )}
          </div>
        </div>

        {/* Date */}
        <p className="text-[9px]" style={{ color: '#555', fontFamily: 'system-ui' }}>
          {fmtDate(order.created_at)}
        </p>

        {/* Status */}
        <StatusBadge status={order.status} />

        {/* Payment */}
        <span className="text-[7px] uppercase tracking-[0.2em]"
              style={{ color: payInfo.color, fontFamily: 'system-ui' }}>
          {payInfo.label}
        </span>

        {/* Brand subtotal */}
        <p className="text-[11px] text-right tabular-nums"
           style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>
          {fmtUSD(order.brand_total)}
          <span className="text-[7px] ml-1" style={{ color: '#444' }}>
            ({order.brand_items.length})
          </span>
        </p>

        {/* Actions — stop click propagation so they don't toggle expand */}
        <div className="flex items-center gap-1.5 justify-end"
             onClick={e => e.stopPropagation()}
             onKeyDown={e => e.stopPropagation()}>
          {next && (
            <button
              disabled={busy}
              onClick={() => run(() => onAdvance(order.id, next.to))}
              className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.3em] border transition-all disabled:opacity-30"
              style={{ borderColor: statusColor, color: statusColor, fontFamily: 'system-ui' }}
            >
              {busy ? '…' : next.label}
            </button>
          )}
          {canCancel && (
            <button
              disabled={busy}
              onClick={() => { if (confirm(`Cancel order ${order.id}?`)) run(() => onCancel(order.id)); }}
              className="px-2 py-1.5 text-[7px] uppercase tracking-[0.25em] transition-colors disabled:opacity-30 hover:text-[#e87c7c]"
              style={{ color: '#383838', fontFamily: 'system-ui' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Row-level error */}
      {rowError && (
        <div className="px-8 py-2 text-[9px]" style={{ color: '#e87c7c', background: '#160909', fontFamily: 'system-ui' }}>
          {rowError}
        </div>
      )}

      {/* Expanded items */}
      {expanded && (
        <div className="border-t" style={{ borderColor: '#1a1a1a', background: '#080808' }}>
          <ItemList items={order.brand_items} />

          {/* Notes + subtotal footer */}
          <div className="flex items-start justify-between px-6 py-3 border-t gap-4"
               style={{ borderColor: '#1a1a1a' }}>
            <div>
              {order.notes && (
                <>
                  <p className="text-[7px] uppercase tracking-[0.35em] mb-0.5"
                     style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>Buyer Notes</p>
                  <p className="text-[10px]" style={{ color: '#666', fontFamily: 'system-ui' }}>{order.notes}</p>
                </>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[7px] uppercase tracking-[0.35em] mb-1"
                 style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>Your Brand Total</p>
              <p className="text-[16px] font-light"
                 style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>
                {fmtUSD(order.brand_total)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="py-24 flex flex-col items-center gap-3">
      <div className="w-8 h-px" style={{ background: '#222' }} />
      <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>
        {hasFilters ? 'No matching orders' : 'No orders yet'}
      </p>
      {!hasFilters && (
        <p className="text-[10px]" style={{ color: '#2a2a2a', fontFamily: 'system-ui' }}>
          Wholesale orders for your brand will appear here.
        </p>
      )}
    </div>
  );
}

// ── No storefront state ───────────────────────────────────────────────────────

function NoBrand() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0d0d0d' }}>
      <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>
        Brand storefront not set up
      </p>
      <a href="/dashboard/brand-store"
         className="text-[8px] uppercase tracking-[0.4em] border px-4 py-2 hover:bg-white hover:text-black transition-colors"
         style={{ borderColor: '#333', color: '#888', fontFamily: 'system-ui' }}>
        Set Up Brand Store →
      </a>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BrandOrdersClient({
  initialOrders,
  brandName,
}: {
  initialOrders: Order[];
  brandName    : string;
}) {
  const [orders,    setOrders]    = useState<Order[]>(initialOrders);
  const [loading,   setLoading]   = useState(false);
  const [globalErr, setGlobalErr] = useState('');
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [sortKey,   setSortKey]   = useState<SortKey>('date');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  if (!brandName) return <NoBrand />;

  // Refresh from API
  const refresh = useCallback(async () => {
    setLoading(true);
    setGlobalErr('');
    try {
      const res  = await fetch('/api/brand/orders');
      const json = await res.json();
      if (!res.ok) { setGlobalErr(json.error ?? 'Refresh failed'); return; }
      setOrders(json.orders ?? []);
    } catch {
      setGlobalErr('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Status advance
  const handleAdvance = useCallback(async (id: string, to: string): Promise<string | null> => {
    const res  = await fetch('/api/brand/orders', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order_id: id, status: to }),
    });
    const json = await res.json();
    if (!res.ok) return json.error ?? 'Update failed';
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: to } : o));
    return null;
  }, []);

  // Cancel
  const handleCancel = useCallback(async (id: string): Promise<string | null> => {
    return handleAdvance(id, 'cancelled');
  }, [handleAdvance]);

  // Status counts for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [orders]);

  // Available statuses in order
  const statusTabs = useMemo(() => {
    const present = new Set(orders.map(o => o.status));
    return ['all', ...STATUS_ORDER.filter(s => present.has(s))];
  }, [orders]);

  // Filtered + sorted list
  const visible = useMemo(() => {
    let list = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.buyer_name ?? '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.brand_items.some(i => itemTitle(i).toLowerCase().includes(q) || (itemSku(i) ?? '').toLowerCase().includes(q)),
      );
    }

    if (dateFrom) list = list.filter(o => o.created_at >= dateFrom);
    if (dateTo)   list = list.filter(o => o.created_at.slice(0, 10) <= dateTo);

    return [...list].sort((a, b) => {
      const m = sortDir === 'desc' ? -1 : 1;
      if (sortKey === 'date')   return m * (a.created_at.localeCompare(b.created_at));
      if (sortKey === 'total')  return m * (a.brand_total - b.brand_total);
      if (sortKey === 'status') return m * (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
      if (sortKey === 'buyer')  return m * ((a.buyer_name ?? '').localeCompare(b.buyer_name ?? ''));
      return 0;
    });
  }, [orders, filter, search, dateFrom, dateTo, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  // KPIs
  const revenue      = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.brand_total, 0);
  const openCount    = orders.filter(o => !['cancelled', 'shipped', 'delivered'].includes(o.status)).length;
  const newCount     = orders.filter(o => o.status === 'new').length;
  const shippedCount = orders.filter(o => o.status === 'shipped').length;

  const hasFilters = filter !== 'all' || !!search || !!dateFrom || !!dateTo;

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button onClick={() => toggleSort(col)}
              className="flex items-center gap-1 text-[7px] uppercase tracking-[0.35em] transition-colors hover:opacity-70"
              style={{ color: active ? '#c9a84c' : '#3a3a3a', fontFamily: 'system-ui' }}>
        {label}
        {active && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d' }}>

      {/* ── Header ── */}
      <div className="border-b px-6 py-4 flex items-center gap-6" style={{ borderColor: '#1a1a1a' }}>
        <a href="/dashboard/brand-store"
           className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity flex-shrink-0"
           style={{ color: '#444', fontFamily: 'system-ui' }}>
          ← Brand Store
        </a>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-[10px] uppercase tracking-[0.5em] flex-shrink-0"
              style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            Orders
          </h1>
          <span className="text-[8px] uppercase tracking-[0.3em] truncate"
                style={{ color: '#333', fontFamily: 'system-ui' }}>
            {brandName}
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[8px] uppercase tracking-[0.35em] px-3 py-1.5 border transition-colors disabled:opacity-40 flex-shrink-0"
          style={{ borderColor: '#252525', color: '#555', fontFamily: 'system-ui' }}
        >
          {loading ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-px" style={{ background: '#141414' }}>
        {[
          { label: 'Revenue (excl. cancelled)', value: fmtUSD(revenue),         mono: true  },
          { label: 'Open Orders',               value: String(openCount),        mono: false },
          { label: 'Awaiting Confirm',          value: String(newCount),         mono: false,
            accent: newCount > 0 },
          { label: 'Shipped',                   value: String(shippedCount),     mono: false },
        ].map(kpi => (
          <div key={kpi.label} className="px-6 py-5" style={{ background: '#0d0d0d' }}>
            <p className="text-[7px] uppercase tracking-[0.4em] mb-1"
               style={{ color: '#333', fontFamily: 'system-ui' }}>
              {kpi.label}
            </p>
            <p className="text-[22px] font-light"
               style={{
                 color      : kpi.accent ? '#c9a84c' : '#ccc',
                 fontFamily : kpi.mono ? 'DM Mono, monospace' : 'system-ui',
               }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters row ── */}
      <div className="border-b flex items-center justify-between px-6 gap-4 flex-wrap"
           style={{ borderColor: '#1a1a1a' }}>
        {/* Status tabs */}
        <div className="flex items-end">
          {statusTabs.map(s => {
            const color  = s === 'all' ? '#c9a84c' : (STATUS_COLOR[s] ?? '#c9a84c');
            const active = filter === s;
            return (
              <button key={s} onClick={() => setFilter(s)}
                      className="px-4 py-3 text-[7.5px] uppercase tracking-[0.3em] border-b-2 transition-colors flex items-center gap-1.5"
                      style={{
                        borderColor: active ? color : 'transparent',
                        color      : active ? color : '#3a3a3a',
                        fontFamily : 'system-ui',
                      }}>
                {s}
                {(statusCounts[s] ?? 0) > 0 && (
                  <span className="text-[7px] px-1 py-px rounded-sm"
                        style={{ background: active ? color + '25' : '#1a1a1a', color: active ? color : '#3a3a3a' }}>
                    {statusCounts[s]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + date */}
        <div className="flex items-center gap-2 py-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search buyer, ID, item…"
            className="px-3 py-1.5 text-[10px] bg-transparent border outline-none w-48"
            style={{ borderColor: '#222', color: '#aaa', fontFamily: 'system-ui' }}
          />
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-[9px] bg-transparent border outline-none"
            style={{ borderColor: '#222', color: '#666' }}
          />
          <span className="text-[9px]" style={{ color: '#333' }}>—</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 text-[9px] bg-transparent border outline-none"
            style={{ borderColor: '#222', color: '#666' }}
          />
          {hasFilters && (
            <button
              onClick={() => { setFilter('all'); setSearch(''); setDateFrom(''); setDateTo(''); }}
              className="text-[8px] px-2 py-1.5 hover:opacity-70 transition-opacity"
              style={{ color: '#444', fontFamily: 'system-ui' }}
            >
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Global error ── */}
      {globalErr && (
        <div className="px-6 py-3 text-[9px] flex items-center justify-between"
             style={{ background: '#160909', color: '#e87c7c', fontFamily: 'system-ui' }}>
          {globalErr}
          <button onClick={() => setGlobalErr('')} className="hover:opacity-60">✕</button>
        </div>
      )}

      {/* ── Table header ── */}
      {visible.length > 0 && (
        <div className="grid items-center px-5 py-2 border-b"
             style={{ borderColor: '#181818', gridTemplateColumns: '22px 1fr 130px 110px 100px 100px 200px' }}>
          <span />
          <SortBtn col="buyer"  label="Buyer / Order" />
          <SortBtn col="date"   label="Date" />
          <SortBtn col="status" label="Status" />
          <span className="text-[7px] uppercase tracking-[0.35em]"
                style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>Payment</span>
          <SortBtn col="total"  label="Your Total" />
          <span className="text-[7px] uppercase tracking-[0.35em] text-right"
                style={{ color: '#3a3a3a', fontFamily: 'system-ui' }}>Actions</span>
        </div>
      )}

      {/* ── Rows / empty ── */}
      {visible.length === 0
        ? <Empty hasFilters={hasFilters} />
        : visible.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              onAdvance={handleAdvance}
              onCancel={handleCancel}
            />
          ))
      }

      {/* ── Footer count ── */}
      {visible.length > 0 && (
        <div className="px-6 py-4 text-right text-[8px]"
             style={{ color: '#2a2a2a', fontFamily: 'system-ui', borderTop: '1px solid #141414' }}>
          {visible.length} order{visible.length !== 1 ? 's' : ''}
          {hasFilters && ` of ${orders.length}`}
        </div>
      )}
    </div>
  );
}
