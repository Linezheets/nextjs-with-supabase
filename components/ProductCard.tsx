'use client';

import { useState } from 'react';
import type { CatalogItem } from '@/lib/types';
import { triggerAddToCart } from '@/components/CartDrawer';

const USD_TO_EUR = 0.92;

const INV_COLOR: Record<string, string> = {
  'Ready to Ship': '#52b788',
  'Limited'      : '#c9a84c',
  'Low Stock'    : '#c0703a',
  'Pre-Order'    : '#7cb9e8',
  'Sold Out'     : '#aaa',
};

interface Props {
  item        : CatalogItem;
  verified?   : boolean;
  priority?   : boolean;
  isFavorited?: boolean;
  onFavorite? : (item: CatalogItem, favorited: boolean) => void;
}

/** Never render NaN or undefined — always a clean number. */
function safeNum(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return isFinite(n) ? n : fallback;
}

/** Safe string coercion — prevents "Objects are not valid as React child". */
function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

export default function ProductCard({ item, verified = false, priority = false, isFavorited = false, onFavorite }: Props) {
  const [favorited, setFavorited] = useState(isFavorited);
  const [saving, setSaving] = useState(false);

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    const next = !favorited;
    setFavorited(next);

    try {
      if (next) {
        await fetch('/api/favorites', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            item_type : 'product',
            item_id   : String(item.id),
            item_label: String(item.title ?? item.name ?? item.id),
          }),
        });
      } else {
        await fetch(`/api/favorites?item_type=product&item_id=${encodeURIComponent(String(item.id))}`, { method: 'DELETE' });
      }
      onFavorite?.(item, next);
    } catch {
      setFavorited(!next); // revert on error
    } finally {
      setSaving(false);
    }
  }
  // ── Field normalisation: support both new names and legacy fallbacks ─────────
  const displayName = safeStr(item.title ?? item.name, 'Untitled');
  const imgSrc      = safeStr(item.image_url ?? (Array.isArray(item.image_urls) ? item.image_urls[0] : item.image_urls));
  const usd         = safeNum(item.retail_price ?? item.price_usd);
  const ws          = safeNum(item.wholesale_price, usd / 2.5);
  const eur         = (usd * USD_TO_EUR).toFixed(2);
  const wsEur       = (ws  * USD_TO_EUR).toFixed(2);
  const invColor    = INV_COLOR[safeStr(item.inventory_status)] ?? null;

  return (
    <article className="group cursor-pointer">

      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[2/3] bg-zinc-50 overflow-hidden mb-5">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={displayName}
            loading={priority ? 'eager' : 'lazy'}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0
                       group-hover:scale-[1.03] transition-all duration-700"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-px bg-zinc-200" />
          </div>
        )}

        {/* Favorite button */}
        {verified && (
          <button
            onClick={toggleFavorite}
            disabled={saving}
            aria-label={favorited ? 'Remove from favourites' : 'Add to favourites'}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center
                       bg-white/90 hover:bg-white transition-colors disabled:opacity-40"
            style={{ border: favorited ? '1px solid #c9a84c' : '1px solid #e0e0e0' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={favorited ? '#c9a84c' : 'none'}
                 stroke={favorited ? '#c9a84c' : '#bbb'} strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        )}

        {/* Inventory badge */}
        {invColor && (
          <span
            className="absolute top-3 left-3 text-[7.5px] uppercase tracking-[0.2em] px-2 py-1 bg-white/95"
            style={{ color: invColor, border: `1px solid ${invColor}` }}
          >
            {safeStr(item.inventory_status)}
          </span>
        )}

        {/* Wholesale hover panel — VIP only */}
        {verified && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0
                          transition-transform duration-300 bg-black/95 px-4 py-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[7px] text-zinc-500 uppercase tracking-widest mb-1">Wholesale</p>
                <p style={{ fontFamily: 'var(--font-mono), monospace', color: '#c9a84c', fontSize: '13px' }}>
                  ${ws.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[7px] text-zinc-500 uppercase tracking-widest mb-1">EUR</p>
                <p style={{ fontFamily: 'var(--font-mono), monospace', color: '#aaa', fontSize: '13px' }}>
                  €{wsEur}
                </p>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); triggerAddToCart(item); }}
              className="w-full mt-3 py-2 text-[7.5px] uppercase tracking-[0.4em] text-white
                         border border-zinc-600 hover:border-white transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif' }}>
              + Add to Order
            </button>
          </div>
        )}
      </div>

      {/* ── Info ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-100 pb-4">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            {item.season && (
              <p className="text-[7.5px] uppercase tracking-[0.3em] mb-1"
                 style={{ color: '#c0c0c0' }}>
                {safeStr(item.season)}
              </p>
            )}
            <h3
              className="text-[15px] font-normal leading-snug group-hover:opacity-60 transition-opacity truncate"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
            >
              {displayName}
            </h3>
            {item.brand_name && (
              <p className="text-[8px] uppercase tracking-[0.22em] mt-1"
                 style={{ color: '#c0c0c0' }}>
                {safeStr(item.brand_name)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '12px' }}>
              ${usd.toFixed(2)}
            </p>
            <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#b0b0b0', marginTop: '2px' }}>
              €{eur}
            </p>
          </div>
        </div>
      </div>

      {verified && item.consignment_terms && (
        <p className="text-[7.5px] uppercase tracking-[0.18em] mt-2"
           style={{ color: '#c0c0c0' }}>
          {safeStr(item.consignment_terms)}
        </p>
      )}
    </article>
  );
}
