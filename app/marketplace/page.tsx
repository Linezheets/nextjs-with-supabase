import { createClient }     from '@/lib/supabase/server';
import { getBuyerCatalog }  from '@/lib/buyer-catalog';
import Link                 from 'next/link';
import ProductCard          from '@/components/ProductCard';
import type { CatalogItem } from '@/lib/types';

export const revalidate = 60;

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOLD        = '#c9a84c';
const GOLD_BRIGHT = '#e8c56b';
const TEXT_MUTED  = 'rgba(255,255,255,0.45)';
const BORDER      = 'rgba(255,255,255,0.07)';
const GOLD_BORDER = 'rgba(201,168,76,0.18)';
const MONO        = 'var(--font-mono), "DM Mono", monospace';
const SERIF       = 'var(--font-serif), Georgia, serif';

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

// ── Data ──────────────────────────────────────────────────────────────────────

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
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: MONO, paddingTop: 64 }}>

      {/* Hero banner */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(201,168,76,0.03)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '5rem 2.5rem 4rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.65em', textTransform: 'uppercase', color: GOLD, marginBottom: '1.5rem' }}>
              Private Wholesale Marketplace
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 400, lineHeight: 1.02, color: '#fff' }}>
              {brands.length > 0 ? `${brands.length} Brands` : 'Curated Brands'}<br />
              <em style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                {categories.length > 0 ? `${categories.length} Categories` : 'All Categories'}
              </em>
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
            <Link href="/join" style={{
              fontFamily: MONO, fontSize: '9px', letterSpacing: '0.5em', textTransform: 'uppercase',
              color: '#000', background: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`,
              padding: '1rem 2.5rem', textDecoration: 'none', fontWeight: 700,
              boxShadow: `0 0 30px rgba(201,168,76,0.25)`,
            }}>
              Apply for Access
            </Link>
            <Link href="/login" style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase', color: TEXT_MUTED, textDecoration: 'none' }}>
              Already a member? Sign in →
            </Link>
          </div>
        </div>
      </div>

      {/* Categories strip */}
      {categories.length > 0 && (
        <div style={{ borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.25rem 2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 'max-content' }}>
            <span style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.45em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>Categories:</span>
            {categories.map(c => (
              <Link key={c} href="/login" style={{
                fontFamily: MONO, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase',
                padding: '0.4rem 1rem', border: `1px solid ${BORDER}`,
                color: TEXT_MUTED, textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD_BORDER; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_MUTED; }}>
                {c}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Brands grid */}
      {brands.length > 0 && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 2.5rem', borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '1.5rem' }}>Brands</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {brands.map(b => (
              <Link key={b} href="/login" style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                border: `1px solid ${BORDER}`, padding: '0.75rem 1.25rem',
                textDecoration: 'none', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD_BORDER; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(201,168,76,0.1)', border: `1px solid ${GOLD_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontSize: '8px', color: GOLD, fontWeight: 600,
                }}>{b[0]}</div>
                <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>{b}</span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: GOLD, opacity: 0 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Locked grid */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4rem 2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', paddingBottom: '1.5rem', borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 400, color: '#fff' }}>The Collection</h2>
          <p style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase', color: TEXT_MUTED }}>Sign in to view wholesale pricing</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem', position: 'relative' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Link key={i} href="/login" style={{ textDecoration: 'none' }}>
              <div style={{
                aspectRatio: '2/3', background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BORDER}`, marginBottom: '1rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                <div style={{ width: 32, height: 1, background: GOLD_BORDER }} />
                <span style={{ fontFamily: MONO, fontSize: '7px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)' }}>Members only</span>
                <div style={{ width: 32, height: 1, background: GOLD_BORDER }} />
              </div>
              <div style={{ height: 6, width: 80, background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem' }} />
              <div style={{ height: 6, width: 50, background: 'rgba(255,255,255,0.03)' }} />
            </Link>
          ))}
          <div style={{ position: 'absolute', inset: '60% 0 0 0', background: 'linear-gradient(to top, #000, transparent)', pointerEvents: 'none' }} />
        </div>

        {/* CTA */}
        <div style={{ marginTop: '4rem', textAlign: 'center' }}>
          <p style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.5em', textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: '1.5rem' }}>
            Wholesale pricing · Full collections · Direct brand access
          </p>
          <Link href="/join" style={{
            display: 'inline-block', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.5em', textTransform: 'uppercase',
            color: '#000', background: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`,
            padding: '1.1rem 3.5rem', textDecoration: 'none', fontWeight: 700,
          }}>
            Apply for Free
          </Link>
        </div>
      </div>
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
    [...p.keys()].forEach(k => { if (!p.get(k)) p.delete(k); });
    const qs = p.toString();
    return `/marketplace${qs ? `?${qs}` : ''}`;
  }

  return (
    <aside style={{
      width: 200, flexShrink: 0, paddingRight: '2rem',
      borderRight: `1px solid ${BORDER}`,
      position: 'sticky', top: 114, alignSelf: 'flex-start',
    }}>
      {(activeBrand || activeCategory || activeSeason || activeStatus || search) && (
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/marketplace" style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none' }}>
            ✕ Clear filters
          </Link>
        </div>
      )}

      <FilterGroup label="Brand">
        <FilterLink label="All" active={!activeBrand} href={href({ brand: '' })} />
        {brands.map(b => (
          <FilterLink key={b} label={b} active={activeBrand === b} href={href({ brand: b })} />
        ))}
      </FilterGroup>

      <FilterGroup label="Category">
        <FilterLink label="All" active={!activeCategory} href={href({ cat: '' })} />
        {categories.map(c => (
          <FilterLink key={c} label={c} active={activeCategory === c} href={href({ cat: c })} />
        ))}
      </FilterGroup>

      {seasons.length > 0 && (
        <FilterGroup label="Season">
          <FilterLink label="All" active={!activeSeason} href={href({ season: '' })} />
          {seasons.map(s => (
            <FilterLink key={s} label={s} active={activeSeason === s} href={href({ season: s })} />
          ))}
        </FilterGroup>
      )}

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
    <div style={{ marginBottom: '2rem' }}>
      <p style={{ fontFamily: MONO, fontSize: '7px', letterSpacing: '0.55em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '0.75rem' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{children}</div>
    </div>
  );
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block', fontFamily: MONO, fontSize: '10px', padding: '0.3rem 0',
        textDecoration: 'none', transition: 'color 0.15s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: active ? '#fff' : TEXT_MUTED,
        fontWeight: active ? 500 : 400,
        ...(active ? { borderLeft: `2px solid ${GOLD}`, paddingLeft: '8px' } : { paddingLeft: '10px' }),
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
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: MONO, paddingTop: 64 }}>

      {/* Secondary search bar — pinned below SiteNavbar */}
      <div style={{
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.96)', borderBottom: `1px solid ${BORDER}`,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem', height: 48, display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <form method="GET" action="/marketplace" style={{ flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeBrand    && <input type="hidden" name="brand"  value={activeBrand} />}
            {activeCategory && <input type="hidden" name="cat"    value={activeCategory} />}
            {activeSeason   && <input type="hidden" name="season" value={activeSeason} />}
            {activeStatus   && <input type="hidden" name="status" value={activeStatus} />}
            <span style={{ color: TEXT_MUTED, fontSize: 12 }}>⌕</span>
            <input
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search brands, styles, pieces…"
              style={{
                flex: 1, fontFamily: MONO, fontSize: '11px', outline: 'none',
                background: 'transparent', color: '#fff',
                border: 'none',
              }}
            />
            {search && (
              <Link href={`/marketplace?${new URLSearchParams({
                ...(activeBrand    ? { brand  : activeBrand    } : {}),
                ...(activeCategory ? { cat    : activeCategory  } : {}),
                ...(activeSeason   ? { season : activeSeason    } : {}),
                ...(activeStatus   ? { status : activeStatus    } : {}),
              }).toString()}`}
                    style={{ fontFamily: MONO, fontSize: '9px', color: TEXT_MUTED, textDecoration: 'none' }}>✕</Link>
            )}
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {priceRange && (
              <span style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.35em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                WS ${priceRange.min.toFixed(0)}–${priceRange.max.toFixed(0)}
              </span>
            )}
            <div style={{ width: 1, height: 16, background: BORDER }} />
            <span style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.35em', textTransform: 'uppercase', color: TEXT_MUTED }}>
              {all.length} total · {items.length} shown
            </span>
            <div style={{ width: 1, height: 16, background: BORDER }} />
            <span style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD }}>
              {email.split('@')[0]}
            </span>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 2.5rem', paddingTop: 'calc(48px + 2.5rem)' }}>
        <div style={{ display: 'flex', gap: '3rem' }}>

          {/* Sidebar */}
          <Sidebar
            brands={brands} categories={categories} seasons={seasons}
            activeBrand={activeBrand} activeCategory={activeCategory}
            activeSeason={activeSeason} activeStatus={activeStatus} search={search}
          />

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.55em', textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: '0.5rem' }}>
                  {isFiltered
                    ? [activeBrand, activeCategory, activeSeason, activeStatus, search ? `"${search}"` : ''].filter(Boolean).join(' · ')
                    : 'Full Collection · Wholesale Access'}
                </p>
                <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 400, color: '#fff' }}>
                  {isFiltered ? 'Filtered Results' : 'Browse by Brand'}
                </h1>
              </div>
              <span style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                {items.length} piece{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '6rem 0', textAlign: 'center' }}>
                <p style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.5em', textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: '1rem' }}>No pieces match this filter</p>
                <Link href="/marketplace" style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none', borderBottom: `1px solid ${GOLD_BORDER}`, paddingBottom: '2px' }}>
                  Clear filters
                </Link>
              </div>
            ) : isFiltered ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '2rem 2.5rem' }}>
                {items.map(item => (
                  <ProductCard key={safeStr(item.id)} item={item} verified={true} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
                {Object.entries(
                  items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
                    const b = safeStr(item.brand_name, 'Other');
                    (acc[b] ??= []).push(item);
                    return acc;
                  }, {})
                ).map(([brandName, brandItems]) => (
                  <div key={brandName}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `1px solid ${BORDER}` }}>
                      <div>
                        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', fontWeight: 400, color: '#fff' }}>{brandName}</h2>
                        <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.4em', textTransform: 'uppercase', color: TEXT_MUTED, marginTop: '0.25rem' }}>
                          {brandItems.length} piece{brandItems.length !== 1 ? 's' : ''}
                          {brandItems[0]?.season ? ` · ${safeStr(brandItems[0].season)}` : ''}
                        </p>
                      </div>
                      <Link href={`/marketplace?brand=${encodeURIComponent(brandName)}`}
                            style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.35em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none' }}>
                        View all →
                      </Link>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '2rem 2.5rem' }}>
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

  const filtered = all.filter(item => {
    if (activeBrand    && safeStr(item.brand_name)       !== activeBrand)    return false;
    if (activeCategory && safeStr(item.category)         !== activeCategory)  return false;
    if (activeSeason   && safeStr(item.season)           !== activeSeason)    return false;
    if (activeStatus   && safeStr(item.inventory_status) !== activeStatus)    return false;
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
