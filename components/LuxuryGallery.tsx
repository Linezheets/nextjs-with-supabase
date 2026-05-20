'use client';

import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  category: string | null;
  season: string | null;
  wholesale_price: string;
  msrp: string;
  images: string[] | null;
  min_order_qty: number | null;
  delivery_window: string | null;
  available_units: string;
  reorder_point: string | null;
  variant_count: string;
}

interface GalleryProps {
  /** Brand store slug (e.g. "mxlla") — passed to /api/brands/by-slug/:slug */
  brandSlug: string;
  /** Filter to a specific season, e.g. "SS27". Omit to show all. */
  season?: string;
  /** Override the section headline */
  title?: string;
  /** Linezheets API base URL. Defaults to NEXT_PUBLIC_LINEZHEETS_API_URL or '' */
  apiBase?: string;
  /** If the current user is a verified buyer, show wholesale pricing */
  verified?: boolean;
  /** Called when a card is clicked */
  onProductClick?: (product: Product) => void;
}

// ── Inventory helpers ─────────────────────────────────────────────────────────

type InventoryKey = 'ready' | 'limited' | 'low' | 'preorder' | 'sold_out';

const INV: Record<InventoryKey, { label: string; color: string; border: string }> = {
  ready:    { label: 'Ready to Ship', color: '#52b788', border: '#52b788' },
  limited:  { label: 'Limited',       color: '#C9A84C', border: '#C9A84C' },
  low:      { label: 'Low Stock',     color: '#f97316', border: '#f97316' },
  preorder: { label: 'Pre-Order',     color: '#38bdf8', border: '#38bdf8' },
  sold_out: { label: 'Sold Out',      color: '#52525b', border: '#52525b' },
};

function getInventoryStatus(p: Product): InventoryKey {
  const qty = parseInt(p.available_units) || 0;
  if (qty === 0 && p.delivery_window) return 'preorder';
  if (qty === 0) return 'sold_out';
  if (qty <= parseInt(p.reorder_point ?? '5')) return 'low';
  if (qty <= 20) return 'limited';
  return 'ready';
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="min-w-[300px] md:min-w-[400px] shrink-0 animate-pulse">
      <div className="aspect-[2/3] bg-zinc-900 mb-4" />
      <div className="h-4 bg-zinc-900 rounded w-3/4 mb-2" />
      <div className="h-3 bg-zinc-900 rounded w-1/2" />
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({
  item,
  verified,
  onClick,
}: {
  item: Product;
  verified: boolean;
  onClick: (p: Product) => void;
}) {
  const img       = item.images?.[0] ?? null;
  const wholesale = parseFloat(item.wholesale_price ?? '0');
  const msrp      = parseFloat(item.msrp ?? '0');
  const payout    = (wholesale * 0.7).toFixed(2);
  const statusKey = getInventoryStatus(item);
  const status    = INV[statusKey];

  return (
    <article
      className="min-w-[300px] md:min-w-[400px] shrink-0 group cursor-pointer border-b border-zinc-900 pb-8"
      onClick={() => onClick(item)}
    >
      {/* Image */}
      <div className="aspect-[2/3] bg-zinc-900 mb-5 overflow-hidden relative">
        {img ? (
          <img
            src={img}
            alt={item.name}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-[1.04] transition-all duration-700"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}

        {/* Inventory badge */}
        <div className="absolute top-2 left-2">
          <span
            className="text-[8px] uppercase tracking-[0.2em] px-2 py-1 font-mono"
            style={{
              color: status.color,
              border: `1px solid ${status.border}40`,
              background: `${status.border}12`,
            }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Identity row */}
      <div className="flex justify-between items-start mb-1">
        <div className="min-w-0 pr-4">
          <p className="text-zinc-500 text-[9px] uppercase tracking-[0.2em] mb-1">
            {item.season ?? 'New Arrival'}
          </p>
          <h3 className="text-white font-light text-lg leading-tight truncate">{item.name}</h3>
          {item.category && (
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-0.5">{item.category}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-zinc-500 text-xs font-light italic">
            {msrp > 0 ? `€${msrp.toFixed(2)}` : '—'}
          </p>
          <p className="text-[9px] text-zinc-700 uppercase tracking-widest">SRP</p>
        </div>
      </div>

      {/* Consignment term */}
      <p className="text-zinc-600 text-[9px] uppercase tracking-[0.18em] mb-4">
        Consignment Term: 70/30
      </p>

      {/* Pricing blocks */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/60 p-3">
          <span className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
            Wholesale (2.5×)
          </span>
          {verified ? (
            <span className="text-[#C9A84C] font-mono text-sm">€{wholesale.toFixed(2)}</span>
          ) : (
            <span className="text-zinc-700 font-mono text-sm blur-sm select-none">€——.——</span>
          )}
        </div>
        <div className="bg-zinc-900/60 p-3">
          <span className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
            Brand Payout (70%)
          </span>
          {verified ? (
            <span className="text-white/70 font-mono text-sm">€{payout}</span>
          ) : (
            <span className="text-zinc-700 font-mono text-sm blur-sm select-none">€——.——</span>
          )}
        </div>
      </div>

      {item.min_order_qty != null && (
        <p className="text-[9px] text-zinc-700 uppercase tracking-widest mt-3">
          MOQ {item.min_order_qty} units
        </p>
      )}
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LuxuryGallery({
  brandSlug,
  season,
  title,
  apiBase,
  verified = false,
  onProductClick,
}: GalleryProps) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [brandName, setBrandName]   = useState<string>('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const scrollRef                   = useRef<HTMLDivElement>(null);

  const base = apiBase ?? process.env.NEXT_PUBLIC_LINEZHEETS_API_URL ?? '';

  useEffect(() => {
    if (!brandSlug) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Resolve brand ID from slug
        const brandRes = await fetch(`${base}/api/brands/by-slug/${encodeURIComponent(brandSlug)}`);
        if (!brandRes.ok) throw new Error('Brand not found');
        const brand = await brandRes.json();
        setBrandName(brand.store_name ?? brand.brand_name ?? brandSlug.toUpperCase());

        // Fetch products
        const params = new URLSearchParams({ limit: '48' });
        if (season) params.set('season', season);

        const prodRes = await fetch(`${base}/api/brands/${brand.id}/products?${params}`);
        if (!prodRes.ok) throw new Error('Failed to load products');

        const { products: list = [] } = await prodRes.json();
        setProducts(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [brandSlug, season, base]);

  // Drag-to-scroll on desktop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let isDown = false, startX = 0, scrollLeft = 0;
    const onDown = (e: MouseEvent) => {
      isDown = true; el.classList.add('cursor-grabbing');
      startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
    };
    const onUp = () => { isDown = false; el.classList.remove('cursor-grabbing'); };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return; e.preventDefault();
      el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * 1.5;
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onUp);
      el.removeEventListener('mousemove', onMove);
    };
  }, []);

  const headline = title ?? `${brandName}${season ? ` ${season}` : ''} Collection`;

  return (
    <section className="bg-black py-20 px-8 md:px-14">

      {/* Header */}
      <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-[0.25em] mb-2">
            {season ?? 'Current Season'}
          </p>
          <h2 className="text-white font-serif text-4xl md:text-5xl tracking-[0.08em] uppercase leading-tight">
            {headline}
          </h2>
        </div>

        {/* Pricing access note */}
        {!verified && !loading && products.length > 0 && (
          <a
            href={`/brands/${brandSlug}`}
            className="text-[10px] uppercase tracking-widest text-[#C9A84C] border border-[#C9A84C]/30 px-4 py-2 hover:bg-[#C9A84C]/10 transition-colors shrink-0"
          >
            Verify for Pricing →
          </a>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-zinc-500 text-sm italic py-12">{error}</div>
      )}

      {/* Horizontal scroll track */}
      {!error && (
        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto pb-10 cursor-grab select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`::-webkit-scrollbar{display:none}`}</style>

          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : products.length === 0
            ? <p className="text-zinc-600 text-sm italic py-12">No products available for this collection.</p>
            : products.map(p => (
                <ProductCard
                  key={p.id}
                  item={p}
                  verified={verified}
                  onClick={onProductClick ?? (() => {})}
                />
              ))
          }
        </div>
      )}

      {/* Scroll hint */}
      {!loading && products.length > 2 && (
        <p className="text-zinc-700 text-[9px] uppercase tracking-[0.25em] mt-2">
          ← drag to explore →
        </p>
      )}

    </section>
  );
}
