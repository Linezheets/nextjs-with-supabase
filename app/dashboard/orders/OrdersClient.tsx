'use client';

import { useState, useRef, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Installment = {
  id             : string;
  installment_seq: number;
  amount_usd     : number;
  status         : string;
  due_date       : string | null;
  method         : string;
  created_at     : string;
};

type OrderItem = {
  item_id        : string;
  brand_name     : string;
  title          : string;
  style_number   : string | null;
  colour         : string | null;
  image_url      : string | null;
  retail_price   : number;
  wholesale_price: number;
  sizes          : Record<string, number>;
  qty            : number;
};

type Order = {
  id             : string;
  status         : string;
  payment_status : string | null;
  total_usd      : number;
  terms          : string | null;
  notes          : string | null;
  items          : OrderItem[];
  created_at     : string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  new       : '#c9a84c',
  confirmed : '#52b788',
  shipped   : '#7cb9e8',
  delivered : '#52b788',
  cancelled : '#aaa',
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  unpaid             : { label: 'Unpaid',      color: '#df1b41' },
  pending_wire       : { label: 'Wire Pending', color: '#c9a84c' },
  payment_processing : { label: 'Processing',  color: '#7cb9e8' },
  paid               : { label: 'Paid',        color: '#52b788' },
  payment_failed     : { label: 'Failed',      color: '#df1b41' },
};

function PaymentBadge({ order }: { order: Order }) {
  const ps = order.payment_status ?? 'unpaid';
  const info = PAYMENT_LABEL[ps] ?? { label: ps, color: '#aaa' };
  const canPay = ps === 'unpaid' || ps === 'payment_failed';

  return (
    <div className="flex items-center gap-3">
      <span className="text-[7px] uppercase tracking-[0.35em] px-2 py-0.5"
            style={{ background: info.color, color: '#fff', fontFamily: 'system-ui' }}>
        {info.label}
      </span>
      {canPay && (
        <a
          href={`/checkout?order_id=${order.id}`}
          className="text-[7px] uppercase tracking-[0.35em] px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
          style={{ fontFamily: 'system-ui', color: '#111' }}
        >
          Pay Now →
        </a>
      )}
    </div>
  );
}

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Invoice download / view actions ──────────────────────────────────────────

function InvoiceActions({ orderId }: { orderId: string }) {
  const [loading,  setLoading]  = useState<false | 'invoice' | 'proforma'>(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  async function triggerDownload(fmt: 'invoice' | 'proforma') {
    if (loading) return;
    setLoading(fmt);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice?format=${fmt}`);
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${fmt}-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not generate invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const busy = !!loading;

  return (
    <div ref={menuRef} className="relative flex items-center">
      {/* Primary download button */}
      <button
        onClick={() => triggerDownload('invoice')}
        disabled={busy}
        className="flex items-center gap-1.5 text-[7px] uppercase tracking-[0.35em] px-3 py-1.5
                   border-t border-b border-l border-zinc-200 hover:border-zinc-700
                   transition-colors disabled:opacity-40"
        style={{ fontFamily: 'system-ui', color: busy ? '#ccc' : '#888' }}
        title="Download invoice PDF"
      >
        {loading === 'invoice' ? (
          <span className="inline-block w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
        ) : '↓'}
        {' '}Invoice
      </button>

      {/* Chevron — opens dropdown */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        disabled={busy}
        className="text-[8px] px-2 py-1.5 border border-zinc-200 hover:border-zinc-700
                   transition-colors disabled:opacity-40"
        style={{ color: '#bbb', lineHeight: 1 }}
        aria-label="More invoice options"
      >
        {menuOpen ? '▴' : '▾'}
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 border border-zinc-200 bg-white z-20 min-w-[148px] shadow-sm">
          <button
            onClick={() => { setMenuOpen(false); window.open(`/api/orders/${orderId}/invoice`, '_blank'); }}
            className="w-full text-left px-4 py-2.5 text-[7px] uppercase tracking-[0.35em]
                       hover:bg-zinc-50 transition-colors"
            style={{ fontFamily: 'system-ui', color: '#555' }}
          >
            View in browser ↗
          </button>
          <div className="border-t border-zinc-100" />
          <button
            onClick={() => triggerDownload('proforma')}
            disabled={loading === 'proforma'}
            className="w-full text-left px-4 py-2.5 text-[7px] uppercase tracking-[0.35em]
                       hover:bg-zinc-50 transition-colors disabled:opacity-40 flex items-center gap-2"
            style={{ fontFamily: 'system-ui', color: '#555' }}
          >
            {loading === 'proforma' && (
              <span className="inline-block w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
            )}
            Proforma ↓
          </button>
        </div>
      )}
    </div>
  );
}

const INST_STATUS: Record<string, { label: string; color: string }> = {
  pending    : { label: 'Due',      color: '#c9a84c' },
  processing : { label: 'Processing', color: '#7cb9e8' },
  paid       : { label: 'Paid',     color: '#52b788' },
  failed     : { label: 'Failed',   color: '#df1b41' },
  overdue    : { label: 'Overdue',  color: '#df1b41' },
};

function InstallmentSchedule({ installments }: { installments: Installment[] }) {
  const [open, setOpen] = useState(false);
  if (installments.length < 2) return null;

  const paid    = installments.filter(i => i.status === 'paid').length;
  const total   = installments.length;
  const nextDue = installments.find(i => i.status !== 'paid' && i.status !== 'waived');

  return (
    <div className="border-t border-zinc-100">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-8 py-3 hover:bg-zinc-50 transition-colors"
        style={{ fontFamily: 'system-ui' }}
      >
        <div className="flex items-center gap-4">
          <span className="text-[7.5px] uppercase tracking-[0.4em]" style={{ color: '#888' }}>
            Instalments
          </span>
          <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}>
            {paid}/{total} Paid
          </span>
          {nextDue?.due_date && (
            <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#bbb' }}>
              · Next: {new Date(nextDue.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: '#bbb' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-8 pb-6">
          <div className="border border-zinc-100">
            {installments.map((inst, idx) => {
              const info = INST_STATUS[inst.status] ?? { label: inst.status, color: '#aaa' };
              const dueStr = inst.due_date
                ? new Date(inst.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : inst.installment_seq === 1
                  ? new Date(inst.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
              return (
                <div key={inst.id}
                     className={`flex items-center justify-between px-6 py-3 ${idx < installments.length - 1 ? 'border-b border-zinc-50' : ''}`}>
                  <div className="flex items-center gap-6">
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#bbb', minWidth: '18px' }}>
                      {inst.installment_seq}
                    </span>
                    <span className="text-[7px] uppercase tracking-[0.25em] px-2 py-0.5"
                          style={{ background: info.color, color: '#fff', fontFamily: 'system-ui' }}>
                      {info.label}
                    </span>
                    <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                      {inst.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-8">
                    <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
                      {dueStr}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '12px', color: inst.status === 'paid' ? '#52b788' : '#c9a84c' }}>
                      {fmtUSD(Number(inst.amount_usd))}
                    </span>
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

function groupByBrand(items: OrderItem[]): Record<string, OrderItem[]> {
  const out: Record<string, OrderItem[]> = {};
  for (const item of items) {
    const key = item.brand_name || 'Unknown Brand';
    (out[key] ??= []).push(item);
  }
  return out;
}

const SIZE_COLS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS', 'ONE SIZE'];

function activeSizes(items: OrderItem[]): string[] {
  const found = new Set<string>();
  for (const item of items) {
    for (const k of Object.keys(item.sizes ?? {})) {
      if (Number(item.sizes[k]) > 0) found.add(k.toUpperCase());
    }
  }
  return SIZE_COLS.filter(s => found.has(s));
}

// ── Line-sheet view (per-brand table) ────────────────────────────────────────

function LineSheetOrder({ order, installments }: { order: Order; installments: Installment[] }) {
  const byBrand = groupByBrand(order.items);
  const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="border border-zinc-100 mb-8">
      {/* Order header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-center gap-6">
          <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#555' }}>{order.id}</p>
          <span className="text-[7px] uppercase tracking-[0.35em] px-2 py-0.5"
                style={{ background: STATUS_COLOR[order.status] ?? '#ccc', color: '#fff', fontFamily: 'system-ui' }}>
            {order.status}
          </span>
          <PaymentBadge order={order} />
        </div>
        <div className="flex items-center gap-8">
          <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#aaa', fontFamily: 'system-ui' }}>{date}</p>
          <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', color: '#c9a84c' }}>
            {fmtUSD(Number(order.total_usd))}
          </p>
          <InvoiceActions orderId={order.id} />
        </div>
      </div>

      {/* Per-brand line sheet */}
      {Object.entries(byBrand).map(([brand, items]) => {
        const sizes = activeSizes(items);
        const brandTotal = items.reduce((s, i) => s + (i.wholesale_price * i.qty), 0);

        return (
          <div key={brand} className="border-b border-zinc-50 last:border-0">
            {/* Brand header */}
            <div className="flex items-start justify-between px-8 py-4 bg-white border-b border-zinc-50">
              <div>
                <p style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: '1.1rem', fontWeight: 400, color: '#111',
                }}>
                  {brand}
                </p>
                {order.terms && (
                  <p className="text-[8px] uppercase tracking-[0.3em] mt-1" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                    Payment Terms: {order.terms}
                  </p>
                )}
              </div>
              <p className="text-[8px] uppercase tracking-[0.3em] mt-1" style={{ color: '#888', fontFamily: 'system-ui' }}>
                Total: {fmtUSD(brandTotal)}
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-2 text-[7px] uppercase tracking-[0.35em] font-normal" style={{ color: '#bbb', minWidth: '70px' }}>SKU</th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal" style={{ color: '#bbb', width: '44px' }}></th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal" style={{ color: '#bbb' }}>Colour</th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal" style={{ color: '#bbb' }}>Description</th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal text-right" style={{ color: '#bbb' }}>Retail USD</th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal text-right" style={{ color: '#bbb' }}>Wholesale</th>
                    {sizes.map(s => (
                      <th key={s} className="px-2 py-2 text-[7px] uppercase tracking-[0.2em] font-normal text-center" style={{ color: '#bbb', minWidth: '30px' }}>{s}</th>
                    ))}
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal text-center" style={{ color: '#bbb' }}>QTY</th>
                    <th className="px-3 py-2 text-[7px] uppercase tracking-[0.35em] font-normal text-right" style={{ color: '#bbb' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const lineTotal = item.wholesale_price * item.qty;
                    return (
                      <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 text-[10px]" style={{ color: '#888', fontFamily: 'var(--font-mono), monospace' }}>
                          {item.style_number ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt="" className="w-9 h-9 object-cover grayscale" />
                          ) : (
                            <div className="w-9 h-9 bg-zinc-100" />
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11px]" style={{ color: '#555' }}>{item.colour ?? '—'}</td>
                        <td className="px-3 py-3 text-[11px]" style={{ color: '#333' }}>{item.title}</td>
                        <td className="px-3 py-3 text-[11px] text-right" style={{ color: '#aaa', fontFamily: 'var(--font-mono), monospace' }}>
                          {fmtUSD(item.retail_price)}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-right" style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}>
                          {fmtUSD(item.wholesale_price)}
                        </td>
                        {sizes.map(s => (
                          <td key={s} className="px-2 py-3 text-[11px] text-center" style={{ color: '#555', fontFamily: 'var(--font-mono), monospace' }}>
                            {item.sizes?.[s] > 0 ? item.sizes[s] : <span style={{ color: '#ddd' }}>—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-[11px] text-center font-medium" style={{ color: '#333', fontFamily: 'var(--font-mono), monospace' }}>
                          {item.qty}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-right font-medium" style={{ color: '#333', fontFamily: 'var(--font-mono), monospace' }}>
                          {fmtUSD(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Order notes */}
      {order.notes && (
        <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
          <p className="text-[7.5px] uppercase tracking-[0.3em] mb-1" style={{ color: '#bbb', fontFamily: 'system-ui' }}>Notes</p>
          <p className="text-[11px]" style={{ color: '#666', fontFamily: 'system-ui' }}>{order.notes}</p>
        </div>
      )}

      <InstallmentSchedule installments={installments} />
    </div>
  );
}

// ── Grid view (brand-grouped product cards) ───────────────────────────────────

function GridOrder({ order, installments }: { order: Order; installments: Installment[] }) {
  const byBrand = groupByBrand(order.items);
  const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="border border-zinc-100 mb-8">
      {/* Order header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-center gap-6">
          <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#555' }}>{order.id}</p>
          <span className="text-[7px] uppercase tracking-[0.35em] px-2 py-0.5"
                style={{ background: STATUS_COLOR[order.status] ?? '#ccc', color: '#fff', fontFamily: 'system-ui' }}>
            {order.status}
          </span>
          <PaymentBadge order={order} />
        </div>
        <div className="flex items-center gap-8">
          <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#aaa', fontFamily: 'system-ui' }}>{date}</p>
          <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', color: '#c9a84c' }}>
            {fmtUSD(Number(order.total_usd))}
          </p>
          <InvoiceActions orderId={order.id} />
        </div>
      </div>

      {Object.entries(byBrand).map(([brand, items]) => (
        <div key={brand} className="border-b border-zinc-50 last:border-0 px-8 py-8">
          <p className="text-[8px] uppercase tracking-[0.5em] mb-6" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
            {brand}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map((item, i) => (
              <div key={i} className="group">
                <div className="relative aspect-[2/3] bg-zinc-50 mb-3 overflow-hidden">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.title}
                         className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-px bg-zinc-200" />
                    </div>
                  )}
                  {/* Qty badge */}
                  <div className="absolute bottom-2 right-2 min-w-[22px] h-[22px] flex items-center justify-center px-1.5"
                       style={{ background: '#111' }}>
                    <p className="text-[8px]" style={{ color: '#fff', fontFamily: 'var(--font-mono), monospace' }}>×{item.qty}</p>
                  </div>
                </div>
                <p className="text-[7.5px] uppercase tracking-[0.25em] mb-0.5 truncate"
                   style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                  {item.style_number ?? item.colour ?? ''}
                </p>
                <p className="text-[12px] truncate" style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>
                  {item.title}
                </p>
                <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#c9a84c', marginTop: '3px' }}>
                  {fmtUSD(item.wholesale_price * item.qty)}
                </p>
                {/* Size breakdown */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(item.sizes ?? {}).filter(([, v]) => Number(v) > 0).map(([s, v]) => (
                    <span key={s} className="text-[7px] px-1.5 py-0.5 border border-zinc-100"
                          style={{ color: '#888', fontFamily: 'var(--font-mono), monospace' }}>
                      {s}:{v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <InstallmentSchedule installments={installments} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyOrders() {
  return (
    <div className="py-32 text-center">
      <div className="w-12 h-px mx-auto mb-12" style={{ background: '#e8e8e8' }} />
      <h2 style={{
        fontFamily: 'var(--font-serif), Georgia, serif',
        fontSize: 'clamp(1.8rem, 4vw, 3rem)',
        fontWeight: 400, lineHeight: 1.05, color: '#ccc',
      }}>
        No orders yet
      </h2>
      <p className="mt-4 text-[12px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
        Browse the showroom, add to your cart and place a wholesale order.
      </p>
      <a href="/" className="inline-block mt-8 px-10 py-3 text-[8px] uppercase tracking-[0.45em]
                              border border-zinc-200 text-zinc-400
                              hover:border-zinc-800 hover:text-zinc-800 transition-colors"
         style={{ fontFamily: 'system-ui' }}>
        Browse Showroom →
      </a>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrdersClient({
  initialOrders,
  installmentsByOrder = {},
}: {
  initialOrders      : Order[];
  installmentsByOrder: Record<string, Installment[]>;
}) {
  const [view,   setView]   = useState<'linesheet' | 'grid'>('linesheet');
  const [filter, setFilter] = useState<string>('all');

  const statuses = ['all', ...Array.from(new Set(initialOrders.map(o => o.status)))];

  const orders = filter === 'all'
    ? initialOrders
    : initialOrders.filter(o => o.status === filter);

  const totalSpend = initialOrders.reduce((s, o) => s + Number(o.total_usd), 0);

  return (
    <>
      {/* Stats */}
      <div className="flex items-center gap-8 mb-14 pb-8 border-b border-zinc-100">
        {[
          { label: 'Orders',      value: String(initialOrders.length) },
          { label: 'Total Spend', value: totalSpend > 0 ? fmtUSD(totalSpend) : '—' },
          { label: 'Pending',     value: String(initialOrders.filter(o => o.status === 'new').length) },
        ].map(({ label, value }, i, arr) => (
          <div key={label} className="flex items-center gap-8">
            <div>
              <p className="text-[7px] uppercase tracking-[0.45em] mb-1" style={{ color: '#ccc', fontFamily: 'system-ui' }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '2rem', fontWeight: 400, color: '#111' }}>{value}</p>
            </div>
            {i < arr.length - 1 && <div className="w-px h-10 bg-zinc-100" />}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        {/* Status filter */}
        <div className="flex items-center gap-6">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
                    className="text-[7.5px] uppercase tracking-[0.4em] transition-colors pb-1"
                    style={{
                      fontFamily  : 'system-ui',
                      color       : filter === s ? '#111' : '#bbb',
                      borderBottom: filter === s ? '1px solid #111' : '1px solid transparent',
                    }}>
              {s}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-zinc-200">
          {([['linesheet', 'Line Sheet'], ['grid', 'Grid']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
                    className="px-4 py-2 text-[7.5px] uppercase tracking-[0.35em] transition-colors"
                    style={{
                      fontFamily: 'system-ui',
                      background: view === v ? '#111' : 'white',
                      color     : view === v ? '#fff' : '#bbb',
                    }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      {orders.length === 0 ? <EmptyOrders /> : (
        view === 'linesheet'
          ? orders.map(o => <LineSheetOrder key={o.id} order={o} installments={installmentsByOrder[o.id] ?? []} />)
          : orders.map(o => <GridOrder      key={o.id} order={o} installments={installmentsByOrder[o.id] ?? []} />)
      )}
    </>
  );
}
