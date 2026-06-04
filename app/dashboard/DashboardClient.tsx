'use client';

import { useState, useMemo } from 'react';
import DashboardNav from '@/components/DashboardNav';
import ProductCard  from '@/components/ProductCard';
import type { CatalogItem } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentOrder = {
  id            : string;
  status        : string;
  payment_status: string | null;
  total_usd     : number;
  created_at    : string;
  item_count    : number;
};

type Props = {
  user: {
    email    : string | null;
    createdAt: string;
  };
  items        : CatalogItem[];
  recentOrders : RecentOrder[];
  season       : string;
  role?        : 'buyer' | 'brand' | 'admin';
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const USD_TO_EUR = 0.92;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return fallback;
}

function safeNum(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return isFinite(n) ? n : fallback;
}

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

const STATUS_COLOR: Record<string, string> = {
  new      : '#c9a84c',
  confirmed: '#52b788',
  shipped  : '#7cb9e8',
  delivered: '#52b788',
  cancelled: '#aaa',
};

const PAYMENT_COLOR: Record<string, string> = {
  unpaid            : '#df1b41',
  pending_wire      : '#c9a84c',
  payment_processing: '#7cb9e8',
  paid              : '#52b788',
  payment_failed    : '#df1b41',
};

const PAGE_SIZE = 12;

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-100 p-6 md:p-8">
      <p className="text-[7.5px] uppercase tracking-[0.5em] mb-4"
         style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
        fontSize  : 'clamp(1.8rem, 3.5vw, 2.8rem)',
        fontWeight: 400, lineHeight: 1, color: '#111',
      }}>
        {value}
      </p>
      {sub && (
        <p className="text-[8px] uppercase tracking-[0.3em] mt-3"
           style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Recent orders strip ───────────────────────────────────────────────────────

function RecentOrdersStrip({ orders }: { orders: RecentOrder[] }) {
  if (!orders.length) return null;

  return (
    <section className="border-b border-zinc-100">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[7.5px] uppercase tracking-[0.5em]"
             style={{ color: '#bbb', fontFamily: 'system-ui' }}>
            Recent Orders
          </p>
          <a href="/dashboard/orders"
             className="text-[7.5px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            View All →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map(order => {
            const ps       = order.payment_status ?? 'unpaid';
            const canPay   = ps === 'unpaid' || ps === 'payment_failed';
            const date     = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={order.id}
                   className="border border-zinc-100 px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#555' }}>
                      {order.id}
                    </p>
                    <span className="text-[6.5px] uppercase tracking-[0.25em] px-1.5 py-0.5"
                          style={{ background: STATUS_COLOR[order.status] ?? '#ccc', color: '#fff' }}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.25em]"
                     style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                    {order.item_count} {order.item_count === 1 ? 'piece' : 'pieces'} · {date}
                  </p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '12px', color: '#c9a84c' }}>
                    {fmtUSD(order.total_usd)}
                  </p>
                  {canPay ? (
                    <a href={`/checkout?order_id=${order.id}`}
                       className="text-[6.5px] uppercase tracking-[0.3em] px-2.5 py-1 border border-black hover:bg-black hover:text-white transition-colors"
                       style={{ color: '#111', fontFamily: 'system-ui' }}>
                      Pay →
                    </a>
                  ) : (
                    <span className="text-[6.5px] uppercase tracking-[0.3em]"
                          style={{ color: PAYMENT_COLOR[ps] ?? '#aaa', fontFamily: 'system-ui' }}>
                      {ps.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-[7.5px] uppercase tracking-[0.35em] transition-colors whitespace-nowrap"
      style={{
        fontFamily : 'system-ui',
        border     : `1px solid ${active ? '#111' : '#e5e5e5'}`,
        background : active ? '#111' : '#fff',
        color      : active ? '#fff' : '#888',
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({ user, items, recentOrders, season, role = 'buyer' }: Props) {
  const [search,       setSearch]       = useState('');
  const [activeCategory, setCategory]   = useState('All');
  const [activeBrand,    setBrand]       = useState('All');
  const [activeStatus,   setStatus]      = useState('All');
  const [shown,          setShown]       = useState(PAGE_SIZE);

  // Derived filter options
  const brands     = useMemo(() => ['All', ...Array.from(new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))).sort()], [items]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => safeStr(i.category)).filter(Boolean))).sort()], [items]);
  const statuses   = useMemo(() => ['All', ...Array.from(new Set(items.map(i => safeStr(i.inventory_status)).filter(Boolean))).sort()], [items]);

  // Filtered items
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      if (activeCategory !== 'All' && safeStr(item.category)         !== activeCategory) return false;
      if (activeBrand    !== 'All' && safeStr(item.brand_name)        !== activeBrand)    return false;
      if (activeStatus   !== 'All' && safeStr(item.inventory_status) !== activeStatus)   return false;
      if (q && !safeStr(item.title ?? item.name).toLowerCase().includes(q) &&
               !safeStr(item.brand_name).toLowerCase().includes(q)         &&
               !safeStr(item.style_number).toLowerCase().includes(q))                    return false;
      return true;
    });
  }, [items, search, activeCategory, activeBrand, activeStatus]);

  const visible     = filtered.slice(0, shown);
  const hasMore     = shown < filtered.length;
  const totalItems  = items.length;
  const availCount  = items.filter(i => safeStr(i.inventory_status).toLowerCase() !== 'sold out').length;
  const avgWS       = totalItems > 0
    ? items.reduce((s, i) => s + safeNum(i.wholesale_price, safeNum(i.retail_price) / 2.5), 0) / totalItems
    : 0;

  const emailHandle = user.email?.split('@')[0] ?? 'Buyer';
  const joinDate    = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function resetFilters() {
    setSearch('');
    setCategory('All');
    setBrand('All');
    setStatus('All');
    setShown(PAGE_SIZE);
  }

  const filtersActive = search || activeCategory !== 'All' || activeBrand !== 'All' || activeStatus !== 'All';

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <DashboardNav role={role} />

      <main className="pt-[60px]">

        {/* ── Masthead ──────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16 md:py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6"
               style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              VIP Member · {season}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize  : 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 400, lineHeight: 1.0, color: '#0a0a0a', marginBottom: '1.5rem',
            }}>
              Welcome,<br />
              <em style={{ fontStyle: 'italic', color: '#bbb' }}>{emailHandle}</em>
            </h1>
            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-[9px] uppercase tracking-[0.3em]"
                 style={{ color: '#ccc', fontFamily: 'system-ui' }}>
                {user.email}
              </p>
              <div className="w-px h-3 bg-zinc-200" />
              <p className="text-[9px] uppercase tracking-[0.3em]"
                 style={{ color: '#ccc', fontFamily: 'system-ui' }}>
                Member since {joinDate}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total Pieces"    value={String(totalItems)}     sub={`${availCount} available`} />
              <Stat label="Brands"          value={String(brands.length - 1)} sub={brands.slice(1, 3).join(' · ') || 'Curated'} />
              <Stat label="Orders Placed"   value={String(recentOrders.length > 0 ? recentOrders.length : '—')} sub="this season" />
              <Stat label="Avg. Wholesale"  value={avgWS > 0 ? fmtUSD(avgWS) : '—'}
                    sub={avgWS > 0 ? `€${(avgWS * USD_TO_EUR).toFixed(0)} EUR` : 'On Request'} />
            </div>
          </div>
        </section>

        {/* ── Recent orders ─────────────────────────────────────────────────── */}
        <RecentOrdersStrip orders={recentOrders.slice(0, 3)} />

        {/* ── Catalog ───────────────────────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-8 md:px-16 py-14">

          {/* Section header */}
          <div className="flex items-end justify-between mb-10 pb-7 border-b border-zinc-100">
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-3"
                 style={{ color: '#ccc', fontFamily: 'system-ui' }}>
                Wholesale Access · {season}
              </p>
              <h2 style={{
                fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
                fontSize  : 'clamp(1.6rem, 3vw, 2.2rem)',
                fontWeight: 400, lineHeight: 1, color: '#111',
              }}>
                Showroom
              </h2>
            </div>
            {filtered.length !== totalItems && (
              <p className="text-[8px] uppercase tracking-[0.3em]"
                 style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                {filtered.length} of {totalItems} shown
              </p>
            )}
          </div>

          {/* Search + filters */}
          <div className="space-y-5 mb-10">

            {/* Search row */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                     width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShown(PAGE_SIZE); }}
                  placeholder="Search by name, brand, SKU…"
                  className="w-full pl-8 pr-4 py-2.5 text-[11px] border border-zinc-200 bg-white outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-300"
                  style={{ fontFamily: 'system-ui' }}
                />
              </div>
              {filtersActive && (
                <button
                  onClick={resetFilters}
                  className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                  style={{ color: '#888', fontFamily: 'system-ui' }}
                >
                  Clear ✕
                </button>
              )}
            </div>

            {/* Brand chips */}
            {brands.length > 2 && (
              <div className="flex flex-wrap gap-2">
                {brands.map(b => (
                  <Chip key={b} label={b} active={activeBrand === b}
                        onClick={() => { setBrand(b); setShown(PAGE_SIZE); }} />
                ))}
              </div>
            )}

            {/* Category + status chips in one row */}
            {(categories.length > 2 || statuses.length > 2) && (
              <div className="flex flex-wrap gap-2">
                {categories.length > 2 && categories.map(c => (
                  <Chip key={c} label={c} active={activeCategory === c}
                        onClick={() => { setCategory(c); setShown(PAGE_SIZE); }} />
                ))}
                {categories.length > 2 && statuses.length > 2 && (
                  <div className="w-px self-stretch bg-zinc-200 mx-1" />
                )}
                {statuses.length > 2 && statuses.map(s => (
                  <Chip key={s} label={s} active={activeStatus === s}
                        onClick={() => { setStatus(s); setShown(PAGE_SIZE); }} />
                ))}
              </div>
            )}
          </div>

          {/* Grid */}
          {visible.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-14">
                {visible.map(item => (
                  <ProductCard key={safeStr(item.id)} item={item} verified priority={false} />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-14 flex flex-col items-center gap-3">
                  <button
                    onClick={() => setShown(s => s + PAGE_SIZE)}
                    className="px-12 py-[14px] text-[8.5px] uppercase tracking-[0.5em]
                               border border-zinc-200 text-zinc-400
                               hover:border-zinc-800 hover:text-zinc-800 transition-colors duration-200"
                    style={{ fontFamily: 'system-ui' }}
                  >
                    Load More — {filtered.length - shown} remaining
                  </button>
                  <button
                    onClick={() => setShown(filtered.length)}
                    className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                    style={{ color: '#bbb', fontFamily: 'system-ui' }}
                  >
                    Show All {filtered.length}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center">
              <div className="w-12 h-px mx-auto mb-10" style={{ background: '#e8e8e8' }} />
              <p style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize  : '1.6rem', fontWeight: 400, color: '#ccc',
              }}>
                No pieces found
              </p>
              <button
                onClick={resetFilters}
                className="mt-6 text-[8px] uppercase tracking-[0.4em] underline underline-offset-4 hover:opacity-50 transition-opacity"
                style={{ color: '#aaa', fontFamily: 'system-ui' }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10
                        flex items-center justify-between gap-6">
          <div>
            <p style={{
              fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize    : '13px', letterSpacing: '0.5em', marginBottom: '5px', fontWeight: 400,
            }}>
              Linezheets
            </p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]"
               style={{ color: '#ccc', fontFamily: 'system-ui' }}>
              Private Showroom · Authorised Retailers Only
            </p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em] text-right"
             style={{ color: '#d8d8d8', fontFamily: 'system-ui' }}>
            © {new Date().getFullYear()} Linezheets ·{' '}
            <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
