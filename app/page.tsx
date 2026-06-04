import { createClient } from '@/lib/supabase/server'; // used in getPublicCatalog
import Link            from 'next/link';
import { OrderScrollSection }       from '@/components/OrderScrollSection';
import { DashboardShowcaseSection } from '@/components/DashboardShowcaseSection';
import { NavBarAuth }               from '@/components/NavBarAuth';

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

function NavBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border-b border-zinc-100">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center h-[60px]">

        {/* Wordmark */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none select-none">
          <span className="block font-normal"
                style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '17px', letterSpacing: '0.6em' }}>
            LINEZHEETS
          </span>
          <span className="block text-[7px] uppercase tracking-[0.6em] mt-[3px]" style={{ color: '#bbb' }}>
            Platform
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

        {/* Right nav — client component so auth state is always live */}
        <div className="ml-auto flex items-center gap-6">
          <NavBarAuth />
        </div>

      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const items      = await getPublicCatalog();
  const brands     = [...new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))];
  const categories = [...new Set(items.map(i => safeStr(i.category)).filter(Boolean))];

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <NavBar />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="pt-[60px] min-h-screen flex flex-col justify-center
                          max-w-screen-xl mx-auto px-8 md:px-16">

        <div className="max-w-4xl py-32">
          <p className="text-[8px] uppercase tracking-[0.7em] mb-10"
             style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
            The Digital Linesheet, Reinvented
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
            <em style={{ color: '#bbb', fontStyle: 'italic' }}>Wholesale Buyers</em>
          </h1>

          <p className="text-[15px] leading-[1.9] max-w-lg mb-4"
             style={{ color: '#888' }}>
            Linezheets replaces static PDF linesheets with a live, buyer-ready digital catalog —
            combining a private showroom, intelligent stock management, and
            AI-powered merchandising in one platform.
          </p>

          <p className="text-[13px] leading-[1.8] max-w-lg mb-12"
             style={{ color: '#bbb', fontFamily: 'var(--font-mono), monospace' }}>
            Say goodbye to PDF linesheets. Say hello to buyers who actually buy.
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
          STATS BAR — social proof
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-b border-zinc-100 bg-zinc-50">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-zinc-200">
            {[
              { value: brands.length > 0 ? `${brands.length}+` : '100+', label: 'Designer Brands' },
              { value: categories.length > 0 ? `${categories.length}+` : '30+', label: 'Categories' },
              { value: '40+',  label: 'Countries' },
              { value: '100%', label: 'Verified Buyers' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center md:px-8">
                <p style={{
                  fontFamily  : 'var(--font-serif), Georgia, serif',
                  fontSize    : 'clamp(2rem, 4vw, 3rem)',
                  fontWeight  : 400,
                  color       : '#0a0a0a',
                  lineHeight  : 1,
                  marginBottom: '0.5rem',
                }}>
                  {value}
                </p>
                <p className="text-[7.5px] uppercase tracking-[0.45em]" style={{ color: '#aaa' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
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
                body : 'Register your business and submit for verification. We accept authorised retailers, boutiques, and multi-brand stores worldwide.',
              },
              {
                n    : '02',
                title: 'Get Approved',
                body : 'Our team reviews your application. Approved buyers receive VIP access to the private showroom and exclusive wholesale pricing.',
              },
              {
                n    : '03',
                title: 'Trade',
                body : 'Browse live digital linesheets, communicate directly with designer houses, place orders, and manage your inventory — all in one place.',
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="bg-white p-10 md:p-14 group hover:bg-zinc-50 transition-colors">
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
          ORDER UI SCROLL ANIMATION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100">
        <OrderScrollSection />
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOR BRANDS — quote + features
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — Quote */}
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-10"
                 style={{ color: '#c9a84c' }}>
                For Brands
              </p>
              <blockquote style={{
                fontFamily  : 'var(--font-serif), Georgia, serif',
                fontSize    : 'clamp(1.6rem, 3.5vw, 2.8rem)',
                fontWeight  : 400,
                lineHeight  : 1.15,
                color       : '#0a0a0a',
                marginBottom: '2rem',
              }}>
                Say goodbye to PDF&nbsp;linesheets.<br />
                Say hello to buyers<br />
                <em style={{ color: '#c9a84c' }}>who actually buy.</em>
              </blockquote>
              <p className="text-[14px] leading-[1.9] max-w-sm mb-10" style={{ color: '#888' }}>
                Your collection deserves more than a static file. Linezheets puts your brand
                in front of verified wholesale buyers — live, branded, and always up to date.
                One link. Your full digital linesheet. Every buyer, anywhere in the world.
              </p>
              <Link href="/join"
                    className="inline-block text-[8px] uppercase tracking-[0.4em] border-b pb-px
                               hover:opacity-50 transition-opacity"
                    style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
                List Your Brand →
              </Link>
            </div>

            {/* Right — feature list */}
            <div className="space-y-px border border-zinc-100">
              {[
                {
                  heading: 'Live Digital Linesheets',
                  body   : 'Replace PDFs with always-current digital catalogs. Update prices, availability, and lookbooks instantly — no resending files.',
                },
                {
                  heading: 'Verified Buyer Network',
                  body   : 'Every buyer on the platform is verified. Stop chasing leads — connect with authorised retailers who are ready to order.',
                },
                {
                  heading: 'B2B Market Expansion',
                  body   : 'Expand your wholesale reach across 40+ countries without hiring a new sales team. Linezheets handles the infrastructure.',
                },
                {
                  heading: 'Sales Analytics & Reports',
                  body   : 'Track which products move, which buyers repeat, and where your revenue comes from — all in your brand dashboard.',
                },
              ].map(({ heading, body }) => (
                <div key={heading} className="px-8 py-7 bg-white hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0">
                  <p className="text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#333' }}>
                    {heading}
                  </p>
                  <p className="text-[13px] leading-[1.8]" style={{ color: '#999' }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
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
                <div key={label} className="bg-zinc-50 p-8 hover:bg-white transition-colors">
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
                <div key={label} className="bg-black p-8 border border-zinc-900 hover:border-zinc-700 transition-colors">
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
          DASHBOARD SHOWCASE — platform UI mockup sections
      ══════════════════════════════════════════════════════════════════════ */}
      <DashboardShowcaseSection />

      {/* ══════════════════════════════════════════════════════════════════════
          FOR BUYERS — quote + benefits
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-28">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — feature list */}
            <div className="order-2 lg:order-1 grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-100">
              {[
                {
                  icon : '○',
                  label: 'One Platform, Every Brand',
                  body : 'All the brands you carry — their catalogs, pricing, and availability — in one place. No more inbox hunting.',
                },
                {
                  icon : '◌',
                  label: 'Easier Order Management',
                  body : 'Place, track, and manage wholesale orders with payment terms, installments, and invoicing handled automatically.',
                },
                {
                  icon : '◍',
                  label: 'Smarter Stock Control',
                  body : 'Live inventory visibility across all your brands. Restock alerts, low-stock warnings, and automatic sync to your store.',
                },
                {
                  icon : '●',
                  label: 'Direct Brand Communication',
                  body : 'Message designer houses directly inside the platform. No CC chains, no lost attachments, no inbox chaos.',
                },
                {
                  icon : '◐',
                  label: 'Finance at a Glance',
                  body : 'Outstanding payments, installment schedules, and spend history across all brands — visible in one dashboard.',
                },
                {
                  icon : '◑',
                  label: 'Exclusive Event Access',
                  body : 'Invitations to private showroom events, fashion weeks, and brand previews — managed directly in the platform.',
                },
              ].map(({ icon, label, body }) => (
                <div key={label} className="bg-white p-8 hover:bg-zinc-50 transition-colors">
                  <p className="text-[18px] mb-4" style={{ color: '#c9a84c' }}>{icon}</p>
                  <p className="text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: '#888' }}>
                    {label}
                  </p>
                  <p className="text-[12px] leading-[1.8]" style={{ color: '#aaa' }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>

            {/* Right — Quote */}
            <div className="order-1 lg:order-2">
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-10"
                 style={{ color: '#c9a84c' }}>
                For Buyers
              </p>
              <blockquote style={{
                fontFamily  : 'var(--font-serif), Georgia, serif',
                fontSize    : 'clamp(1.6rem, 3.5vw, 2.8rem)',
                fontWeight  : 400,
                lineHeight  : 1.15,
                color       : '#0a0a0a',
                marginBottom: '2rem',
              }}>
                Say goodbye to<br />
                inbox chaos.<br />
                <em style={{ color: '#c9a84c' }}>Say hello to easier buying.</em>
              </blockquote>
              <p className="text-[14px] leading-[1.9] max-w-sm mb-10" style={{ color: '#888' }}>
                Every collection, curated and organised — exactly when you need it.
                From discovery to order confirmation, without a single email attachment.
                The way the best buyers shop wholesale.
              </p>
              <Link href="/join"
                    className="inline-block text-[8px] uppercase tracking-[0.4em] border-b pb-px
                               hover:opacity-50 transition-opacity"
                    style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
                Apply for Buyer Access →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          MARQUEE QUOTES — scrolling ticker
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100 bg-black text-white overflow-hidden py-6">
        <div className="flex gap-16 whitespace-nowrap"
             style={{ animation: 'marquee 30s linear infinite' }}>
          {[
            'One link. Your full collection. Every buyer.',
            'Where brands meet buyers — and deals get done.',
            'Your collection. Their next order. One platform.',
            'The digital linesheet, reinvented.',
            'Wholesale fashion, the way it should work.',
            'Better brands. Faster decisions. Easier buying.',
            'One link. Your full collection. Every buyer.',
            'Where brands meet buyers — and deals get done.',
            'Your collection. Their next order. One platform.',
          ].map((quote, i) => (
            <span key={i} className="text-[8.5px] uppercase tracking-[0.45em]"
                  style={{ color: i % 3 === 1 ? '#c9a84c' : '#444', fontFamily: 'system-ui, sans-serif' }}>
              {quote}
              <span className="mx-8" style={{ color: '#333' }}>·</span>
            </span>
          ))}
        </div>
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
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
          CTA SPLIT — final conversion section
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-0
                        grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200">

          {/* Brand CTA */}
          <div className="py-20 md:pr-16">
            <p className="text-[7.5px] uppercase tracking-[0.55em] mb-6" style={{ color: '#c9a84c' }}>
              For Brands
            </p>
            <h3 style={{
              fontFamily  : 'var(--font-serif), Georgia, serif',
              fontSize    : 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight  : 400,
              lineHeight  : 1.1,
              color       : '#111',
              marginBottom: '1.25rem',
            }}>
              Stop chasing buyers<br />with email attachments.
            </h3>
            <p className="text-[13px] leading-[1.9] mb-8" style={{ color: '#888' }}>
              Start closing wholesale with a platform built for how fashion actually moves.
              One digital linesheet. Every buyer, everywhere.
            </p>
            <Link href="/join"
                  className="inline-block px-10 py-3.5 text-[8px] uppercase tracking-[0.45em]
                             bg-black text-white hover:bg-zinc-800 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
              List Your Brand
            </Link>
          </div>

          {/* Buyer CTA */}
          <div className="py-20 md:pl-16">
            <p className="text-[7.5px] uppercase tracking-[0.55em] mb-6" style={{ color: '#c9a84c' }}>
              For Buyers
            </p>
            <h3 style={{
              fontFamily  : 'var(--font-serif), Georgia, serif',
              fontSize    : 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight  : 400,
              lineHeight  : 1.1,
              color       : '#111',
              marginBottom: '1.25rem',
            }}>
              Your next season&apos;s buys —<br />curated and ready to order.
            </h3>
            <p className="text-[13px] leading-[1.9] mb-8" style={{ color: '#888' }}>
              No more chasing brands for updated PDFs. One platform for every brand
              you carry — stock, orders, and finance, all without the spreadsheet scramble.
            </p>
            <Link href="/join"
                  className="inline-block px-10 py-3.5 text-[8px] uppercase tracking-[0.45em]
                             border border-zinc-300 text-zinc-600
                             hover:border-zinc-800 hover:text-zinc-800 transition-colors"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
              Apply for Buyer Access
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
              LINEZHEETS
            </p>
            <p className="text-[7.5px] uppercase tracking-[0.3em] mb-6" style={{ color: '#ccc' }}>
              Agency · Linezheets Platform
            </p>
            <p className="text-[11px] leading-[1.8]" style={{ color: '#bbb' }}>
              The digital linesheet platform for luxury wholesale — connecting fashion brands
              with verified retail buyers worldwide.
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
                { label: 'Apply Now',    href: '/join' },
                { label: 'Sign In',      href: '/login' },
                { label: 'For Brands',   href: '/join' },
                { label: 'For Buyers',   href: '/join' },
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

        {/* SEO text — visible but subtle, keyword-rich for crawlers */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 pb-12">
          <p className="text-[10px] leading-[2] max-w-2xl" style={{ color: '#ddd' }}>
            Linezheets is a B2B wholesale fashion platform that replaces traditional linesheets and PDF line
            sheets with live digital catalogs. Fashion brands use Linezheets to share collections with wholesale
            buyers, manage B2B orders, sync inventory, and grow their retail network globally.
            Wholesale buyers use Linezheets to browse brand catalogs, manage stock, place orders, and
            communicate with designer houses — all without leaving the platform.
          </p>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 pb-8
                        flex items-center justify-between border-t border-zinc-50 pt-8">
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#ddd' }}>
            © {new Date().getFullYear()} Linezheets · All rights reserved
          </p>
          <div className="flex items-center gap-6">
            <Link href="/legal"
                  className="text-[7.5px] uppercase tracking-[0.2em] hover:opacity-50 transition-opacity"
                  style={{ color: '#ddd' }}>
              Legal
            </Link>
            <Link href="/contact"
                  className="text-[7.5px] uppercase tracking-[0.2em] hover:opacity-50 transition-opacity"
                  style={{ color: '#ddd' }}>
              Contact
            </Link>
            <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#ddd' }}>
              Powered by <span style={{ color: '#c9a84c' }}>Linezheets</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
