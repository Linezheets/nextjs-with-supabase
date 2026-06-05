'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SellThroughRow } from '@/app/api/brand/analytics/sell-through/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type ColorRow    = { color: string; units_ordered: number; revenue_usd: number; sku_count: number; avg_sell_through: number };
type CategoryRow = { category: string; units_ordered: number; revenue_usd: number; sku_count: number; avg_sell_through: number };
type SizeRow     = { size: string; units: number; pct: number };
type Signal      = { type: 'reorder' | 'cut' | 'watch' | 'cancel'; title: string; reason: string; inventory_id: number };

type AnalyticsData = {
  brand_name       : string;
  currency         : string;
  skus             : SellThroughRow[];
  by_color         : ColorRow[];
  by_category      : CategoryRow[];
  size_curve       : SizeRow[];
  status_counts    : { strong: number; moving: number; slow: number; dead: number };
  production_signals: Signal[];
  total_revenue    : number;
  total_units      : number;
};

type View = 'overview' | 'skus' | 'color' | 'size' | 'signals';
type StatusFilter = 'all' | 'strong' | 'moving' | 'slow' | 'dead';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<SellThroughRow['status'], string> = {
  strong : '#6bc88a',
  moving : '#c9a84c',
  slow   : '#e8973a',
  dead   : '#e87c7c',
};

const STATUS_LABEL: Record<SellThroughRow['status'], string> = {
  strong : 'Strong',
  moving : 'Moving',
  slow   : 'Slow',
  dead   : 'Dead Stock',
};

const SIGNAL_COLOR: Record<Signal['type'], string> = {
  reorder: '#6bc88a',
  watch  : '#c9a84c',
  cut    : '#e8973a',
  cancel : '#e87c7c',
};

const SIGNAL_LABEL: Record<Signal['type'], string> = {
  reorder: '↑ Reorder',
  watch  : '◎ Watch',
  cut    : '↓ Cut',
  cancel : '✕ Cancel',
};

function makeFmt(currency: string) {
  return (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 0 }).format(n);
}
// fallback until data loads
const fmt = makeFmt('USD');

function SellBar({ pct, status }: { pct: number; status: SellThroughRow['status'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: STATUS_COLOR[status] }} />
      </div>
      <span className="text-[9px] w-8 text-right tabular-nums" style={{ color: STATUS_COLOR[status], fontFamily: 'DM Mono, monospace' }}>
        {pct}%
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: SellThroughRow['status'] }) {
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />;
}

// ── Overview panel ────────────────────────────────────────────────────────────

function Overview({ data }: { data: AnalyticsData }) {
  const fmt = makeFmt(data.currency ?? 'USD');
  const totalSkus = data.skus.length;
  const { strong, moving, slow, dead } = data.status_counts;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-px" style={{ background: '#1e1e1e' }}>
        {[
          { label: 'Total Revenue', value: fmt(data.total_revenue) },
          { label: 'Units Ordered', value: data.total_units.toLocaleString() },
          { label: 'Active SKUs', value: totalSkus.toString() },
          { label: 'Avg Sell-Through', value: totalSkus > 0 ? `${Math.round(data.skus.reduce((s, r) => s + r.sell_through_pct, 0) / totalSkus)}%` : '—' },
        ].map(kpi => (
          <div key={kpi.label} className="px-5 py-4" style={{ background: '#111' }}>
            <div className="text-[8px] uppercase tracking-[0.35em] mb-1" style={{ color: '#555', fontFamily: 'system-ui' }}>{kpi.label}</div>
            <div className="text-[20px] font-light" style={{ color: '#fff', fontFamily: 'DM Mono, monospace' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div>
        <h3 className="text-[8px] uppercase tracking-[0.4em] mb-3" style={{ color: '#555', fontFamily: 'system-ui' }}>SKU Health</h3>
        <div className="grid grid-cols-4 gap-3">
          {([['strong', strong], ['moving', moving], ['slow', slow], ['dead', dead]] as [SellThroughRow['status'], number][]).map(([s, count]) => (
            <div key={s} className="px-4 py-3 border" style={{ borderColor: STATUS_COLOR[s] + '33', background: STATUS_COLOR[s] + '0a' }}>
              <div className="text-[8px] uppercase tracking-[0.3em] mb-1" style={{ color: STATUS_COLOR[s], fontFamily: 'system-ui' }}>{STATUS_LABEL[s]}</div>
              <div className="text-[22px] font-light" style={{ color: STATUS_COLOR[s], fontFamily: 'DM Mono, monospace' }}>{count}</div>
              <div className="text-[8px] mt-0.5" style={{ color: '#444', fontFamily: 'system-ui' }}>{totalSkus > 0 ? `${Math.round((count / totalSkus) * 100)}%` : '0%'} of catalog</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top categories */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-[8px] uppercase tracking-[0.4em] mb-3" style={{ color: '#555', fontFamily: 'system-ui' }}>By Category</h3>
          <div className="space-y-2">
            {data.by_category.slice(0, 6).map(c => (
              <div key={c.category}>
                <div className="flex justify-between text-[9px] mb-1" style={{ fontFamily: 'system-ui' }}>
                  <span style={{ color: '#ccc' }}>{c.category}</span>
                  <span style={{ color: '#666' }}>{c.units_ordered} units · {fmt(c.revenue_usd)}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${c.avg_sell_through}%`,
                    background: c.avg_sell_through >= 70 ? STATUS_COLOR.strong : c.avg_sell_through >= 35 ? STATUS_COLOR.moving : STATUS_COLOR.slow,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-[8px] uppercase tracking-[0.4em] mb-3" style={{ color: '#555', fontFamily: 'system-ui' }}>By Color</h3>
          <div className="space-y-2">
            {data.by_color.slice(0, 6).map(c => (
              <div key={c.color}>
                <div className="flex justify-between text-[9px] mb-1" style={{ fontFamily: 'system-ui' }}>
                  <span style={{ color: '#ccc' }}>{c.color || 'Unknown'}</span>
                  <span style={{ color: '#666' }}>{c.units_ordered} units · {c.avg_sell_through}% ST</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${c.avg_sell_through}%`,
                    background: c.avg_sell_through >= 70 ? STATUS_COLOR.strong : c.avg_sell_through >= 35 ? STATUS_COLOR.moving : STATUS_COLOR.slow,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Size curve */}
      {data.size_curve.length > 0 && (
        <div>
          <h3 className="text-[8px] uppercase tracking-[0.4em] mb-3" style={{ color: '#555', fontFamily: 'system-ui' }}>Size Curve</h3>
          <div className="flex items-end gap-2" style={{ height: 64 }}>
            {data.size_curve.map(s => (
              <div key={s.size} className="flex flex-col items-center gap-1" style={{ minWidth: 36 }}>
                <span className="text-[8px] tabular-nums" style={{ color: '#888', fontFamily: 'DM Mono, monospace' }}>{s.pct}%</span>
                <div className="w-full rounded-t-sm" style={{ height: `${Math.max(4, s.pct)}%`, background: '#c9a84c', minHeight: 4 }} />
                <span className="text-[8px]" style={{ color: '#666', fontFamily: 'system-ui' }}>{s.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SKU table ─────────────────────────────────────────────────────────────────

function SkuTable({ skus, currency }: { skus: SellThroughRow[]; currency?: string }) {
  const fmt = makeFmt(currency ?? 'USD');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'sell_through' | 'units' | 'revenue' | 'stock'>('sell_through');
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');

  function toggleSort(col: typeof sort) {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setDir('desc'); }
  }

  const filtered = useMemo(() => {
    let rows = skus;
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (search) rows = rows.filter(r =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.color ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return [...rows].sort((a, b) => {
      const m = dir === 'desc' ? -1 : 1;
      if (sort === 'sell_through') return m * (a.sell_through_pct - b.sell_through_pct);
      if (sort === 'units')        return m * (a.units_ordered - b.units_ordered);
      if (sort === 'revenue')      return m * (a.revenue_usd - b.revenue_usd);
      if (sort === 'stock')        return m * (a.stock_total - b.stock_total);
      return 0;
    });
  }, [skus, statusFilter, search, sort, dir]);

  function Th({ col, label }: { col: typeof sort; label: string }) {
    const active = sort === col;
    return (
      <button onClick={() => toggleSort(col)}
              className="text-[7.5px] uppercase tracking-[0.3em] hover:opacity-70 flex items-center gap-1"
              style={{ color: active ? '#c9a84c' : '#555', fontFamily: 'system-ui' }}>
        {label}
        {active && <span style={{ color: '#c9a84c' }}>{dir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, SKU, color…"
               className="flex-1 max-w-xs px-3 py-1.5 text-[10px] bg-transparent border outline-none"
               style={{ borderColor: '#2a2a2a', color: '#fff', fontFamily: 'system-ui' }} />
        <div className="flex gap-1">
          {(['all', 'strong', 'moving', 'slow', 'dead'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 text-[7.5px] uppercase tracking-[0.25em] transition-colors"
                    style={{
                      background: statusFilter === s ? (s === 'all' ? '#c9a84c' : STATUS_COLOR[s as SellThroughRow['status']]) : 'transparent',
                      color: statusFilter === s ? '#000' : (s === 'all' ? '#666' : STATUS_COLOR[s as SellThroughRow['status']] + 'bb'),
                      border: `1px solid ${s === 'all' ? '#333' : STATUS_COLOR[s as SellThroughRow['status']] + '44'}`,
                      fontFamily: 'system-ui',
                    }}>
              {s === 'all' ? 'All' : STATUS_LABEL[s as SellThroughRow['status']]}
            </button>
          ))}
        </div>
        <span className="text-[8px]" style={{ color: '#444', fontFamily: 'system-ui' }}>{filtered.length} SKUs</span>
      </div>

      {/* Table */}
      <div className="border" style={{ borderColor: '#1e1e1e' }}>
        <div className="grid border-b px-4 py-2" style={{ borderColor: '#1e1e1e', gridTemplateColumns: '2fr 80px 80px 1fr 1fr 1fr 1fr' }}>
          <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#555', fontFamily: 'system-ui' }}>Style / SKU</span>
          <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#555', fontFamily: 'system-ui' }}>Color</span>
          <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#555', fontFamily: 'system-ui' }}>Category</span>
          <Th col="sell_through" label="Sell-Through" />
          <Th col="units" label="Ordered" />
          <Th col="stock" label="On Hand" />
          <Th col="revenue" label="Revenue" />
        </div>
        <div className="divide-y" style={{ borderColor: '#131313' }}>
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[10px]" style={{ color: '#444', fontFamily: 'system-ui' }}>No SKUs match the filter.</div>
          )}
          {filtered.map(r => (
            <div key={r.inventory_id} className="grid px-4 py-3 items-center hover:bg-[#0f0f0f]"
                 style={{ gridTemplateColumns: '2fr 80px 80px 1fr 1fr 1fr 1fr' }}>
              <div>
                <div className="flex items-center gap-2">
                  <StatusDot status={r.status} />
                  <span className="text-[10px] font-medium" style={{ color: '#ddd', fontFamily: 'system-ui' }}>{r.title}</span>
                </div>
                {r.sku && <div className="text-[8px] pl-4" style={{ color: '#444', fontFamily: 'DM Mono, monospace' }}>{r.sku}</div>}
                {(r.season || r.line) && (
                  <div className="text-[8px] pl-4" style={{ color: '#444', fontFamily: 'system-ui' }}>
                    {[r.season, r.line].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span className="text-[9px]" style={{ color: '#888', fontFamily: 'system-ui' }}>{r.color || '—'}</span>
              <span className="text-[9px]" style={{ color: '#666', fontFamily: 'system-ui' }}>{r.category}</span>
              <SellBar pct={r.sell_through_pct} status={r.status} />
              <span className="text-[10px] tabular-nums" style={{ color: r.units_ordered > 0 ? '#ccc' : '#444', fontFamily: 'DM Mono, monospace' }}>
                {r.units_ordered}
              </span>
              <span className="text-[10px] tabular-nums" style={{ color: r.stock_total > 0 ? '#ccc' : '#444', fontFamily: 'DM Mono, monospace' }}>
                {r.stock_total}
              </span>
              <span className="text-[10px] tabular-nums" style={{ color: r.revenue_usd > 0 ? '#ccc' : '#444', fontFamily: 'DM Mono, monospace' }}>
                {r.revenue_usd > 0 ? fmt(r.revenue_usd) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Color view ────────────────────────────────────────────────────────────────

function ColorView({ data }: { data: AnalyticsData }) {
  const fmt = makeFmt(data.currency ?? 'USD');
  const maxUnits = Math.max(1, ...data.by_color.map(c => c.units_ordered));

  return (
    <div>
      <div className="mb-5 text-[9px]" style={{ color: '#555', fontFamily: 'system-ui' }}>
        Bar width = units ordered. Percentage = average sell-through across SKUs in that color.
      </div>
      <div className="space-y-3">
        {data.by_color.map(c => {
          const st = c.avg_sell_through;
          const barColor = st >= 70 ? STATUS_COLOR.strong : st >= 35 ? STATUS_COLOR.moving : STATUS_COLOR.slow;
          return (
            <div key={c.color}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium w-32" style={{ color: '#ddd', fontFamily: 'system-ui' }}>{c.color || 'Unknown'}</span>
                  <span className="text-[8px]" style={{ color: '#555', fontFamily: 'system-ui' }}>{c.sku_count} SKU{c.sku_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-4 text-[9px]" style={{ fontFamily: 'DM Mono, monospace' }}>
                  <span style={{ color: '#888' }}>{c.units_ordered} units</span>
                  <span style={{ color: '#888' }}>{fmt(c.revenue_usd)}</span>
                  <span className="w-10 text-right" style={{ color: barColor }}>{st}% ST</span>
                </div>
              </div>
              <div className="h-5 rounded-sm overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-sm flex items-center pl-2 transition-all"
                     style={{ width: `${(c.units_ordered / maxUnits) * 100}%`, background: barColor + '55', borderLeft: `3px solid ${barColor}` }}>
                  <span className="text-[7.5px]" style={{ color: barColor, fontFamily: 'DM Mono, monospace' }}>{c.units_ordered}</span>
                </div>
              </div>
            </div>
          );
        })}
        {data.by_color.length === 0 && (
          <p className="text-[10px] py-8 text-center" style={{ color: '#444', fontFamily: 'system-ui' }}>No color data yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Size view ─────────────────────────────────────────────────────────────────

function SizeView({ data }: { data: AnalyticsData }) {
  const maxUnits = Math.max(1, ...data.size_curve.map(s => s.units));

  // Per-SKU size distribution for top sellers
  const topSellers = data.skus
    .filter(r => r.units_ordered > 0 && Object.keys(r.sizes_ordered).length > 0)
    .slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Global curve */}
      <div>
        <h3 className="text-[8px] uppercase tracking-[0.4em] mb-4" style={{ color: '#555', fontFamily: 'system-ui' }}>Global Size Curve</h3>
        {data.size_curve.length === 0 ? (
          <p className="text-[10px]" style={{ color: '#444', fontFamily: 'system-ui' }}>No size breakdown data in orders yet.</p>
        ) : (
          <div className="space-y-2">
            {data.size_curve.map(s => (
              <div key={s.size} className="flex items-center gap-3">
                <span className="text-[10px] w-8 text-right" style={{ color: '#888', fontFamily: 'DM Mono, monospace' }}>{s.size}</span>
                <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ background: '#1a1a1a' }}>
                  <div className="h-full rounded-sm flex items-center pl-2"
                       style={{ width: `${(s.units / maxUnits) * 100}%`, background: '#c9a84c33', borderLeft: '3px solid #c9a84c' }}>
                    <span className="text-[8px]" style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>{s.units}</span>
                  </div>
                </div>
                <span className="text-[9px] w-8 text-right" style={{ color: '#666', fontFamily: 'DM Mono, monospace' }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-style breakdown */}
      {topSellers.length > 0 && (
        <div>
          <h3 className="text-[8px] uppercase tracking-[0.4em] mb-4" style={{ color: '#555', fontFamily: 'system-ui' }}>Top Sellers — Size Breakdown</h3>
          <div className="space-y-4">
            {topSellers.map(r => {
              const sizes = r.sizes_ordered;
              const total = Object.values(sizes).reduce((s, n) => s + n, 0);
              return (
                <div key={r.inventory_id} className="border p-3" style={{ borderColor: '#1e1e1e' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusDot status={r.status} />
                      <span className="text-[10px] font-medium" style={{ color: '#ddd', fontFamily: 'system-ui' }}>{r.title}</span>
                    </div>
                    <span className="text-[8px]" style={{ color: '#555', fontFamily: 'DM Mono, monospace' }}>{total} total units</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(sizes)
                      .sort(([, a], [, b]) => b - a)
                      .map(([sz, qty]) => (
                        <div key={sz} className="px-2 py-1 border text-center" style={{ borderColor: '#2a2a2a', minWidth: 40 }}>
                          <div className="text-[9px] font-medium" style={{ color: '#c9a84c', fontFamily: 'DM Mono, monospace' }}>{qty}</div>
                          <div className="text-[7.5px]" style={{ color: '#555', fontFamily: 'system-ui' }}>{sz}</div>
                          <div className="text-[7px]" style={{ color: '#444', fontFamily: 'DM Mono, monospace' }}>
                            {total > 0 ? `${Math.round((qty / total) * 100)}%` : '—'}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Production Signals ────────────────────────────────────────────────────────

function Signals({ signals }: { signals: Signal[] }) {
  const groups: Record<Signal['type'], Signal[]> = { reorder: [], watch: [], cut: [], cancel: [] };
  for (const s of signals) groups[s.type].push(s);

  return (
    <div className="space-y-6">
      <div className="text-[9px] p-3 border" style={{ borderColor: '#2a2a2a', color: '#888', fontFamily: 'system-ui' }}>
        Production signals are automatically derived from sell-through rates and current stock levels.
        Use these to inform your next buying/production round.
      </div>

      {(['reorder', 'watch', 'cut', 'cancel'] as Signal['type'][]).map(type => {
        const items = groups[type];
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="text-[8px] uppercase tracking-[0.4em] mb-3 flex items-center gap-2"
                style={{ color: SIGNAL_COLOR[type], fontFamily: 'system-ui' }}>
              <span>{SIGNAL_LABEL[type]}</span>
              <span className="px-1.5 py-0.5 text-[7px]" style={{ background: SIGNAL_COLOR[type] + '22' }}>{items.length}</span>
            </h3>
            <div className="space-y-1">
              {items.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2 border"
                     style={{ borderColor: SIGNAL_COLOR[type] + '22', background: SIGNAL_COLOR[type] + '08' }}>
                  <div className="flex-1">
                    <div className="text-[10px] font-medium" style={{ color: '#ddd', fontFamily: 'system-ui' }}>{s.title}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: '#666', fontFamily: 'system-ui' }}>{s.reason}</div>
                  </div>
                  <span className="text-[7.5px] uppercase tracking-[0.2em] px-2 py-0.5 flex-shrink-0"
                        style={{ background: SIGNAL_COLOR[type] + '22', color: SIGNAL_COLOR[type], fontFamily: 'system-ui' }}>
                    {SIGNAL_LABEL[type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {signals.length === 0 && (
        <p className="text-[10px] py-8 text-center" style={{ color: '#444', fontFamily: 'system-ui' }}>
          No production signals yet — add inventory and process orders to see recommendations.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [since, setSince] = useState('');

  // Currency-aware formatter — updates once data loads
  const fmtCurrency = useMemo(() => makeFmt(data?.currency ?? 'USD'), [data?.currency]);

  useEffect(() => {
    const url = since ? `/api/brand/analytics/sell-through?since=${since}` : '/api/brand/analytics/sell-through';
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [since]);

  const VIEWS: { id: View; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'skus',     label: 'SKUs' },
    { id: 'color',    label: 'By Color' },
    { id: 'size',     label: 'By Size' },
    { id: 'signals',  label: 'Production Signals' },
  ];

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
            Sell-Through Analytics
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#444' }}>Since</label>
          <input type="date" value={since} onChange={e => setSince(e.target.value)}
                 className="px-2 py-1 text-[10px] bg-transparent border outline-none"
                 style={{ borderColor: '#2a2a2a', color: '#888' }} />
          {since && (
            <button onClick={() => setSince('')} className="text-[8px] hover:opacity-60" style={{ color: '#555' }}>✕ Clear</button>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div className="border-b flex" style={{ borderColor: '#1e1e1e' }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
                  className="px-5 py-3 text-[8px] uppercase tracking-[0.35em] border-b-2 transition-colors"
                  style={{
                    borderColor: view === v.id ? '#c9a84c' : 'transparent',
                    color: view === v.id ? '#c9a84c' : '#555',
                    fontFamily: 'system-ui',
                  }}>
            {v.label}
            {v.id === 'signals' && data && data.production_signals.length > 0 && (
              <span className="ml-1.5 px-1 py-0.5 text-[7px]" style={{ background: '#c9a84c22', color: '#c9a84c' }}>
                {data.production_signals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-8 max-w-5xl">
        {loading && (
          <div className="py-20 text-center text-[10px] uppercase tracking-[0.4em]" style={{ color: '#333' }}>
            Loading analytics…
          </div>
        )}
        {!loading && error && (
          <div className="py-8 text-center text-[10px]" style={{ color: '#e87c7c' }}>{error}</div>
        )}
        {!loading && !error && data && (
          <>
            {view === 'overview' && <Overview data={data} />}
            {view === 'skus'     && <SkuTable skus={data.skus} currency={data.currency} />}
            {view === 'color'    && <ColorView data={data} />}
            {view === 'size'     && <SizeView data={data} />}
            {view === 'signals'  && <Signals signals={data.production_signals} />}
          </>
        )}
      </div>
    </div>
  );
}
