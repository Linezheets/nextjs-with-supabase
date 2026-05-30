import { createClient }     from '@/lib/supabase/server';
import { getBuyerCatalog }  from '@/lib/buyer-catalog';
import Link                 from 'next/link';
import ProductCard          from '@/components/ProductCard';
import type { CatalogItem } from '@/lib/types';

export const revalidate = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

function safePrice(raw: unknown): number {
  if (raw == null) return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return isFinite(n) ? n : 0;
}

// ── Data ─────────────────────────────────────────────────────────────────────

// For the locked public view we only need brand/category metadata, not pricing.
async function getPublicCatalogMeta(): Promise<CatalogItem[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('brand_name, category');
    return Array.isArray(data) ? (data as CatalogItem[]) : [];
  } catch { return []; }
}

// ── Locked public view ────────────────────────────────────────────────────────

function LockedMarketplace({ brands, categories }: { brands: string[]; categories: string[] }) {
  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400 }}>LINEZHEETS</Link>
          <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Marketplace</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>Sign In</Link>
            <Link href="/join" className="text-[8px] uppercase tracking-[0.4em] px-5 py-2 bg-black text-white hover:bg-zinc-900 transition-colors" style={{ fontFamily: 'system-ui, sans-serif' }}>Apply</Link>
          </div>
        </div>
      </header>

      <main className="pt-[60px]">

        {/* Banner */}
        <div className="border-b border-zinc-100 bg-zinc-50">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16 flex items-end justify-between gap-8 flex-wrap">
            <div>
              <p className="text-[8px] uppercase tracking-[0.6em] mb-4" style={{ color: '#c9a84c' }}>Private Wholesale Marketplace</p>
              <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 400, lineHeight: 1.05, color: '#111' }}>
                {brands.length > 0 ? `${brands.length} Brands` : 'Curated Brands'}<br />
                <em style={{ color: '#bbb', fontStyle: 'italic' }}>{categories.length > 0 ? `${categories.length} Categories` : 'All Categories'}</em>
              </h1>
            </div>
            <div className="flex flex-col gap-3 items-end">
              <Link href="/join" className="inline-block px-10 py-3 text-[8.5px] uppercase tracking-[0.5em] bg-black text-white hover:bg-zinc-900 transition-colors" style={{ fontFamily: 'system-ui, sans-serif' }}>
                Apply for Access
              </Link>
              <Link href="/login" className="text-[8px] uppercase tracking-[0.3em] hover:opacity-50 transition-opacity" style={{ color: '#999' }}>
                Already a member? Sign in →
              </Link>
            </div>
          </div>
        </div>

        {/* Categories strip */}
        {categories.length > 0 && (
          <div className="border-b border-zinc-100 overflow-x-auto">
            <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-5 flex items-center gap-3 min-w-max">
              <span className="text-[7.5px] uppercase tracking-[0.45em] shrink-0" style={{ color: '#ccc' }}>Categories:</span>
              {categories.map(c => (
                <Link key={c} href="/login" className="text-[8px] uppercase tracking-[0.3em] px-4 py-1.5 border border-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap" style={{ color: '#999' }}>{c}</Link>
              ))}
            </div>
          </div>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10 border-b border-zinc-100">
            <p className="text-[7.5px] uppercase tracking-[0.5em] mb-6" style={{ color: '#ccc' }}>Brands</p>
            <div className="flex flex-wrap gap-3">
              {brands.map(b => (
                <Link key={b} href="/login" className="group flex items-center gap-3 border border-zinc-100 px-5 py-3 hover:border-zinc-300 transition-colors">
                  <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-[8px] font-medium" style={{ color: '#bbb' }}>{b[0]}</div>
                  <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#888' }}>{b}</span>
                  <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#c9a84c' }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Locked grid */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
          <div className="flex items-end justify-between mb-12 pb-6 border-b border-zinc-100">
            <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 400, color: '#111' }}>The Collection</h2>
            <p className="text-[8px] uppercase tracking-[0.35em]" style={{ color: '#ccc' }}>Sign in to view wholesale pricing</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 relative">
            {Array.from({ length: 12 }).map((_, i) => (
              <Link key={i} href="/login" className="group block">
                <div className="relative aspect-[2/3] bg-zinc-50 mb-4 flex flex-col items-center justify-center gap-2 overflow-hidden">
                  <div className="w-8 h-px bg-zinc-200" />
                  <span className="text-[7px] uppercase tracking-[0.3em]" style={{ color: '#ccc' }}>Members only</span>
                  <div className="w-8 h-px bg-zinc-200" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[8px] uppercase tracking-[0.4em] bg-black text-white px-6 py-2" style={{ fontFamily: 'system-ui, sans-serif' }}>Sign In</span>
                  </div>
                </div>
                <div className="h-2 w-20 bg-zinc-100 rounded mb-2" />
                <div className="h-2 w-12 bg-zinc-50 rounded" />
              </Link>
            ))}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>
          <div className="mt-16 text-center">
            <p className="text-[8px] uppercase tracking-[0.5em] mb-6" style={{ color: '#ccc' }}>Wholesale pricing · Full collections · Direct brand access</p>
            <Link href="/join" className="inline-block px-16 py-4 text-[8.5px] uppercase tracking-[0.5em] bg-black text-white hover:bg-zinc-900 transition-colors" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Apply for Free
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Filter sidebar (authenticated) ────────────────────────────────────────────

function Sidebar({
  brands, categories, seasons,
  activeBrand, activeCategory, activeSeason, activeStatus, search,
}: {
  brands         : string[];
  categories     : string[];
  seasons        : string[];
  activeBrand    : string;
  activeCategory : string;
  activeSeason   : string;
  activeStatus   : string;
  search         : string;
}) {
  function href(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      ...(activeBrand    ? { brand  : activeBrand    } : {}),
      ...(activeCategory ? { cat    : activeCategory  } : {}),
      ...(activeSeason   ? { season : activeSeason    } : {}),
      ...(activeStatus   ? { status : activeStatus    } : {}),
      ...(search         ? { q      : search          } : {}),
      ...overrides,
    });
    // Remove empty values
    [...p.keys()].forEach(k => { if (!p.get(k)) p.delete(k); });
    const qs = p.toString();
    return `/marketplace${qs ? `?${qs}` : ''}`;
  }

  return (
    <aside className="w-56 shrink-0 pr-8 border-r border-zinc-100 self-start sticky top-[110px]">

      {/* Clear all */}
      {(activeBrand || activeCategory || activeSeason || activeStatus || search) && (
        <div className="mb-8">
          <Link href="/marketplace" className="text-[7.5px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#c9a84c' }}>
            ✕ Clear filters
          </Link>
        </div>
      )}

      {/* Brand */}
      <FilterGroup label="Brand">
        <FilterLink label="All" active={!activeBrand} href={href({ brand: '' })} />
        {brands.map(b => (
          <FilterLink key={b} label={b} active={activeBrand === b} href={href({ brand: b })} />
        ))}
      </FilterGroup>

      {/* Category */}
      <FilterGroup label="Category">
        <FilterLink label="All" active={!activeCategory} href={href({ cat: '' })} />
        {categories.map(c => (
          <FilterLink key={c} label={c} active={activeCategory === c} href={href({ cat: c })} />
        ))}
      </FilterGroup>

      {/* Season */}
      {seasons.length > 0 && (
        <FilterGroup label="Season">
          <FilterLink label="All" active={!activeSeason} href={href({ season: '' })} />
          {seasons.map(s => (
            <FilterLink key={s} label={s} active={activeSeason === s} href={href({ season: s })} />
          ))}
        </FilterGroup>
      )}

      {/* Availability */}
      <FilterGroup label="Availability">
        <FilterLink label="All"           active={!activeStatus}                    href={href({ status: '' })} />
        <FilterLink label="Ready to Ship" active={activeStatus === 'Ready to Ship'} href={href({ status: 'Ready to Ship' })} />
        <FilterLink label="Low Stock"     active={activeStatus === 'Low Stock'}     href={href({ status: 'Low Stock' })} />
        <FilterLink label="Pre-Order"     active={activeStatus === 'Pre-Order'}     href={href({ status: 'Pre-Order' })} />
      </FilterGroup>

    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[7px] uppercase tracking-[0.5em] mb-4" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="block text-[11px] py-1 hover:opacity-60 transition-opacity truncate"
      style={{
        color     : active ? '#111' : '#aaa',
        fontWeight: active ? 500 : 400,
        fontFamily: 'system-ui, sans-serif',
        ...(active ? { borderLeft: '2px solid #c9a84c', paddingLeft: '8px' } : { paddingLeft: '10px' }),
      }}
    >
      {label}
    </Link>
  );
}

// ── Authenticated full marketplace ────────────────────────────────────────────

function FullMarketplace({
  items, all, brands, categories, seasons, email,
  activeBrand, activeCategory, activeSeason, activeStatus, search,
}: {
  items          : CatalogItem[];
  all            : CatalogItem[];
  brands         : string[];
  categories     : string[];
  seasons        : string[];
  email          : string;
  activeBrand    : string;
  activeCategory : string;
  activeSeason   : string;
  activeStatus   : string;
  search         : string;
}) {
  const isFiltered = !!(activeBrand || activeCategory || activeSeason || activeStatus || search);
  const priceRange = all.length > 0 ? {
    min: Math.min(...all.map(i => safePrice(i.wholesale_price))),
    max: Math.max(...all.map(i => safePrice(i.wholesale_price))),
  } : null;

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400 }}>LINEZHEETS</Link>

          <nav className="flex items-center gap-8">
            <Link href="/marketplace" className="text-[8px] uppercase tracking-[0.4em]" style={{ color: '#111', borderBottom: '1px solid #111', paddingBottom: '1px' }}>Marketplace</Link>
            <Link href="/inquiries"   className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>Inquiries</Link>
            <Link href="/dashboard"   className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>Dashboard</Link>
          </nav>

          <div className="flex items-center gap-4">
            {priceRange && (
              <span className="hidden lg:block text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#ccc' }}>
                WS ${priceRange.min.toFixed(0)}–${priceRange.max.toFixed(0)}
              </span>
            )}
            <div className="w-px h-4 bg-zinc-200 hidden lg:block" />
            <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#c9a84c' }}>
              {email.split('@')[0]}
            </span>
          </div>
        </div>
      </header>

      {/* Search bar */}
      <div className="fixed top-[60px] inset-x-0 z-40 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-3 flex items-center gap-6">
          <form method="GET" action="/marketplace" className="flex-1 max-w-sm flex items-center gap-3">
            {/* preserve active filters in search */}
            {activeBrand    && <input type="hidden" name="brand"  value={activeBrand} />}
            {activeCategory && <input type="hidden" name="cat"    value={activeCategory} />}
            {activeSeason   && <input type="hidden" name="season" value={activeSeason} />}
            {activeStatus   && <input type="hidden" name="status" value={activeStatus} />}
            <span className="text-[10px]" style={{ color: '#ccc' }}>⌕</span>
            <input
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search pieces, brands, styles…"
              className="flex-1 text-[11px] outline-none bg-transparent placeholder:text-zinc-300"
              style={{ color: '#333' }}
            />
            {search && (
              <Link href={`/marketplace?${new URLSearchParams({
                ...(activeBrand    ? { brand  : activeBrand    } : {}),
                ...(activeCategory ? { cat    : activeCategory  } : {}),
                ...(activeSeason   ? { season : activeSeason    } : {}),
                ...(activeStatus   ? { status : activeStatus    } : {}),
              }).toString()}`}
                    className="text-[9px]" style={{ color: '#ccc' }}>✕</Link>
            )}
          </form>
          <div className="hidden md:flex items-center gap-4 text-[7.5px] uppercase tracking-[0.35em]" style={{ color: '#ccc' }}>
            <span>{all.length} total</span>
            <span>·</span>
            <span>{items.length} shown</span>
          </div>
        </div>
      </div>

      <main className="pt-[108px] max-w-screen-xl mx-auto px-8 md:px-16 py-12">
        <div className="flex gap-12">

          {/* Sidebar */}
          <Sidebar
            brands={brands} categories={categories} seasons={seasons}
            activeBrand={activeBrand} activeCategory={activeCategory}
            activeSeason={activeSeason} activeStatus={activeStatus} search={search}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Section header */}
            <div className="flex items-end justify-between mb-10 pb-6 border-b border-zinc-100">
              <div>
                <p className="text-[7.5px] uppercase tracking-[0.55em] mb-2" style={{ color: '#ccc' }}>
                  {isFiltered
                    ? [activeBrand, activeCategory, activeSeason, activeStatus, search ? `"${search}"` : ''].filter(Boolean).join(' · ')
                    : 'Full Collection · Wholesale Access'}
                </p>
                <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 400, color: '#111' }}>
                  {isFiltered ? 'Filtered Results' : 'Browse by Brand'}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-[8px] uppercase tracking-[0.3em]" style={{ color: '#ccc' }}>
                <span>{items.length} piece{items.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Grid */}
            {items.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-[8px] uppercase tracking-[0.5em] mb-4" style={{ color: '#ccc' }}>No pieces match this filter</p>
                <Link href="/marketplace" className="text-[8px] uppercase tracking-[0.4em] border-b pb-px hover:opacity-50 transition-opacity" style={{ color: '#888', borderColor: '#ddd' }}>
                  Clear filters
                </Link>
              </div>
            ) : isFiltered ? (
              /* Filtered: flat grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-16">
                {items.map(item => (
                  <ProductCard key={safeStr(item.id)} item={item} verified={true} />
                ))}
              </div>
            ) : (
              /* Default: grouped by brand */
              <div className="space-y-20">
                {Object.entries(
                  items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
                    const b = safeStr(item.brand_name, 'Other');
                    (acc[b] ??= []).push(item);
                    return acc;
                  }, {})
                ).map(([brandName, brandItems]) => (
                  <div key={brandName}>
                    <div className="flex items-end justify-between mb-8 pb-4 border-b border-zinc-100">
                      <div>
                        <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', fontWeight: 400, color: '#111' }}>
                          {brandName}
                        </h2>
                        <p className="text-[7.5px] uppercase tracking-[0.4em] mt-1" style={{ color: '#ccc' }}>
                          {brandItems.length} piece{brandItems.length !== 1 ? 's' : ''}
                          {brandItems[0]?.season ? ` · ${safeStr(brandItems[0].season)}` : ''}
                        </p>
                      </div>
                      <Link
                        href={`/marketplace?brand=${encodeURIComponent(brandName)}`}
                        className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                        style={{ color: '#c9a84c' }}
                      >
                        View all →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-16">
                      {brandItems.map(item => (
                        <ProductCard key={safeStr(item.id)} item={item} verified={true} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; cat?: string; season?: string; status?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params         = await searchParams;
  const activeBrand    = params.brand  ?? '';
  const activeCategory = params.cat    ?? '';
  const activeSeason   = params.season ?? '';
  const activeStatus   = params.status ?? '';
  const search         = params.q      ?? '';

  if (!user) {
    const meta       = await getPublicCatalogMeta();
    const brands     = [...new Set(meta.map(i => safeStr(i.brand_name)).filter(Boolean))].sort();
    const categories = [...new Set(meta.map(i => safeStr(i.category)).filter(Boolean))].sort();
    return <LockedMarketplace brands={brands} categories={categories} />;
  }

  const all        = await getBuyerCatalog(supabase, user.email ?? '');
  const brands     = [...new Set(all.map(i => safeStr(i.brand_name)).filter(Boolean))].sort();
  const categories = [...new Set(all.map(i => safeStr(i.category)).filter(Boolean))].sort();
  const seasons    = [...new Set(all.map(i => safeStr(i.season)).filter(Boolean))].sort();

  // Apply all filters
  const filtered = all.filter(item => {
    if (activeBrand    && safeStr(item.brand_name)      !== activeBrand)    return false;
    if (activeCategory && safeStr(item.category)        !== activeCategory)  return false;
    if (activeSeason   && safeStr(item.season)          !== activeSeason)    return false;
    if (activeStatus   && safeStr(item.inventory_status) !== activeStatus)   return false;
    if (search) {
      const q   = search.toLowerCase();
      const hay = [item.title, item.brand_name, item.category, item.description, item.style_number]
        .map(v => safeStr(v).toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <FullMarketplace
      items={filtered}
      all={all}
      brands={brands}
      categories={categories}
      seasons={seasons}
      email={user.email ?? ''}
      activeBrand={activeBrand}
      activeCategory={activeCategory}
      activeSeason={activeSeason}
      activeStatus={activeStatus}
      search={search}
    />
  );
}
