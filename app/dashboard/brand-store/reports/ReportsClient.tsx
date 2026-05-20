'use client';

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Kpis = {
  totalRevenue : number;
  totalUnits   : number;
  totalOrders  : number;
  avgOrderValue: number;
};

type TrendPoint = {
  month  : string;
  revenue: number;
  units  : number;
  orders : number;
};

type TopProduct = {
  title          : string;
  revenue        : number;
  units          : number;
  orders         : number;
  wholesale_price: number;
  retail_price   : number;
};

type Upsell = {
  id         : number;
  title      : string | null;
  category   : string | null;
  season     : string | null;
  srp        : number | null;
  margin     : number | null;
  isPublished: boolean;
  isOrdered  : boolean;
  priceGap   : number;
  opportunity: string;
};

type RecentOrder = {
  id         : string;
  buyer_name : string | null;
  status     : string;
  brand_total: number;
  created_at : string;
  items      : { title: string; qty: number; wholesale_price: number }[];
};

type ReportData = {
  kpis        : Kpis;
  trend       : TrendPoint[];
  topProducts : TopProduct[];
  upsells     : Upsell[];
  recentOrders: RecentOrder[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtUsd(n: number) {
  return `$${fmt(n)}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-100 p-6">
      <p className="text-[7px] uppercase tracking-[0.5em] mb-3" style={{ color: '#bbb', fontFamily: 'system-ui' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '28px', fontWeight: 400, color: '#111' }}>{value}</p>
      {sub && <p className="mt-1 text-[10px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>{sub}</p>}
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#ddd', fontFamily: 'system-ui' }}>No sales data yet</p>
    </div>
  );

  const maxRev = Math.max(...trend.map(t => t.revenue), 1);

  return (
    <div>
      <div className="flex items-end gap-3 h-40">
        {trend.map(t => (
          <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-[8px]" style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}>
              {t.revenue > 0 ? fmtUsd(t.revenue) : ''}
            </p>
            <div className="w-full transition-all duration-500"
                 style={{ height: `${Math.max((t.revenue / maxRev) * 120, 2)}px`, background: t.revenue > 0 ? '#111' : '#f0f0f0' }} />
            <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
              {monthLabel(t.month)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-8 border-t border-zinc-100 pt-4">
        {trend.slice(-1).map(t => (
          <div key={t.month} className="flex gap-8">
            <div>
              <p className="text-[7px] uppercase tracking-[0.4em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>Units (latest month)</p>
              <p className="text-[16px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#333' }}>{t.units}</p>
            </div>
            <div>
              <p className="text-[7px] uppercase tracking-[0.4em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>Orders (latest month)</p>
              <p className="text-[16px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#333' }}>{t.orders}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductsTable({ products }: { products: TopProduct[] }) {
  if (!products.length) return (
    <div className="py-12 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#ddd', fontFamily: 'system-ui' }}>No orders yet</p>
    </div>
  );

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-zinc-100">
          {['Product', 'Units', 'Orders', 'WSP Revenue'].map(h => (
            <th key={h} className="pb-3 text-left text-[7px] uppercase tracking-[0.4em]"
                style={{ color: '#bbb', fontFamily: 'system-ui', fontWeight: 400 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {products.map((p, i) => (
          <tr key={p.title} className="border-b border-zinc-50">
            <td className="py-3 pr-4">
              <div className="flex items-center gap-3">
                <span className="text-[9px]" style={{ color: '#ddd', fontFamily: 'var(--font-mono), monospace', width: '16px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[12px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>{p.title}</span>
              </div>
            </td>
            <td className="py-3 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#555' }}>{p.units}</td>
            <td className="py-3 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#555' }}>{p.orders}</td>
            <td className="py-3 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#c9a84c' }}>{fmtUsd(p.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UpsellsPanel({ upsells }: { upsells: Upsell[] }) {
  if (!upsells.length) return (
    <div className="py-12 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#ddd', fontFamily: 'system-ui' }}>
        No upsell opportunities identified yet
      </p>
    </div>
  );

  const buckets = {
    storefront: upsells.filter(u => !u.isPublished && u.isOrdered),
    pricing   : upsells.filter(u => u.priceGap > 15 || (u.margin !== null && u.margin < 40)),
  };

  return (
    <div className="space-y-8">
      {buckets.storefront.length > 0 && (
        <div>
          <p className="text-[7.5px] uppercase tracking-[0.4em] mb-4" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            ↑ Add to Storefront — buyers are already ordering these
          </p>
          <div className="space-y-2">
            {buckets.storefront.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-100">
                <div>
                  <p className="text-[12px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>{u.title}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#b45309', fontFamily: 'system-ui' }}>{u.opportunity}</p>
                </div>
                <div className="text-right">
                  {u.srp !== null && (
                    <p className="text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#c9a84c' }}>
                      SRP {fmtUsd(u.srp)}
                    </p>
                  )}
                  {u.margin !== null && (
                    <p className="text-[9px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>{u.margin.toFixed(0)}% margin</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {buckets.pricing.length > 0 && (
        <div>
          <p className="text-[7.5px] uppercase tracking-[0.4em] mb-4" style={{ color: '#888', fontFamily: 'system-ui' }}>
            ◎ Pricing Opportunities
          </p>
          <div className="space-y-2">
            {buckets.pricing.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 border border-zinc-100">
                <div>
                  <p className="text-[12px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>{u.title}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#888', fontFamily: 'system-ui' }}>{u.opportunity}</p>
                </div>
                <div className="text-right">
                  {u.srp !== null && (
                    <p className="text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#555' }}>
                      SRP {fmtUsd(u.srp)}
                    </p>
                  )}
                  {u.margin !== null && (
                    <p className="text-[9px]" style={{ color: u.margin < 40 ? '#c0392b' : '#bbb', fontFamily: 'system-ui' }}>
                      {u.margin.toFixed(0)}% margin
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!orders.length) return (
    <div className="py-12 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#ddd', fontFamily: 'system-ui' }}>No orders yet</p>
    </div>
  );

  const statusColor = (s: string) =>
    s === 'confirmed' ? '#52b788' : s === 'new' ? '#c9a84c' : s === 'cancelled' ? '#c0392b' : '#bbb';

  return (
    <div className="space-y-px">
      {orders.map(o => (
        <div key={o.id}>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors"
               onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
            <span className="text-[9px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#bbb', width: '120px' }}>{o.id}</span>
            <span className="flex-1 text-[12px]" style={{ fontFamily: 'system-ui', color: '#333' }}>{o.buyer_name ?? '—'}</span>
            <span className="text-[8px] uppercase tracking-[0.3em] px-2 py-0.5"
                  style={{ color: statusColor(o.status), border: `1px solid ${statusColor(o.status)}`, fontFamily: 'system-ui' }}>
              {o.status}
            </span>
            <span className="text-[12px] w-24 text-right" style={{ fontFamily: 'var(--font-mono), monospace', color: '#c9a84c' }}>
              {fmtUsd(o.brand_total)}
            </span>
            <span className="text-[9px] w-24 text-right" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
              {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
            </span>
            <span className="text-[9px]" style={{ color: '#ddd' }}>{expanded === o.id ? '▲' : '▼'}</span>
          </div>

          {expanded === o.id && (
            <div className="px-4 pb-4 bg-zinc-50 border-b border-zinc-100">
              <table className="w-full mt-2">
                <thead>
                  <tr>
                    {['Item', 'Qty', 'WSP', 'Line Total'].map(h => (
                      <th key={h} className="pb-2 text-left text-[7px] uppercase tracking-[0.35em]"
                          style={{ color: '#bbb', fontFamily: 'system-ui', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((item, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-2 text-[11px]" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#333' }}>{item.title}</td>
                      <td className="py-2 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#555' }}>{item.qty}</td>
                      <td className="py-2 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#555' }}>{fmtUsd(item.wholesale_price)}</td>
                      <td className="py-2 text-[11px]" style={{ fontFamily: 'var(--font-mono), monospace', color: '#c9a84c' }}>{fmtUsd(item.wholesale_price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'products' | 'upsells' | 'orders';

export default function ReportsClient() {
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('overview');

  useEffect(() => {
    fetch('/api/brand-store/reports')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'products',  label: 'Top Products' },
    { key: 'upsells',   label: `Opportunities${data?.upsells.length ? ` (${data.upsells.length})` : ''}` },
    { key: 'orders',    label: 'Orders' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#ddd', fontFamily: 'system-ui' }}>Loading…</p>
      </div>
    );
  }

  if (!data || 'error' in data) {
    return (
      <div className="py-12 text-center">
        <p className="text-[11px]" style={{ color: '#aaa', fontFamily: 'system-ui' }}>Could not load report data.</p>
      </div>
    );
  }

  return (
    <div>
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

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Total WSP Revenue"  value={fmtUsd(data.kpis.totalRevenue)} />
            <KpiCard label="Units Sold"         value={fmt(data.kpis.totalUnits)} />
            <KpiCard label="Orders"             value={fmt(data.kpis.totalOrders)} />
            <KpiCard label="Avg Order Value"    value={fmtUsd(data.kpis.avgOrderValue)} />
          </div>

          <div className="border border-zinc-100 p-8">
            <p className="text-[7.5px] uppercase tracking-[0.5em] mb-8" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
              Revenue Trend
            </p>
            <TrendChart trend={data.trend} />
          </div>

          {data.upsells.length > 0 && (
            <div className="border border-amber-100 bg-amber-50 p-6">
              <p className="text-[7.5px] uppercase tracking-[0.4em] mb-2" style={{ color: '#b45309', fontFamily: 'system-ui' }}>
                {data.upsells.length} Upsell {data.upsells.length === 1 ? 'Opportunity' : 'Opportunities'} Identified
              </p>
              <p className="text-[11px] mb-4" style={{ color: '#92400e', fontFamily: 'system-ui' }}>
                {data.upsells.filter(u => !u.isPublished && u.isOrdered).length} products buyers are ordering are missing from your storefront.
              </p>
              <button onClick={() => setTab('upsells')}
                      className="text-[7.5px] uppercase tracking-[0.4em] hover:opacity-70 transition-opacity"
                      style={{ color: '#b45309', fontFamily: 'system-ui' }}>
                View All →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Products */}
      {tab === 'products' && (
        <div className="border border-zinc-100 p-8">
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-8" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
            Top Products by WSP Revenue
          </p>
          <TopProductsTable products={data.topProducts} />
        </div>
      )}

      {/* Upsells */}
      {tab === 'upsells' && (
        <div>
          <p className="text-[11px] mb-8" style={{ color: '#888', fontFamily: 'system-ui', lineHeight: 1.7 }}>
            Identified from your inventory, order history, and storefront pricing. Act on these to increase revenue.
          </p>
          <UpsellsPanel upsells={data.upsells} />
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div className="border border-zinc-100">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-[7.5px] uppercase tracking-[0.5em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
              Recent Orders — Your Brand
            </p>
            <p className="text-[9px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
              Click a row to expand items
            </p>
          </div>
          <RecentOrdersTable orders={data.recentOrders} />
        </div>
      )}
    </div>
  );
}
