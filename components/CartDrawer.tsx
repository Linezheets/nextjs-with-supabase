'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { CatalogItem } from '@/lib/types';

// ── Cart context ──────────────────────────────────────────────────────────────

type CartItem = {
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

type CartCtx = {
  items     : CartItem[];
  count     : number;
  open      : boolean;
  setOpen   : (v: boolean) => void;
  addItem   : (item: CatalogItem, sizes: Record<string, number>) => Promise<void>;
  removeItem: (item_id: string) => Promise<void>;
  refresh   : () => Promise<void>;
};

const CartContext = createContext<CartCtx | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'];

// ── Size picker modal ─────────────────────────────────────────────────────────

function SizePickerModal({
  item,
  onConfirm,
  onClose,
}: {
  item      : CatalogItem;
  onConfirm : (sizes: Record<string, number>) => void;
  onClose   : () => void;
}) {
  const [sizes, setSizes] = useState<Record<string, number>>({});

  function inc(s: string) { setSizes(p => ({ ...p, [s]: (p[s] ?? 0) + 1 })); }
  function dec(s: string) { setSizes(p => ({ ...p, [s]: Math.max(0, (p[s] ?? 0) - 1) })); }

  const total = Object.values(sizes).reduce((s, v) => s + v, 0);
  const ws    = Number(item.wholesale_price) || Number(item.retail_price) / 2.5;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm" style={{ borderTop: '2px solid #c9a84c' }}>
        <div className="px-7 pt-7 pb-5 border-b border-zinc-100">
          <p className="text-[7.5px] uppercase tracking-[0.45em] mb-1" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>Add to Order</p>
          <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.1rem', color: '#111' }}>
            {String(item.title ?? item.name ?? '')}
          </p>
          <p className="text-[8px] uppercase tracking-[0.3em] mt-1" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
            {String(item.brand_name ?? '')} · WS {fmtUSD(ws)}
          </p>
        </div>

        <div className="px-7 py-6 space-y-3">
          {SIZE_OPTIONS.map(s => (
            <div key={s} className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#888', fontFamily: 'system-ui' }}>{s}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => dec(s)}
                        className="w-6 h-6 flex items-center justify-center border border-zinc-200 text-[14px] hover:border-zinc-400 transition-colors"
                        style={{ color: '#555' }}>−</button>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', color: '#333', minWidth: '16px', textAlign: 'center' }}>
                  {sizes[s] ?? 0}
                </span>
                <button onClick={() => inc(s)}
                        className="w-6 h-6 flex items-center justify-center border border-zinc-200 text-[14px] hover:border-zinc-400 transition-colors"
                        style={{ color: '#555' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-7 pb-7 flex items-center gap-4">
          <button
            disabled={total === 0}
            onClick={() => { onConfirm(sizes); onClose(); }}
            className="flex-1 py-3 text-[8px] uppercase tracking-[0.45em] text-white transition-opacity disabled:opacity-30"
            style={{ background: '#111', fontFamily: 'system-ui' }}>
            Add {total > 0 ? `(${total})` : ''} →
          </button>
          <button onClick={onClose}
                  className="text-[8px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                  style={{ color: '#aaa', fontFamily: 'system-ui' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cart drawer ───────────────────────────────────────────────────────────────

function CartDrawer({ items, onClose, onRemove, onPlaceOrder }: {
  items        : CartItem[];
  onClose      : () => void;
  onRemove     : (id: string) => void;
  onPlaceOrder : () => void;
}) {
  const byBrand = items.reduce<Record<string, CartItem[]>>((acc, i) => {
    (acc[i.brand_name || 'Unknown'] ??= []).push(i); return acc;
  }, {});

  const total = items.reduce((s, i) => s + i.wholesale_price * i.qty, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white flex flex-col h-full"
           style={{ borderLeft: '1px solid #f0f0f0' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-zinc-100">
          <div>
            <p className="text-[7.5px] uppercase tracking-[0.5em]" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>Wholesale Cart</p>
            <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.2rem', color: '#111' }}>
              {totalQty} {totalQty === 1 ? 'piece' : 'pieces'}
            </p>
          </div>
          <button onClick={onClose}
                  className="text-[8px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                  style={{ color: '#aaa', fontFamily: 'system-ui' }}>
            Close ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-px" style={{ background: '#e8e8e8' }} />
              <p className="text-[11px]" style={{ color: '#ccc', fontFamily: 'system-ui' }}>Your cart is empty</p>
            </div>
          ) : (
            Object.entries(byBrand).map(([brand, brandItems]) => (
              <div key={brand} className="border-b border-zinc-50">
                <p className="px-7 pt-6 pb-3 text-[7.5px] uppercase tracking-[0.5em]"
                   style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
                  {brand}
                </p>
                {brandItems.map(item => (
                  <div key={item.item_id} className="px-7 py-4 flex gap-4 border-t border-zinc-50">
                    <div className="w-14 h-14 bg-zinc-100 shrink-0 overflow-hidden">
                      {item.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover grayscale" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ color: '#333', fontFamily: 'system-ui' }}>{item.title}</p>
                      {item.colour && <p className="text-[8px] uppercase tracking-[0.25em] mt-0.5" style={{ color: '#bbb', fontFamily: 'system-ui' }}>{item.colour}</p>}
                      {/* Size breakdown */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(item.sizes ?? {}).filter(([, v]) => Number(v) > 0).map(([s, v]) => (
                          <span key={s} className="text-[7px] px-1.5 py-0.5 border border-zinc-100"
                                style={{ color: '#888', fontFamily: 'var(--font-mono), monospace' }}>
                            {s}:{v}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2" style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#c9a84c' }}>
                        {fmtUSD(item.wholesale_price * item.qty)}
                      </p>
                    </div>
                    <button onClick={() => onRemove(item.item_id)}
                            className="text-[8px] uppercase tracking-[0.25em] self-start hover:opacity-50 transition-opacity"
                            style={{ color: '#ccc', fontFamily: 'system-ui' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-zinc-100 px-7 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[7.5px] uppercase tracking-[0.4em]" style={{ color: '#aaa', fontFamily: 'system-ui' }}>Wholesale Total</p>
              <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '16px', color: '#111' }}>{fmtUSD(total)}</p>
            </div>
            <button onClick={onPlaceOrder}
                    className="w-full py-3 text-[8.5px] uppercase tracking-[0.5em] text-white"
                    style={{ background: '#111', fontFamily: 'system-ui' }}>
              Place Order →
            </button>
            <a href="/dashboard/orders"
               className="block text-center text-[8px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
               style={{ color: '#aaa', fontFamily: 'system-ui' }}>
              View All Orders
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

type RawCartItem = {
  variant_id     : string;
  product_id     : string;
  sku            : string | null;
  name           : string | null;
  size           : string;
  color          : string | null;
  quantity       : number;
  wholesale_price: number | null;
  msrp           : number | null;
  image          : string | null;
  brand_name     : string | null;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items,   setItems]   = useState<CartItem[]>([]);
  const [rawCart, setRawCart] = useState<RawCartItem[]>([]);
  const [open,    setOpen]    = useState(false);
  const [picker,  setPicker]  = useState<CatalogItem | null>(null);
  const [placing, setPlacing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cart');
      if (!res.ok) return;
      const { cart } = await res.json();
      const raw: RawCartItem[] = cart ?? [];
      setRawCart(raw);
      // Group per-size variants into a single CartItem per product
      const grouped = new Map<string, CartItem>();
      for (const r of raw) {
        const pid = r.product_id ?? r.variant_id;
        if (!grouped.has(pid)) {
          grouped.set(pid, {
            item_id        : pid,
            brand_name     : r.brand_name ?? '',
            title          : r.name ?? '',
            style_number   : r.sku ?? null,
            colour         : r.color ?? null,
            image_url      : r.image ?? null,
            retail_price   : r.msrp ?? 0,
            wholesale_price: r.wholesale_price ?? 0,
            sizes          : {},
            qty            : 0,
          });
        }
        const entry = grouped.get(pid)!;
        const q = Number(r.quantity);
        if (r.size) entry.sizes[r.size] = (entry.sizes[r.size] ?? 0) + q;
        entry.qty += q;
      }
      setItems([...grouped.values()]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function addItem(catalogItem: CatalogItem, sizes: Record<string, number>) {
    const ws  = Number(catalogItem.wholesale_price) || Number(catalogItem.retail_price) / 2.5;
    const qty = Object.values(sizes).reduce((s, v) => s + v, 0);
    if (qty === 0) return;

    // Post one variant entry per size so the cart API (which stores one row per variant) works correctly
    await Promise.all(
      Object.entries(sizes)
        .filter(([, q]) => q > 0)
        .map(([size, quantity]) =>
          fetch('/api/cart', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
              variantId      : `${catalogItem.id}_${size}`,
              quantity,
              sku            : catalogItem.style_number ?? null,
              name           : String(catalogItem.title ?? catalogItem.name ?? ''),
              size,
              wholesale_price: ws,
              msrp           : Number(catalogItem.retail_price ?? catalogItem.price_usd ?? 0),
              image          : catalogItem.image_url ?? (Array.isArray(catalogItem.image_urls) ? catalogItem.image_urls[0] : null),
              brand_name     : String(catalogItem.brand_name ?? ''),
            }),
          })
        )
    );
    await refresh();
    setOpen(true);
  }

  async function removeItem(item_id: string) {
    // Delete all per-size variants belonging to this product
    const variants = rawCart.filter(r => (r.product_id ?? r.variant_id) === item_id);
    const targets  = variants.length > 0 ? variants.map(v => v.variant_id) : [item_id];
    await Promise.all(
      targets.map(vid =>
        fetch(`/api/cart?item_id=${encodeURIComponent(vid)}`, { method: 'DELETE' })
      )
    );
    setItems(p => p.filter(i => i.item_id !== item_id));
    setRawCart(p => p.filter(r => (r.product_id ?? r.variant_id) !== item_id));
  }

  async function placeOrder() {
    if (!items.length || placing) return;
    setPlacing(true);
    const total = items.reduce((s, i) => s + i.wholesale_price * i.qty, 0);

    // Expand grouped items back to flat per-size rows for the order record
    const orderItems = items.flatMap(item =>
      Object.entries(item.sizes)
        .filter(([, qty]) => qty > 0)
        .map(([size, quantity]) => ({
          name           : item.title,
          size,
          quantity,
          wholesale_price: item.wholesale_price,
          brand_name     : item.brand_name,
          sku            : item.style_number,
          image          : item.image_url,
        }))
    );

    const res = await fetch('/api/orders', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ items: orderItems, total_usd: total }),
    });

    if (!res.ok) { setPlacing(false); return; }

    const { order } = await res.json();
    await refresh();
    setOpen(false);
    setPlacing(false);
    window.location.href = `/checkout?order_id=${order.id}`;
  }

  return (
    <CartContext.Provider value={{
      items, count: items.reduce((s, i) => s + i.qty, 0),
      open, setOpen, addItem, removeItem, refresh,
    }}>
      {children}

      {/* Size picker */}
      {picker && (
        <SizePickerModal
          item={picker}
          onConfirm={sizes => addItem(picker, sizes)}
          onClose={() => setPicker(null)}
        />
      )}

      {/* Cart drawer */}
      {open && (
        <CartDrawer
          items={items}
          onClose={() => setOpen(false)}
          onRemove={removeItem}
          onPlaceOrder={placeOrder}
        />
      )}

      {/* Floating cart button — only shown when drawer is closed */}
      {!open && items.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-8 z-40 flex items-center gap-3 px-5 py-3 shadow-lg"
          style={{ background: '#111', border: '1px solid #333' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#fff' }}>
            {items.reduce((s, i) => s + i.qty, 0)} pcs
          </span>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#c9a84c' }}>
            {fmtUSD(items.reduce((s, i) => s + i.wholesale_price * i.qty, 0))}
          </span>
        </button>
      )}

      {/* Expose setPicker for ProductCard via event */}
      <AddToCartListener onPick={setPicker} />
    </CartContext.Provider>
  );
}

// Allows ProductCard (outside provider tree awareness) to trigger the picker
function AddToCartListener({ onPick }: { onPick: (item: CatalogItem) => void }) {
  useEffect(() => {
    function handler(e: Event) {
      onPick((e as CustomEvent<CatalogItem>).detail);
    }
    window.addEventListener('linezheets:add-to-cart', handler);
    return () => window.removeEventListener('linezheets:add-to-cart', handler);
  }, [onPick]);
  return null;
}

export function triggerAddToCart(item: CatalogItem) {
  window.dispatchEvent(new CustomEvent('linezheets:add-to-cart', { detail: item }));
}
