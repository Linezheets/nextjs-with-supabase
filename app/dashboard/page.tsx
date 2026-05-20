import { redirect }         from 'next/navigation';
import { createClient }     from '@/lib/supabase/server';
import { getBuyerCatalog }  from '@/lib/buyer-catalog';
import ProductCard          from '@/components/ProductCard';
import type { CatalogItem } from '@/lib/types';

export const revalidate = 60;

const USD_TO_EUR = 0.92;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return fallback;
}

function safePrice(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return isFinite(n) ? n : fallback;
}

function fmtPrice(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}


// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-100 p-8">
      <p className="text-[7.5px] uppercase tracking-[0.5em] mb-4"
         style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </p>
      <p style={{
        fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
        fontSize    : 'clamp(2rem, 4vw, 3rem)',
        fontWeight  : 400,
        lineHeight  : 1,
        color       : '#111',
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BuyerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Brand users → brand dashboard
  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role === 'brand') redirect('/dashboard/brand-store');

  const items = await getBuyerCatalog(supabase, user.email ?? '');

  // Derived stats
  const totalItems     = items.length;
  const brands         = [...new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))];
  const categories     = [...new Set(items.map(i => safeStr(i.category)).filter(Boolean))];
  const availableItems = items.filter(i =>
    safeStr(i.inventory_status).toLowerCase() !== 'sold out'
  );
  const avgWholesale   = totalItems > 0
    ? items.reduce((sum, i) => sum + safePrice(i.wholesale_price, safePrice(i.retail_price) / 2.5), 0) / totalItems
    : 0;
  const season         = safeStr(items.find(i => i.season)?.season, 'SS 27');

  const emailHandle = user.email?.split('@')[0] ?? 'Buyer';
  const joinDate    = new Date(user.created_at ?? Date.now()).toLocaleDateString('en-US', {
    month: 'long',
    year : 'numeric',
  });

  // Featured: first 6 available items
  const featured = availableItems.slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">

          <a href="/"
             style={{
               fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
               fontSize    : '15px',
               letterSpacing: '0.5em',
               fontWeight  : 400,
             }}>
            MXLLA
          </a>

          <span className="text-[8px] uppercase tracking-[0.5em]"
                style={{ color: '#bbb' }}>
            Buyer Portal
          </span>

          <div className="flex items-center gap-6">
            <a href="/dashboard/store"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              My Store
            </a>
            <a href="/dashboard/orders"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Orders
            </a>
            <a href="/dashboard/favorites"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Favourites
            </a>
            <a href="/dashboard/integrations"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Integrations
            </a>
            <a href="/dashboard/brand-store"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Brand Store
            </a>
            <a href="/dashboard/admin/buyers"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              Admin
            </a>
            <a href="/"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Showroom
            </a>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="pt-[60px]">

        {/* ── Masthead ──────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">

            <p className="text-[8px] uppercase tracking-[0.6em] mb-6"
               style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              VIP Member · {season}
            </p>

            <h1 style={{
              fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize    : 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight  : 400,
              lineHeight  : 1.0,
              color       : '#0a0a0a',
              marginBottom: '1.5rem',
            }}>
              Welcome,<br />
              <em style={{ fontStyle: 'italic', color: '#bbb' }}>{emailHandle}</em>
            </h1>

            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-[9px] uppercase tracking-[0.3em]"
                 style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
                {user.email}
              </p>
              <div className="w-px h-3 bg-zinc-200" />
              <p className="text-[9px] uppercase tracking-[0.3em]"
                 style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
                Member since {joinDate}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <p className="text-[7.5px] uppercase tracking-[0.55em] mb-10"
             style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            Collection Overview
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Total Pieces"
              value={String(totalItems)}
              sub={`${availableItems.length} available`}
            />
            <Stat
              label="Brands"
              value={String(brands.length)}
              sub={brands.slice(0, 2).join(' · ') || 'Curated Selection'}
            />
            <Stat
              label="Categories"
              value={String(categories.length)}
              sub={categories.slice(0, 2).join(' · ') || 'Ready to Wear'}
            />
            <Stat
              label="Avg. Wholesale"
              value={avgWholesale > 0 ? fmtPrice(avgWholesale) : '—'}
              sub={avgWholesale > 0 ? `€${(avgWholesale * USD_TO_EUR).toFixed(0)} EUR` : 'On Request'}
            />
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-16">
          <div className="border-t border-zinc-100" />
        </div>

        {/* ── Featured selection ────────────────────────────────────────────── */}
        {featured.length > 0 && (
          <section className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
            <div className="flex items-end justify-between mb-14 pb-7 border-b border-zinc-100">
              <div>
                <p className="text-[7.5px] uppercase tracking-[0.55em] mb-3"
                   style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
                  Wholesale Access · {season}
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
                  fontSize  : 'clamp(1.6rem, 3vw, 2.2rem)',
                  fontWeight: 400,
                  lineHeight: 1,
                  color     : '#111',
                }}>
                  Available Now
                </h2>
              </div>
              <a href="/"
                 className="hidden md:block text-[8px] uppercase tracking-[0.4em] border-b pb-px hover:opacity-50 transition-opacity"
                 style={{ color: '#888', borderColor: '#ddd', fontFamily: 'system-ui, sans-serif' }}>
                View Full Showroom →
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
              {featured.map(item => (
                <ProductCard
                  key={safeStr(item.id)}
                  item={item}
                  verified={true}
                />
              ))}
            </div>

            {totalItems > 6 && (
              <div className="mt-16 flex justify-center">
                <a href="/"
                   className="inline-block px-12 py-[14px] text-[8.5px] uppercase tracking-[0.5em]
                              border border-zinc-200 text-zinc-400
                              hover:border-zinc-800 hover:text-zinc-800 transition-colors duration-200"
                   style={{ fontFamily: 'system-ui, sans-serif' }}>
                  View All {totalItems} Pieces
                </a>
              </div>
            )}
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {totalItems === 0 && (
          <section className="max-w-screen-xl mx-auto px-8 md:px-16 py-24 text-center">
            <div className="w-12 h-px mb-12 mx-auto" style={{ background: '#e8e8e8' }} />
            <h2 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize  : 'clamp(2rem, 5vw, 4rem)',
              fontWeight: 400,
              lineHeight: 1.05,
              color     : '#111',
            }}>
              Collection<br />
              <em style={{ fontStyle: 'italic', color: '#bbb' }}>Coming Soon</em>
            </h2>
            <p className="mt-6 text-[13px] leading-[1.9] max-w-xs mx-auto"
               style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
              Our buyers are curating the next selection. You will be notified when new pieces are available.
            </p>
          </section>
        )}

        {/* ── Account section ───────────────────────────────────────────────── */}
        <section className="border-t border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
            <p className="text-[7.5px] uppercase tracking-[0.55em] mb-10"
               style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
              Account
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-100">
              {[
                { label: 'Email Address',  value: user.email ?? '—' },
                { label: 'Access Level',   value: 'VIP Wholesale' },
                { label: 'Member Since',   value: joinDate },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white p-8">
                  <p className="text-[7.5px] uppercase tracking-[0.45em] mb-3"
                     style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
                    {label}
                  </p>
                  <p className="text-[13px]" style={{ color: '#444', fontFamily: 'system-ui, sans-serif' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10
                        flex items-center justify-between gap-6">
          <div>
            <p style={{
              fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize    : '13px',
              letterSpacing: '0.5em',
              marginBottom: '5px',
              fontWeight  : 400,
            }}>
              MXLLA Agency
            </p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]"
               style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
              Private Showroom · Authorised Retailers Only
            </p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em] text-right"
             style={{ color: '#d8d8d8', fontFamily: 'system-ui, sans-serif' }}>
            © {new Date().getFullYear()} MXLLA ·{' '}
            <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
