import { createClient } from '@/lib/supabase/server';
import Link            from 'next/link';

export const revalidate = 3600;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function getPublicCatalog() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('brand_name, category, title, image_url')
      .limit(24);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavBar({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center h-[60px]">

        {/* Wordmark */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none select-none">
          <span className="block font-normal"
                style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '17px', letterSpacing: '0.6em' }}>
            MXLLA
          </span>
          <span className="block text-[7px] uppercase tracking-[0.6em] mt-[3px]" style={{ color: '#bbb' }}>
            Agency
          </span>
        </div>

        {/* Left nav */}
        <nav className="flex items-center gap-8">
          <Link href="/marketplace"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
            Marketplace
          </Link>
          <Link href="/fashionevents"
                className="hidden md:block text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
            Events
          </Link>
          <Link href="/join"
                className="hidden md:block text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
            Join
          </Link>
        </nav>

        {/* Right nav */}
        <div className="ml-auto flex items-center gap-6">
          {isLoggedIn ? (
            <Link href="/dashboard"
                  className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                  style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              My Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login"
                    className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                    style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
                Sign In
              </Link>
              <Link href="/join"
                    className="text-[8px] uppercase tracking-[0.4em] px-5 py-2 bg-black text-white
                               hover:bg-zinc-800 transition-colors"
                    style={{ fontFamily: 'system-ui, sans-serif' }}>
                Apply
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase   = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const items      = await getPublicCatalog();
  const brands     = [...new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))];
  const categories = [...new Set(items.map(i => safeStr(i.category)).filter(Boolean))];

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <NavBar isLoggedIn={!!user} />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="pt-[60px] min-h-screen flex flex-col justify-center
                          max-w-screen-xl mx-auto px-8 md:px-16">

        <div className="max-w-4xl py-32">
          <p className="text-[8px] uppercase tracking-[0.7em] mb-10"
             style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
            The Wholesale Intelligence Platform
          </p>

          <h1 style={{
            fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize    : 'clamp(3.5rem, 8vw, 7.5rem)',
            fontWeight  : 400,
            lineHeight  : 0.94,
            letterSpacing: '-0.02em',
            color       : '#0a0a0a',
            marginBottom: '3rem',
          }}>
            Where Luxury<br />
            Brands Meet<br />
            <em style={{ color: '#bbb', fontStyle: 'italic' }}>Retail Buyers</em>
          </h1>

          <p className="text-[15px] leading-[1.9] max-w-lg mb-12"
             style={{ color: '#888' }}>
            Linezheets connects authorised wholesale buyers with designer houses —
            combining a private showroom, intelligent stock management, and
            AI-powered merchandising in one platform.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/join"
                  className="inline-block px-12 py-4 text-[8.5px] uppercase tracking-[0.5em]
                             bg-black text-white hover:bg-zinc-900 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
              Apply for Access
            </Link>
            <Link href="/marketplace"
                  className="inline-block px-12 py-4 text-[8.5px] uppercase tracking-[0.5em]
                             border border-zinc-200 text-zinc-500
                             hover:border-zinc-800 hover:text-zinc-800 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
              Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="pb-12 flex items-center gap-4">
          <div className="w-px h-10 bg-zinc-200" />
          <p className="text-[7.5px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>
            Scroll to explore
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <p className="text-[7.5px] uppercase tracking-[0.55em] mb-16"
             style={{ color: '#ccc' }}>
            How It Works
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-100">
            {[
              {
                n    : '01',
                title: 'Apply',
                body : 'Register your business and submit for verification. We accept authorised retailers, boutiques, and multi-brand stores.',
              },
              {
                n    : '02',
                title: 'Get Approved',
                body : 'Our team reviews your application. Approved buyers receive VIP access to the private showroom and wholesale pricing.',
              },
              {
                n    : '03',
                title: 'Trade',
                body : 'Browse collections, communicate directly with designer houses, place orders, and manage your inventory — all in one place.',
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="bg-white p-10 md:p-14">
                <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#ddd', marginBottom: '2.5rem' }}>
                  {n}
                </p>
                <h3 style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize  : '1.8rem',
                  fontWeight: 400,
                  color     : '#111',
                  marginBottom: '1.25rem',
                }}>
                  {title}
                </h3>
                <p className="text-[13px] leading-[1.9]" style={{ color: '#999' }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURE PILLAR 1 — Intelligent POS & Operations
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left — heading */}
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
                 style={{ color: '#c9a84c' }}>
                Pillar I · Operations
              </p>
              <h2 style={{
                fontFamily  : 'var(--font-serif), Georgia, serif',
                fontSize    : 'clamp(2rem, 4vw, 3.5rem)',
                fontWeight  : 400,
                lineHeight  : 1.05,
                color       : '#111',
                marginBottom: '1.5rem',
              }}>
                Intelligent POS &<br />Stock Management
              </h2>
              <p className="text-[14px] leading-[1.9] max-w-sm" style={{ color: '#888' }}>
                A complete back-office built for wholesale fashion —
                from the showroom floor to the stockroom.
              </p>
            </div>

            {/* Right — feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-200">
              {[
                { icon: '◈', label: 'Point of Sale',        desc: 'Streamlined POS with receipt and invoice generation built for B2B transactions.' },
                { icon: '◉', label: 'Sales Analytics',      desc: 'Daily and monthly reports with trend breakdowns across brands, categories, and buyers.' },
                { icon: '◎', label: 'Restock Reminders',    desc: 'Automatic low-stock alerts based on sales velocity and minimum order quantities.' },
                { icon: '◇', label: 'Stock Sync',           desc: 'Live inventory sync with Shopify, any e-commerce store, or physical POS terminal.' },
                { icon: '◆', label: 'Invoicing',            desc: 'Professional wholesale invoicing with consignment terms, payment tracking, and history.' },
                { icon: '◻', label: 'In-Platform Comms',    desc: 'Email and messaging with designer houses directly inside the platform — no inbox switching.' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="bg-zinc-50 p-8">
                  <p className="text-[18px] mb-4" style={{ color: '#c9a84c' }}>{icon}</p>
                  <p className="text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#888' }}>
                    {label}
                  </p>
                  <p className="text-[12px] leading-[1.8]" style={{ color: '#aaa' }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURE PILLAR 2 — AI
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100 bg-black text-white">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left — heading */}
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-8"
                 style={{ color: '#c9a84c' }}>
                Pillar II · Intelligence
              </p>
              <h2 style={{
                fontFamily  : 'var(--font-serif), Georgia, serif',
                fontSize    : 'clamp(2rem, 4vw, 3.5rem)',
                fontWeight  : 400,
                lineHeight  : 1.05,
                color       : '#fff',
                marginBottom: '1.5rem',
              }}>
                AI-Powered<br />
                <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>Merchandising</em>
              </h2>
              <p className="text-[14px] leading-[1.9] max-w-sm" style={{ color: '#777' }}>
                From first look to final sale — AI that understands fashion,
                not just data.
              </p>
            </div>

            {/* Right — feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-800">
              {[
                { icon: '✦', label: 'Brand & Product Matching', desc: 'AI surfaces the brands and pieces most aligned with your store\'s aesthetic and customer profile.' },
                { icon: '✦', label: 'E-Styling',                desc: 'AI-generated outfit and look suggestions across your selected inventory for campaigns and buyer guides.' },
                { icon: '✦', label: 'Look Lineup',              desc: 'Build and preview full product-line lookbooks before or after purchase, with AI-assisted curation.' },
                { icon: '✦', label: 'B2C Store Builder',        desc: 'Instantly generate a buyer-ready e-commerce storefront from your wholesale catalogue.' },
                { icon: '✦', label: 'Shopify Sync',             desc: 'Push products, prices, and stock levels directly to Shopify or any connected store in real time.' },
                { icon: '✦', label: 'Multi-Channel Sync',       desc: 'One inventory, everywhere — website, physical POS, marketplace, and wholesale portal always in sync.' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="bg-black p-8 border border-zinc-900">
                  <p className="text-[14px] mb-4" style={{ color: '#c9a84c' }}>{icon}</p>
                  <p className="text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#666' }}>
                    {label}
                  </p>
                  <p className="text-[12px] leading-[1.8]" style={{ color: '#555' }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          MARKETPLACE TEASER — locked
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <div className="flex items-end justify-between mb-16 pb-7 border-b border-zinc-100">
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-3" style={{ color: '#ccc' }}>
                The Marketplace
              </p>
              <h2 style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize  : 'clamp(1.8rem, 3vw, 2.8rem)',
                fontWeight: 400,
                color     : '#111',
              }}>
                {brands.length > 0 ? `${brands.length} Brands · ${categories.length} Categories` : 'Curated Wholesale Brands'}
              </h2>
            </div>
            <Link href="/login"
                  className="hidden md:block text-[8px] uppercase tracking-[0.4em] border-b pb-px
                             hover:opacity-50 transition-opacity"
                  style={{ color: '#c9a84c', borderColor: '#c9a84c' }}>
              Sign In to Browse →
            </Link>
          </div>

          {/* Brand chips */}
          {brands.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-16">
              {brands.map(b => (
                <Link key={b} href="/login"
                      className="text-[8px] uppercase tracking-[0.3em] px-4 py-2 border border-zinc-200
                                 hover:border-zinc-800 transition-colors"
                      style={{ color: '#999' }}>
                  {b}
                </Link>
              ))}
            </div>
          )}

          {/* Locked item grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 relative">
            {(items.length > 0 ? items.slice(0, 8) : Array.from({ length: 8 })).map((item, i) => (
              <Link key={i} href="/login" className="group block">
                <div className="relative aspect-[2/3] bg-zinc-100 overflow-hidden mb-3">
                  {item && safeStr((item as { image_url?: unknown }).image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={safeStr((item as { image_url?: unknown }).image_url)}
                      alt=""
                      className="w-full h-full object-cover blur-[3px] scale-105 grayscale"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-px bg-zinc-300" />
                    </div>
                  )}
                  {/* Lock overlay */}
                  <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center gap-2">
                    <span className="text-[18px]" style={{ color: '#ccc' }}>⊕</span>
                    <span className="text-[7px] uppercase tracking-[0.3em]" style={{ color: '#bbb' }}>
                      Login to view
                    </span>
                  </div>
                </div>
                <div className="h-2 w-16 bg-zinc-100 rounded mb-1" />
                <div className="h-2 w-10 bg-zinc-50 rounded" />
              </Link>
            ))}

            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>

          <div className="mt-12 flex justify-center">
            <Link href="/join"
                  className="inline-block px-16 py-4 text-[8.5px] uppercase tracking-[0.5em]
                             bg-black text-white hover:bg-zinc-900 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
              Apply for Wholesale Access
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16
                        grid grid-cols-2 md:grid-cols-4 gap-10">

          <div className="col-span-2 md:col-span-1">
            <p style={{
              fontFamily  : 'var(--font-serif), Georgia, serif',
              fontSize    : '15px',
              letterSpacing: '0.5em',
              marginBottom: '8px',
              fontWeight  : 400,
            }}>
              MXLLA
            </p>
            <p className="text-[7.5px] uppercase tracking-[0.3em] mb-6" style={{ color: '#ccc' }}>
              Agency · Linezheets Platform
            </p>
            <p className="text-[11px] leading-[1.8]" style={{ color: '#bbb' }}>
              Private wholesale marketplace for authorised luxury retailers.
            </p>
          </div>

          {[
            {
              heading: 'Platform',
              links  : [
                { label: 'Marketplace',     href: '/marketplace' },
                { label: 'Fashion Events',  href: '/fashionevents' },
                { label: 'Dashboard',       href: '/dashboard' },
              ],
            },
            {
              heading: 'Company',
              links  : [
                { label: 'About',    href: '/about' },
                { label: 'Partners', href: '/join' },
                { label: 'Contact',  href: '/contact' },
              ],
            },
            {
              heading: 'Access',
              links  : [
                { label: 'Apply Now', href: '/join' },
                { label: 'Sign In',   href: '/login' },
              ],
            },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <p className="text-[7.5px] uppercase tracking-[0.45em] mb-6" style={{ color: '#bbb' }}>
                {heading}
              </p>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}
                          className="text-[11px] hover:opacity-50 transition-opacity"
                          style={{ color: '#999' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 pb-8
                        flex items-center justify-between border-t border-zinc-50 pt-8">
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#ddd' }}>
            © {new Date().getFullYear()} MXLLA Agency
          </p>
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#ddd' }}>
            Powered by <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
