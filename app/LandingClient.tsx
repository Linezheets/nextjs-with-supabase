'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import { NavBarAuth } from '@/components/NavBarAuth';
import { DeviceShowcaseScroll } from '@/components/DeviceShowcaseScroll';
import { emptyShowcaseData } from '@/lib/showcase-types';
import type { ShowcaseData } from '@/lib/showcase-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogItem {
  brand_name?: unknown;
  category?: unknown;
  title?: unknown;
  image_url?: unknown;
}

interface Props {
  items: CatalogItem[];
  brands: string[];
  categories: string[];
  showcase?: ShowcaseData;
}

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GOLD        = '#c9a84c';
const GOLD_BRIGHT = '#e8c56b';
const GOLD_DIM    = '#7a6428';
const TEXT_BODY   = 'rgba(255,255,255,0.72)';
const TEXT_MUTED  = 'rgba(255,255,255,0.50)';
const TEXT_DIM    = 'rgba(255,255,255,0.30)';
const BORDER      = 'rgba(255,255,255,0.07)';
const GOLD_BORDER = 'rgba(201,168,76,0.18)';

// ─── Fixed particles (deterministic — no Math.random on server) ───────────────

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: ((i * 37 + 11) % 97),
  y: ((i * 53 + 7) % 89),
  size: (i % 3) * 0.75 + 0.5,
  duration: (i % 5) * 3 + 10,
  delay: (i % 8),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 48 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function TiltCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);
  const handleMouseLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);
  return (
    <motion.div className={className}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', ...style }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </motion.div>
  );
}

// ─── Grain overlay ────────────────────────────────────────────────────────────

function Grain() {
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', opacity: 0.028,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: '200px 200px',
    }} />
  );
}

// ─── Logo mark — crops the geometric icon from the lockup PNG, stopping before the embedded wordmark.
// Source (1382×768): mark ≈ x:415–968 (w:553), y:63–530 (h:467). Scale so mark height → size.
function LogoMark({ size = 44, opacity = 1 }: { size?: number; opacity?: number }) {
  const MARK = { x0: 415, y0: 63, w: 553, h: 467 };
  const scale = size / MARK.h;
  const bgW   = Math.round(1382 * scale);
  const bgH   = Math.round(768  * scale);
  const offX  = -Math.round(MARK.x0 * scale);
  const offY  = -Math.round(MARK.y0 * scale);
  const width = Math.round(MARK.w  * scale);
  return (
    <div style={{
      width, height: size, flexShrink: 0, opacity, overflow: 'hidden',
      backgroundImage: 'url(/linezheets-logo.png)',
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${offX}px ${offY}px`,
      backgroundRepeat: 'no-repeat',
    }} aria-label="Linezheets" role="img" />
  );
}

// ─── Gold button ──────────────────────────────────────────────────────────────

function GoldButton({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-block', padding: '1.1rem 2.8rem',
        fontSize: 15, letterSpacing: '0.5em', textTransform: 'uppercase', textDecoration: 'none',
        fontFamily: 'var(--font-mono), monospace', transition: 'all 0.3s ease',
        ...(primary ? {
          background: hovered ? `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})` : `linear-gradient(135deg,${GOLD},${GOLD_DIM})`,
          color: '#000', fontWeight: 600,
          boxShadow: hovered ? `0 0 40px rgba(201,168,76,0.55),0 0 80px rgba(201,168,76,0.2)` : `0 0 20px rgba(201,168,76,0.25)`,
        } : {
          background: 'transparent',
          color: hovered ? GOLD_BRIGHT : 'rgba(255,255,255,0.65)',
          border: `1px solid ${hovered ? GOLD : 'rgba(255,255,255,0.18)'}`,
          boxShadow: hovered ? `0 0 20px rgba(201,168,76,0.15)` : 'none',
        }),
      }}>
      {children}
    </Link>
  );
}

// ─── Floating particles ───────────────────────────────────────────────────────

function Particles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map(p => (
        <motion.div key={p.id}
          style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%', backgroundColor: GOLD, opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0], y: [-20, -90] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

// ─── Solutions mega-menu data ─────────────────────────────────────────────────

const SOLUTIONS = [
  {
    icon: '◈',
    title: 'Live Digital Linesheets',
    desc: 'Replace PDFs with always-current digital catalogs. One link, every buyer.',
    href: '/#for-brands',
    tag: 'For Brands',
  },
  {
    icon: '◉',
    title: 'Verified Buyer Network',
    desc: 'Connect with authorised retailers and boutiques who are ready to order.',
    href: '/marketplace',
    tag: 'Marketplace',
  },
  {
    icon: '✦',
    title: 'AI-Powered Merchandising',
    desc: 'Brand matching, e-styling, look lineup and AI-generated storefronts.',
    href: '/#ai-intelligence',
    tag: 'AI Studio',
  },
  {
    icon: '◆',
    title: 'Intelligent POS & Stock',
    desc: 'Point of sale, invoicing, restock alerts, and live inventory sync.',
    href: '/#operations',
    tag: 'Operations',
  },
  {
    icon: '◎',
    title: 'B2C Store Builder',
    desc: 'Generate a buyer-ready e-commerce storefront from your wholesale catalogue.',
    href: '/dashboard/brand-store/editor',
    tag: 'Store Builder',
  },
  {
    icon: '○',
    title: 'Fashion Events',
    desc: 'Exclusive showroom events, fashion weeks, and private brand previews.',
    href: '/fashionevents',
    tag: 'Events',
  },
];

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

// ─── Dropdown data ────────────────────────────────────────────────────────────

const PRICING_ITEMS = [
  { label: 'Compare Plans',   desc: 'See all tiers side by side',            href: '/pricing' },
  { label: 'Starter',         desc: 'Free — up to 50 products',              href: '/pricing/starter' },
  { label: 'Brand Plan',      desc: '$149 / mo — scale wholesale globally',  href: '/pricing/brand' },
  { label: 'Enterprise',      desc: 'Custom — multi-brand & agency',         href: '/pricing/enterprise' },
  { label: 'Pricing FAQ',     desc: 'Common questions answered',             href: '/pricing/faq' },
];

const INTEGRATIONS_ITEMS = [
  { label: 'All Integrations', desc: 'Full list of connected platforms',      href: '/integrations' },
  { label: 'Ecommerce',        desc: 'Shopify & WooCommerce sync',            href: '/integrations/ecommerce' },
  { label: 'Payments',         desc: 'Stripe, NET terms & installments',      href: '/integrations/payments' },
  { label: 'Accounting',       desc: 'QuickBooks, Xero & invoicing',          href: '/integrations/accounting' },
  { label: 'API & Webhooks',   desc: 'Build custom connections via our API',  href: '/integrations/api' },
];

const MARKETPLACE_ITEMS = [
  { label: 'Browse Brands',       desc: 'Discover vetted luxury brands',        href: '/marketplace' },
  { label: 'For Buyers',          desc: 'How the marketplace works for buyers', href: '/marketplace/buyers' },
  { label: 'Featured Collections',desc: 'Curated picks this season',            href: '/marketplace/featured' },
  { label: 'Fashion Events',      desc: 'Showrooms, fashion weeks & previews',  href: '/fashionevents' },
];

// ─── Reusable simple dropdown ─────────────────────────────────────────────────

function NavDropdown({
  label,
  items,
  navLinkStyle,
}: {
  label: string;
  items: { label: string; desc: string; href: string }[];
  navLinkStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open_  = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const close_ = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  return (
    <div style={{ position: 'relative' }} onMouseEnter={open_} onMouseLeave={close_}>
      <button
        style={{ ...navLinkStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
        onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}>
        {label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
          style={{ display: 'inline-block', fontSize: 13, opacity: 0.55, lineHeight: 1 }}>▾</motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 'calc(100% + 14px)', left: '-1rem',
              width: 280, background: 'rgba(6,6,6,0.97)',
              border: `1px solid ${GOLD_BORDER}`,
              backdropFilter: 'blur(28px)',
              boxShadow: `0 20px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,168,76,0.06)`,
              padding: '0.5rem 0',
            }}
            onMouseEnter={open_}
            onMouseLeave={close_}>
            {items.map(({ label: itemLabel, desc, href }) => (
              <Link key={href} href={href}
                style={{ display: 'block', padding: '0.85rem 1.25rem', textDecoration: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <p style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--font-mono),monospace', marginBottom: 3, fontWeight: 500 }}>{itemLabel}</p>
                <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{desc}</p>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FuturisticNav() {
  const [scrolled, setScrolled]           = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const openSolutions  = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setSolutionsOpen(true); };
  const closeSolutions = () => { closeTimer.current = setTimeout(() => setSolutionsOpen(false), 120); };

  const navLinkStyle: React.CSSProperties = {
    fontSize: 15, letterSpacing: '0.28em', textTransform: 'uppercase',
    color: TEXT_MUTED, textDecoration: 'none',
    fontFamily: 'var(--font-mono), monospace', transition: 'color 0.2s',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        transition: 'background 0.4s ease, border-color 0.4s ease',
        background: scrolled ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${scrolled ? GOLD_BORDER : 'rgba(255,255,255,0.05)'}`,
      }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem', height: 68, display: 'flex', alignItems: 'center', gap: '2.5rem' }}>

        {/* Logo — left */}
        <Link href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', flexShrink: 0 }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.85'; (el.querySelector('.logo-wordmark') as HTMLElement | null)?.style && ((el.querySelector('.logo-wordmark') as HTMLElement).style.color = GOLD); }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; (el.querySelector('.logo-wordmark') as HTMLElement | null)?.style && ((el.querySelector('.logo-wordmark') as HTMLElement).style.color = 'white'); }}>
          <LogoMark size={42} />
          <div className="logo-wordmark" style={{ fontSize: 16, letterSpacing: '0.55em', fontFamily: 'var(--font-serif), Georgia, serif', color: 'white', fontWeight: 400, lineHeight: 1, textTransform: 'uppercase', transition: 'color 0.2s' }}>
            Linezheets
          </div>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginLeft: '1rem', position: 'relative' }}>

          {/* Solutions dropdown */}
          <div style={{ position: 'relative' }}
            onMouseEnter={openSolutions}
            onMouseLeave={closeSolutions}>
            <button style={{ ...navLinkStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
              onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}>
              Solutions
              <motion.span animate={{ rotate: solutionsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}
                style={{ display: 'inline-block', fontSize: 15, opacity: 0.6 }}>▾</motion.span>
            </button>

            {/* Mega-menu panel */}
            <AnimatePresence>
              {solutionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 16px)', left: '-1rem',
                    width: 640, background: 'rgba(8,8,8,0.97)',
                    border: `1px solid ${GOLD_BORDER}`,
                    backdropFilter: 'blur(30px)',
                    boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.08)`,
                    padding: '1.5rem',
                  }}
                  onMouseEnter={openSolutions}
                  onMouseLeave={closeSolutions}>

                  {/* Header */}
                  <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: 15, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono), monospace' }}>
                      Platform Solutions
                    </p>
                    <p style={{ fontSize: 16, color: TEXT_MUTED, marginTop: 4 }}>
                      Everything you need to run wholesale fashion, end to end.
                    </p>
                  </div>

                  {/* Feature grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: BORDER }}>
                    {SOLUTIONS.map(({ icon, title, desc, href, tag }) => (
                      <Link key={title} href={href}
                        onClick={() => setSolutionsOpen(false)}
                        style={{ display: 'block', padding: '1rem 1.25rem', background: 'rgba(8,8,8,0.97)', textDecoration: 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(8,8,8,0.97)'; }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <span style={{ fontSize: 18, color: GOLD, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.01em' }}>{title}</p>
                              <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: GOLD_DIM, fontFamily: 'var(--font-mono),monospace', border: `1px solid rgba(201,168,76,0.2)`, padding: '1px 6px' }}>{tag}</span>
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_MUTED }}>{desc}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Footer CTA */}
                  <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '1.25rem', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 15, color: TEXT_MUTED }}>
                      Ready to transform your wholesale business?
                    </p>
                    <Link href="/join" style={{
                      fontSize: 16, letterSpacing: '0.35em', textTransform: 'uppercase',
                      color: '#000', background: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`,
                      padding: '0.6rem 1.25rem', textDecoration: 'none',
                      fontFamily: 'var(--font-mono), monospace', fontWeight: 600,
                    }}>
                      Apply for Access
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pricing, Integrations, Marketplace dropdowns */}
          <NavDropdown label="Pricing"      items={PRICING_ITEMS}      navLinkStyle={navLinkStyle} />
          <NavDropdown label="Integrations" items={INTEGRATIONS_ITEMS} navLinkStyle={navLinkStyle} />
          <NavDropdown label="Marketplace"  items={MARKETPLACE_ITEMS}  navLinkStyle={navLinkStyle} />
        </nav>

        {/* Right CTAs */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavBarAuth />
        </div>
      </div>
    </motion.header>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y       = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const opacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section ref={heroRef} style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', background: '#000', paddingTop: 64 }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 65% 40%, rgba(201,168,76,0.08) 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(201,168,76,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.035) 1px,transparent 1px)`, backgroundSize: '88px 88px', pointerEvents: 'none' }} />
      <Particles />

      {/* Subtle logo mark in background — right side */}
      <motion.div aria-hidden style={{ position: 'absolute', right: '4%', top: '50%', translateY: '-50%', opacity: 0.06 }}
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}>
        <LogoMark size={280} opacity={0.06} />
      </motion.div>

      <motion.div style={{ y, opacity, position: 'relative', zIndex: 10, maxWidth: 1400, margin: '0 auto', width: '100%', padding: '0 2.5rem' }}>
        <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          style={{ fontSize: 16, letterSpacing: '0.65em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono), monospace', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ display: 'inline-block', width: 28, height: 1, background: GOLD, opacity: 0.6 }} />
          The Digital Linesheet, Reinvented
        </motion.p>

        <div style={{ overflow: 'hidden', marginBottom: '2.5rem' }}>
          {['Where Luxury', 'Brands Meet', 'Wholesale Buyers'].map((line, i) => (
            <motion.div key={line}
              initial={{ y: 130, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.3 + i * 0.13, ease: [0.22, 1, 0.36, 1] }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 'clamp(3.8rem, 8.5vw, 8.5rem)',
                fontWeight: 400, lineHeight: 0.92, letterSpacing: '-0.02em',
                color: i === 2 ? 'transparent' : 'white',
                backgroundImage: i === 2 ? `linear-gradient(135deg,${GOLD_BRIGHT} 0%,${GOLD} 45%,${GOLD_DIM} 100%)` : undefined,
                WebkitBackgroundClip: i === 2 ? 'text' : undefined,
                backgroundClip: i === 2 ? 'text' : undefined,
                fontStyle: i === 2 ? 'italic' : 'normal',
              }}>
                {line}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.75 }}
          style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 520, marginBottom: '3rem' }}>
          Linezheets replaces static PDF linesheets with a live, buyer-ready digital catalog —
          combining a private showroom, intelligent stock management, and AI-powered merchandising in one platform.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.95 }}
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <GoldButton href="/join" primary>Apply for Access</GoldButton>
          <GoldButton href="/marketplace">Browse Marketplace</GoldButton>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }}
          style={{ marginTop: '5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <motion.div animate={{ scaleY: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 1, height: 40, background: `linear-gradient(to bottom,${GOLD},transparent)` }} />
          <span style={{ fontSize: 15, letterSpacing: '0.45em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono), monospace' }}>
            Scroll to explore
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let s = 0; const step = value / 60;
    const t = setInterval(() => { s += step; if (s >= value) { setN(value); clearInterval(t); } else setN(Math.floor(s)); }, 16);
    return () => clearInterval(t);
  }, [inView, value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

function StatsSection({ brands, categories }: { brands: string[]; categories: string[] }) {
  const stats = [
    { value: brands.length > 0 ? brands.length : 100, suffix: '+', label: 'Designer Brands' },
    { value: categories.length > 0 ? categories.length : 30, suffix: '+', label: 'Categories' },
    { value: 40, suffix: '+', label: 'Countries' },
    { value: 100, suffix: '%', label: 'Verified Buyers' },
  ];
  return (
    <section style={{ background: '#000', borderTop: `1px solid ${GOLD_BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '5rem 2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
          {stats.map(({ value, suffix, label }, i) => (
            <FadeUp key={label} delay={i * 0.1}>
              <div style={{ textAlign: 'center', padding: '2.5rem 2rem', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                <p style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(2.8rem,4.5vw,4.5rem)', fontWeight: 400, color: 'transparent', backgroundImage: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', lineHeight: 1, marginBottom: '0.75rem' }}>
                  <AnimatedNumber value={value} suffix={suffix} />
                </p>
                <p style={{ fontSize: 16, letterSpacing: '0.45em', textTransform: 'uppercase', color: TEXT_MUTED, fontFamily: 'var(--font-mono),monospace' }}>
                  {label}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    { n: '01', title: 'Apply', body: 'Register your business and submit for verification. We accept authorised retailers, boutiques, and multi-brand stores worldwide.' },
    { n: '02', title: 'Get Approved', body: 'Our team reviews your application. Approved buyers receive VIP access to the private showroom and exclusive wholesale pricing.' },
    { n: '03', title: 'Trade', body: 'Browse live digital linesheets, communicate directly with designer houses, place orders, and manage your inventory — all in one place.' },
  ];
  return (
    <section style={{ background: '#050505', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8rem 2.5rem' }}>
        <FadeUp>
          <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace', marginBottom: '4rem' }}>
            How It Works
          </p>
        </FadeUp>

        {/* Arrow-shaped step layout — cards overlap so arrow notches interlock */}
        <div style={{ display: 'flex', alignItems: 'stretch', position: 'relative' }}>
          {steps.map(({ n, title, body }, i) => (
            <HowItWorksArrowCard key={n} n={n} title={title} body={body} index={i} isLast={i === steps.length - 1} delay={i * 0.15} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksArrowCard({ n, title, body, index, isLast, delay }: { n: string; title: string; body: string; index: number; isLast: boolean; delay: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: '-80px' });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [12, -12]), { stiffness: 350, damping: 25 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-12, 12]), { stiffness: 350, damping: 25 });
  const glowX   = useTransform(x, [-0.5, 0.5], [15, 85]);
  const glowY   = useTransform(y, [-0.5, 0.5], [15, 85]);
  const shadowZ = useSpring(0, { stiffness: 300, damping: 25 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
    shadowZ.set(1);
  }, [x, y, shadowZ]);

  const handleMouseLeave = useCallback(() => {
    x.set(0); y.set(0); shadowZ.set(0);
  }, [x, y, shadowZ]);

  const NOTCH = 40; // px — arrow notch depth
  // Each card (except last) points right; each card (except first) has a left indent matching previous notch
  const clipPath = [
    index === 0 ? '0 0' : `${NOTCH}px 0`,
    isLast     ? '100% 0' : `calc(100% - ${NOTCH}px) 0`,
    isLast     ? '100% 50%' : '100% 50%',
    isLast     ? '100% 100%' : `calc(100% - ${NOTCH}px) 100%`,
    index === 0 ? '0 100%' : `${NOTCH}px 100%`,
    index === 0 ? '0 50%'  : `0 50%`,
  ].join(', ');

  const boxShadow = useTransform(shadowZ, [0, 1], [
    '0 4px 24px rgba(0,0,0,0.4)',
    '0 24px 60px rgba(0,0,0,0.7), 0 4px 12px rgba(201,168,76,0.15)',
  ]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        flex: 1,
        position: 'relative',
        zIndex: index,
        marginLeft: index > 0 ? `-${NOTCH}px` : 0,
      }}
    >
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX, rotateY, boxShadow,
          transformStyle: 'preserve-3d',
          clipPath: `polygon(${clipPath})`,
          background: '#080808',
          padding: `4rem calc(3rem + ${isLast ? 0 : NOTCH}px) 4rem calc(3rem + ${index > 0 ? NOTCH : 0}px)`,
          cursor: 'default',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        {/* Mouse-tracking glow */}
        <motion.div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 60% 55% at ${glowX}% ${glowY}%, rgba(201,168,76,0.13) 0%, transparent 70%)`,
        }} />

        {/* Top-left highlight simulating 3D light */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 45%)',
        }} />

        {/* Bottom-right shadow for 3D depth */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(315deg, rgba(0,0,0,0.3) 0%, transparent 50%)',
        }} />

        {/* Gold border line on arrow edge */}
        {!isLast && (
          <div style={{
            position: 'absolute', right: NOTCH, top: 0, bottom: 0, width: 1,
            background: `linear-gradient(to bottom, transparent, ${GOLD_BORDER}, transparent)`,
            pointerEvents: 'none',
          }} />
        )}

        <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 16, color: GOLD_DIM, marginBottom: '2.5rem', letterSpacing: '0.1em', position: 'relative' }}>{n}</p>
        <h3 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: '2.2rem', fontWeight: 400, color: 'white', marginBottom: '1.5rem', lineHeight: 1.1, position: 'relative' }}>{title}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: TEXT_BODY, position: 'relative' }}>{body}</p>
      </motion.div>
    </motion.div>
  );
}

// ─── Abstract 3D Visual Components ───────────────────────────────────────────

function FloatingDocVisual() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          style={{ position: 'absolute', width: 260, background: 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? GOLD_BORDER : BORDER}`, borderRadius: 4, padding: '1.5rem', top: `${i * 28}px`, left: `${i * 20}px`, backdropFilter: 'blur(8px)' }}
          animate={{ y: [0, i % 2 === 0 ? -8 : 8, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}>
          <div style={{ height: 8, width: '60%', background: i === 0 ? GOLD_DIM : 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 12 }} />
          {[80, 55, 70, 45].map((w, j) => (
            <div key={j} style={{ height: 5, width: `${w}%`, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 8 }} />
          ))}
          {i === 0 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <div style={{ height: 24, width: 70, background: `linear-gradient(135deg,${GOLD},${GOLD_DIM})`, borderRadius: 2 }} />
              <div style={{ height: 24, width: 50, border: `1px solid ${GOLD_BORDER}`, borderRadius: 2 }} />
            </div>
          )}
        </motion.div>
      ))}
      {/* Glow */}
      <div aria-hidden style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,rgba(201,168,76,0.08) 0%,transparent 70%)`, pointerEvents: 'none' }} />
    </div>
  );
}

function NetworkVisual() {
  const nodes = [
    { x: 50, y: 50, main: true },
    { x: 20, y: 18 }, { x: 80, y: 18 },
    { x: 10, y: 60 }, { x: 90, y: 60 },
    { x: 30, y: 85 }, { x: 70, y: 85 },
  ];
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6]];
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="320" height="320" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {edges.map(([a, b], i) => (
          <motion.line key={i}
            x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke={GOLD} strokeWidth="0.3" strokeOpacity="0.25"
            strokeDasharray="2 2"
            animate={{ strokeOpacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.circle key={i} cx={n.x} cy={n.y}
            fill={n.main ? GOLD : 'rgba(201,168,76,0.3)'}
            stroke={GOLD} strokeWidth={n.main ? '0.8' : '0.4'} strokeOpacity="0.5"
            initial={{ r: n.main ? 5 : 2.5, opacity: 0.7 }}
            animate={{ r: n.main ? [5, 6.5, 5] : [2.5, 3.2, 2.5], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
          />
        ))}
      </svg>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%,rgba(201,168,76,0.06) 0%,transparent 65%)`, pointerEvents: 'none' }} />
    </div>
  );
}

function ChartVisual() {
  const bars = [65, 82, 54, 91, 73, 88, 60];
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 220 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
        {bars.map((h, i) => (
          <motion.div key={i}
            style={{ width: 28, background: i === 4 ? `linear-gradient(to top,${GOLD},${GOLD_BRIGHT})` : `linear-gradient(to top,rgba(201,168,76,0.25),rgba(201,168,76,0.08))`, borderRadius: '3px 3px 0 0', border: `1px solid ${i === 4 ? GOLD_BORDER : BORDER}` }}
            initial={{ height: 0 }}
            animate={{ height: h * 2 }}
            transition={{ duration: 1.2, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </motion.div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 60%,rgba(201,168,76,0.07) 0%,transparent 65%)`, pointerEvents: 'none' }} />
    </div>
  );
}

function GlobalVisual() {
  const dots = Array.from({ length: 48 }, (_, i) => ({
    x: (i % 8) * 13 + 4,
    y: Math.floor(i / 8) * 13 + 6,
    gold: [3, 11, 17, 22, 30, 36, 43, 47].includes(i),
  }));
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="340" height="280" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {dots.map((d, i) => (
          <motion.circle key={i} cx={d.x} cy={d.y}
            fill={d.gold ? GOLD : 'rgba(255,255,255,0.15)'}
            initial={{ r: d.gold ? 1.8 : 1, opacity: d.gold ? 0.5 : 0.12 }}
            animate={d.gold ? { opacity: [0.5, 1, 0.5], r: [1.8, 2.8, 1.8] } : { opacity: [0.12, 0.25, 0.12] }}
            transition={{ duration: d.gold ? 2 : 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
          />
        ))}
      </svg>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%,rgba(201,168,76,0.07) 0%,transparent 60%)`, pointerEvents: 'none' }} />
    </div>
  );
}

function AIVisual() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fixed dot positions (deterministic — avoids SSR/client float mismatch)
  const DOTS = [0, 60, 120, 180, 240, 300].map(deg => ({
    x: Math.round(Math.cos((deg * Math.PI) / 180) * 100),
    y: Math.round(Math.sin((deg * Math.PI) / 180) * 100),
  }));

  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Central pulsing orb */}
      <motion.div
        style={{ width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle,rgba(201,168,76,0.35) 0%,rgba(201,168,76,0.05) 60%,transparent 100%)`, border: `1px solid ${GOLD_BORDER}`, position: 'absolute' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbiting rings */}
      {[140, 200, 260].map((size, i) => (
        <motion.div key={i}
          style={{ width: size, height: size, borderRadius: '50%', border: `1px solid rgba(201,168,76,${0.12 - i * 0.03})`, position: 'absolute' }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 8 + i * 4, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Orbiting dots — client-only to avoid hydration mismatch */}
      {mounted && DOTS.map((pos, i) => (
        <motion.div key={i}
          style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: GOLD, opacity: 0.6, x: pos.x, y: pos.y }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
        />
      ))}
    </div>
  );
}

function SyncVisual() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem' }}>
      {['Your\nCatalog', 'Shopify\nStore'].map((label, i) => (
        <TiltCard key={i} style={{ width: 120, padding: '1.5rem 1rem', background: 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? GOLD_BORDER : BORDER}`, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? `linear-gradient(135deg,${GOLD},${GOLD_DIM})` : 'rgba(255,255,255,0.1)', margin: '0 auto 0.75rem', border: `1px solid ${GOLD_BORDER}` }} />
          <p style={{ fontSize: 15, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_MUTED, fontFamily: 'var(--font-mono),monospace', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{label}</p>
        </TiltCard>
      ))}
      {/* Arrows */}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: 10, left: '50%', transform: 'translateX(-50%)' }}>
        {[1, -1].map((dir, i) => (
          <motion.div key={i}
            style={{ fontSize: 18, color: GOLD, opacity: 0.7 }}
            animate={{ x: [dir * -4, dir * 4, dir * -4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}>
            {dir > 0 ? '→' : '←'}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function InvoiceVisual() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        style={{ width: 240, background: 'rgba(255,255,255,0.03)', border: `1px solid ${GOLD_BORDER}`, borderRadius: 6, padding: '1.75rem', backdropFilter: 'blur(8px)' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ height: 8, width: 80, background: GOLD_DIM, borderRadius: 2, marginBottom: 6 }} />
            <div style={{ height: 5, width: 50, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
          </div>
          <div style={{ height: 32, width: 32, borderRadius: '50%', border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, color: GOLD }}>✦</span>
          </div>
        </div>
        {[70, 85, 55, 90].map((w, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
            <div style={{ height: 5, width: `${w}%`, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
            <div style={{ height: 5, width: '15%', background: 'rgba(201,168,76,0.2)', borderRadius: 2 }} />
          </div>
        ))}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ height: 28, width: 80, background: `linear-gradient(135deg,${GOLD},${GOLD_DIM})`, borderRadius: 3 }} />
        </div>
      </motion.div>
    </div>
  );
}

// ─── FEATURE CHAPTER — Full-screen scroll section per feature ─────────────────

interface FeatureChapterProps {
  number: string;
  tag: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  reverse?: boolean;
  bg?: string;
}

function FeatureChapter({ number, tag, title, description, visual, reverse = false, bg = '#000' }: FeatureChapterProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });

  return (
    <section ref={ref} style={{ background: bg, borderTop: `1px solid ${BORDER}`, minHeight: '85vh', display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
      {/* Decorative large number */}
      <div aria-hidden style={{
        position: 'absolute', right: reverse ? 'auto' : '3%', left: reverse ? '3%' : 'auto',
        top: '50%', transform: 'translateY(-50%)',
        fontFamily: 'var(--font-serif),Georgia,serif',
        fontSize: 'clamp(12rem,18vw,22rem)', fontWeight: 400, lineHeight: 1,
        color: 'rgba(201,168,76,0.035)', letterSpacing: '-0.04em', pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {number}
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', padding: '6rem 2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>

        {/* Content */}
        <motion.div style={{ order: reverse ? 2 : 1 }}
          initial={{ opacity: 0, x: reverse ? 60 : -60 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
          <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ display: 'inline-block', width: 20, height: 1, background: GOLD, opacity: 0.5 }} />
            {tag}
          </p>
          <h2 style={{
            fontFamily: 'var(--font-serif),Georgia,serif',
            fontSize: 'clamp(2.4rem,4vw,4rem)', fontWeight: 400, lineHeight: 1.08,
            color: 'white', marginBottom: '1.75rem', letterSpacing: '-0.01em',
          }}>
            {title}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 460 }}>
            {description}
          </p>
        </motion.div>

        {/* Visual */}
        <motion.div style={{ order: reverse ? 1 : 2 }}
          initial={{ opacity: 0, x: reverse ? -60 : 60 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          {visual}
        </motion.div>
      </div>
    </section>
  );
}

// ─── FOR BRANDS — Individual feature chapters ─────────────────────────────────

function ForBrandsSection() {
  const chapters: FeatureChapterProps[] = [
    {
      number: '01',
      tag: 'For Brands',
      title: 'Live Digital Linesheets',
      description: 'Replace static PDFs with always-current digital catalogs. Update prices, availability, and lookbooks instantly — no resending files. One link, every buyer, anywhere in the world.',
      visual: <FloatingDocVisual />,
      bg: '#000',
    },
    {
      number: '02',
      tag: 'For Brands',
      title: 'Verified Buyer Network',
      description: 'Every buyer on the platform is verified. Stop chasing leads — connect directly with authorised retailers and boutiques who are genuinely ready to place wholesale orders.',
      visual: <NetworkVisual />,
      reverse: true,
      bg: '#050505',
    },
    {
      number: '03',
      tag: 'For Brands',
      title: 'B2B Global Expansion',
      description: 'Reach wholesale buyers across 40+ countries without hiring a new sales team. Linezheets handles discovery, communication, and order infrastructure — you focus on the collection.',
      visual: <GlobalVisual />,
      bg: '#000',
    },
    {
      number: '04',
      tag: 'For Brands',
      title: 'Sales Analytics & Reports',
      description: 'Track which products move, which buyers repeat, and exactly where your revenue comes from. Daily, monthly, and seasonal breakdowns — all in your brand dashboard.',
      visual: <ChartVisual />,
      reverse: true,
      bg: '#050505',
    },
  ];

  return (
    <>
      {/* Pillar header */}
      <section id="for-brands" style={{ background: '#000', borderTop: `1px solid ${GOLD_BORDER}`, padding: '7rem 2.5rem', scrollMarginTop: '52px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <FadeUp>
            <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '2rem' }}>
              For Brands
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(2.5rem,5vw,5rem)', fontWeight: 400, lineHeight: 0.95, color: 'white', maxWidth: 800, letterSpacing: '-0.02em' }}>
              Say goodbye to PDF linesheets.<br />
              <em style={{ color: GOLD, fontStyle: 'italic' }}>Say hello to buyers who actually buy.</em>
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 520, marginTop: '2rem' }}>
              Your collection deserves more than a static file. Linezheets puts your brand in front of verified wholesale buyers — live, branded, and always up to date.
            </p>
          </FadeUp>
        </div>
      </section>

      {chapters.map(ch => <FeatureChapter key={ch.number} {...ch} />)}
    </>
  );
}

// ─── AI — Individual feature chapters ────────────────────────────────────────

function AISection() {
  const chapters: FeatureChapterProps[] = [
    {
      number: '01',
      tag: 'AI · Intelligence',
      title: 'Brand & Product Matching',
      description: 'AI surfaces the brands and pieces most aligned with your store\'s aesthetic and customer profile — so every recommendation you see is relevant, not random.',
      visual: <AIVisual />,
      bg: '#000',
    },
    {
      number: '02',
      tag: 'AI · Intelligence',
      title: 'Shopify & Multi-Channel Sync',
      description: 'Push products, prices, and stock levels directly to Shopify or any connected store in real time. One inventory — website, physical POS, marketplace, and wholesale portal always in sync.',
      visual: <SyncVisual />,
      reverse: true,
      bg: '#050505',
    },
    {
      number: '03',
      tag: 'AI · Intelligence',
      title: 'AI-Powered Look Lineup',
      description: 'Build and preview full product-line lookbooks before or after purchase, with AI-assisted curation. Generate outfit suggestions and e-styling guides across your selected inventory.',
      visual: <FloatingDocVisual />,
      bg: '#000',
    },
  ];

  return (
    <>
      <section id="ai-intelligence" style={{ background: '#000', borderTop: `1px solid ${GOLD_BORDER}`, padding: '7rem 2.5rem', position: 'relative', overflow: 'hidden', scrollMarginTop: '52px' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 50%,rgba(201,168,76,0.05) 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeUp>
            <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '2rem' }}>
              Pillar II · Intelligence
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(2.5rem,5vw,5rem)', fontWeight: 400, lineHeight: 0.95, color: 'white', maxWidth: 800, letterSpacing: '-0.02em' }}>
              AI-Powered<br />
              <em style={{ color: 'transparent', backgroundImage: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                Merchandising
              </em>
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 520, marginTop: '2rem' }}>
              From first look to final sale — AI that understands fashion, not just data.
            </p>
          </FadeUp>
        </div>
      </section>
      {chapters.map(ch => <FeatureChapter key={ch.number} {...ch} />)}
    </>
  );
}

// ─── OPERATIONS — Individual feature chapters ─────────────────────────────────

function OperationsSection() {
  const chapters: FeatureChapterProps[] = [
    {
      number: '01',
      tag: 'Operations · POS',
      title: 'Point of Sale & Invoicing',
      description: 'Streamlined POS with receipt and invoice generation built for B2B transactions. Professional wholesale invoicing with consignment terms, payment tracking, and full history.',
      visual: <InvoiceVisual />,
      bg: '#050505',
    },
    {
      number: '02',
      tag: 'Operations · Stock',
      title: 'Live Stock Management',
      description: 'Real-time inventory sync with Shopify, any e-commerce store, or physical POS terminal. Automatic low-stock alerts based on sales velocity and minimum order quantities.',
      visual: <ChartVisual />,
      reverse: true,
      bg: '#000',
    },
    {
      number: '03',
      tag: 'Operations · Comms',
      title: 'In-Platform Communications',
      description: 'Email and direct messaging with designer houses built right into the platform. No CC chains, no lost attachments, no inbox switching — everything in one thread.',
      visual: <NetworkVisual />,
      bg: '#050505',
    },
  ];

  return (
    <>
      <section id="operations" style={{ background: '#050505', borderTop: `1px solid ${GOLD_BORDER}`, padding: '7rem 2.5rem', scrollMarginTop: '52px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <FadeUp>
            <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '2rem' }}>
              Pillar I · Operations
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(2.5rem,5vw,5rem)', fontWeight: 400, lineHeight: 0.95, color: 'white', maxWidth: 800, letterSpacing: '-0.02em' }}>
              Intelligent POS &<br />Stock Management
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 520, marginTop: '2rem' }}>
              A complete back-office built for wholesale fashion — from the showroom floor to the stockroom.
            </p>
          </FadeUp>
        </div>
      </section>
      {chapters.map(ch => <FeatureChapter key={ch.number} {...ch} />)}
    </>
  );
}

// ─── FOR BUYERS ───────────────────────────────────────────────────────────────

function ForBuyersSection() {
  const features = [
    { icon: '○', label: 'One Platform, Every Brand',    body: 'All the brands you carry — catalogs, pricing, and availability — in one place. No more inbox hunting.' },
    { icon: '◌', label: 'Easier Order Management',      body: 'Place, track, and manage wholesale orders with payment terms, installments, and invoicing handled automatically.' },
    { icon: '◍', label: 'Smarter Stock Control',        body: 'Live inventory visibility across all your brands. Restock alerts, low-stock warnings, and automatic sync.' },
    { icon: '●', label: 'Direct Brand Communication',   body: 'Message designer houses directly inside the platform. No CC chains, no lost attachments, no chaos.' },
    { icon: '◐', label: 'Finance at a Glance',          body: 'Outstanding payments, installment schedules, and spend history across all brands — visible in one dashboard.' },
    { icon: '◑', label: 'Exclusive Event Access',       body: 'Private showroom events, fashion weeks, and brand previews — managed directly in the platform.' },
  ];

  return (
    <section style={{ background: '#000', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8rem 2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: BORDER }}>
            {features.map(({ icon, label, body }, i) => (
              <FadeUp key={label} delay={i * 0.08}>
                <div style={{ background: '#000', padding: '2.25rem', transition: 'background 0.3s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#090909')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#000')}>
                  <p style={{ fontSize: 22, marginBottom: '1rem', color: GOLD }}>{icon}</p>
                  <p style={{ fontSize: 15, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.60)', marginBottom: '0.75rem', fontFamily: 'var(--font-mono),monospace' }}>{label}</p>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: TEXT_BODY }}>{body}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp>
            <div>
              <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '2rem' }}>
                For Buyers
              </p>
              <h2 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(2.2rem,4vw,3.8rem)', fontWeight: 400, lineHeight: 1.05, color: 'white', marginBottom: '1.75rem', letterSpacing: '-0.01em' }}>
                Say goodbye to inbox chaos.<br />
                <em style={{ color: GOLD, fontStyle: 'italic' }}>Say hello to easier buying.</em>
              </h2>
              <p style={{ fontSize: 17, lineHeight: 1.85, color: TEXT_BODY, maxWidth: 420, marginBottom: '2.5rem' }}>
                Every collection, curated and organised — exactly when you need it. From discovery to order confirmation, without a single email attachment.
              </p>
              <Link href="/join" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: 15, letterSpacing: '0.45em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none', fontFamily: 'var(--font-mono),monospace', borderBottom: `1px solid ${GOLD_BORDER}`, paddingBottom: 2 }}>
                Apply for Buyer Access →
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

// ─── MARQUEE ──────────────────────────────────────────────────────────────────

function MarqueeSection() {
  const quotes = ['One link. Your full collection. Every buyer.', 'Where brands meet buyers — and deals get done.', 'Your collection. Their next order. One platform.', 'The digital linesheet, reinvented.', 'Wholesale fashion, the way it should work.', 'Better brands. Faster decisions. Easier buying.'];
  const doubled = [...quotes, ...quotes];
  return (
    <section style={{ background: '#000', borderTop: `1px solid ${GOLD_BORDER}`, borderBottom: `1px solid ${GOLD_BORDER}`, overflow: 'hidden', padding: '1.75rem 0' }}>
      <motion.div style={{ display: 'flex', gap: '4rem', whiteSpace: 'nowrap' }}
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}>
        {doubled.map((q, i) => (
          <span key={i} style={{ fontSize: 15, letterSpacing: '0.45em', textTransform: 'uppercase', color: i % 3 === 1 ? GOLD : 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-mono),monospace', flexShrink: 0 }}>
            {q}<span style={{ margin: '0 2rem', color: 'rgba(201,168,76,0.25)' }}>·</span>
          </span>
        ))}
      </motion.div>
    </section>
  );
}

// ─── MARKETPLACE TEASER ───────────────────────────────────────────────────────

function MarketplaceTeaser({ items, brands }: { items: CatalogItem[]; brands: string[] }) {
  return (
    <section style={{ background: '#050505', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8rem 2.5rem' }}>
        <FadeUp>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '4rem', paddingBottom: '2rem', borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <p style={{ fontSize: 16, letterSpacing: '0.55em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace', marginBottom: '0.75rem' }}>The Marketplace</p>
              <h2 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 400, color: 'white' }}>
                {brands.length > 0 ? `${brands.length} Brands · Curated Collections` : 'Curated Wholesale Brands'}
              </h2>
            </div>
            <Link href="/login" style={{ fontSize: 16, letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none', fontFamily: 'var(--font-mono),monospace', borderBottom: `1px solid ${GOLD_BORDER}`, paddingBottom: 2 }}>
              Sign In to Browse →
            </Link>
          </div>
        </FadeUp>

        {brands.length > 0 && (
          <FadeUp delay={0.1}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '4rem' }}>
              {brands.map(b => (
                <Link key={b} href="/login" style={{ fontSize: 16, letterSpacing: '0.3em', textTransform: 'uppercase', padding: '0.5rem 1rem', border: `1px solid ${BORDER}`, color: TEXT_MUTED, textDecoration: 'none', fontFamily: 'var(--font-mono),monospace', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}>
                  {b}
                </Link>
              ))}
            </div>
          </FadeUp>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: BORDER, position: 'relative' }}>
          {(items.length > 0 ? items.slice(0, 8) : Array.from({ length: 8 })).map((item, i) => (
            <FadeUp key={i} delay={i * 0.06}>
              <Link href="/login" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ position: 'relative', aspectRatio: '2/3', background: '#0a0a0a', overflow: 'hidden' }}>
                  {item && safeStr((item as CatalogItem).image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safeStr((item as CatalogItem).image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(4px) grayscale(1)', transform: 'scale(1.05)' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LogoMark size={44} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: 22, color: 'rgba(201,168,76,0.45)' }}>⊕</span>
                    <span style={{ fontSize: 15, letterSpacing: '0.3em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace' }}>Login to view</span>
                  </div>
                </div>
              </Link>
            </FadeUp>
          ))}
          <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 140, background: `linear-gradient(to top,#050505,transparent)`, pointerEvents: 'none' }} />
        </div>

        <div style={{ marginTop: '3.5rem', display: 'flex', justifyContent: 'center' }}>
          <GoldButton href="/join" primary>Apply for Wholesale Access</GoldButton>
        </div>
      </div>
    </section>
  );
}

// ─── CTA SPLIT ────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section style={{ background: '#000', borderTop: `1px solid ${GOLD_BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {[
          { tag: 'For Brands', headline: 'Stop chasing buyers\nwith email attachments.', body: 'Start closing wholesale with a platform built for how fashion actually moves.', cta: 'List Your Brand', href: '/join', primary: true },
          { tag: 'For Buyers', headline: "Your next season's buys —\ncurated and ready to order.", body: 'No more chasing brands for updated PDFs. One platform for every brand you carry.', cta: 'Apply for Buyer Access', href: '/join', primary: false },
        ].map(({ tag, headline, body, cta, href, primary }, i) => (
          <FadeUp key={tag} delay={i * 0.15}>
            <div style={{ padding: '6rem 4rem', borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 60% at ${i === 0 ? '0%' : '100%'} 50%,rgba(201,168,76,0.04) 0%,transparent 70%)`, pointerEvents: 'none' }} />
              <p style={{ fontSize: 16, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: 'var(--font-mono),monospace', marginBottom: '1.75rem' }}>{tag}</p>
              <h3 style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 'clamp(1.6rem,2.8vw,2.5rem)', fontWeight: 400, lineHeight: 1.1, color: 'white', marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>{headline}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.85, color: TEXT_BODY, marginBottom: '2.5rem' }}>{body}</p>
              <GoldButton href={href} primary={primary}>{cta}</GoldButton>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function FuturisticFooter() {
  const cols = [
    { heading: 'Platform', links: [{ label: 'Marketplace', href: '/marketplace' }, { label: 'Fashion Events', href: '/fashionevents' }, { label: 'Dashboard', href: '/dashboard' }] },
    { heading: 'Company',  links: [{ label: 'About', href: '/about' }, { label: 'Pricing', href: '/pricing' }, { label: 'Contact', href: '/contact' }] },
    { heading: 'Access',   links: [{ label: 'Apply for Access', href: '/join' }, { label: 'Sign In', href: '/login' }, { label: 'Terms & Privacy', href: '/terms' }, { label: 'Legal', href: '/legal' }] },
  ];
  return (
    <footer style={{ background: '#000', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '5rem 2.5rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '3rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <LogoMark size={34} />
            <div>
              <p style={{ fontFamily: 'var(--font-serif),Georgia,serif', fontSize: 15, letterSpacing: '0.5em', color: 'white', fontWeight: 400 }}>LINEZHEETS</p>
              <p style={{ fontSize: 7, letterSpacing: '0.35em', textTransform: 'uppercase', color: GOLD_DIM, fontFamily: 'var(--font-mono),monospace', marginTop: 2 }}>B2B Fashion Platform</p>
            </div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.85, color: TEXT_MUTED, maxWidth: 280 }}>
            The digital linesheet platform for luxury wholesale — connecting fashion brands with verified retail buyers worldwide.
          </p>
        </div>
        {cols.map(({ heading, links }) => (
          <div key={heading}>
            <p style={{ fontSize: 16, letterSpacing: '0.45em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace', marginBottom: '1.5rem' }}>{heading}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {links.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} style={{ fontSize: 15, color: TEXT_MUTED, textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.75rem 2.5rem', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace' }}>
          © {new Date().getFullYear()} Linezheets · All rights reserved
        </p>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {[{ label: 'Legal', href: '/legal' }, { label: 'Contact', href: '/contact' }].map(({ label, href }) => (
            <Link key={label} href={href} style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: TEXT_DIM, textDecoration: 'none', fontFamily: 'var(--font-mono),monospace', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = TEXT_MUTED)}
              onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
              {label}
            </Link>
          ))}
          <p style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: TEXT_DIM, fontFamily: 'var(--font-mono),monospace' }}>
            Powered by <span style={{ color: GOLD }}>Linezheets</span>
          </p>
        </div>
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem 2.5rem' }}>
        <p style={{ fontSize: 15, lineHeight: 2, color: 'rgba(255,255,255,0.07)', maxWidth: '60ch' }}>
          Linezheets is a B2B wholesale fashion platform that replaces traditional linesheets and PDF line sheets with live digital catalogs. Fashion brands use Linezheets to share collections with wholesale buyers, manage B2B orders, sync inventory, and grow their retail network globally.
        </p>
      </div>
    </footer>
  );
}

// ─── ROOT EXPORT ──────────────────────────────────────────────────────────────

export default function LandingClient({ items, brands, categories, showcase }: Props) {
  return (
    <div style={{ background: '#000', color: 'white', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <Grain />
      <HeroSection />
      <StatsSection brands={brands} categories={categories} />
      <HowItWorksSection />
      <ForBrandsSection />
      <AISection />
      <OperationsSection />
      <ForBuyersSection />
      <DeviceShowcaseScroll data={showcase ?? emptyShowcaseData} />
      <MarqueeSection />
      <MarketplaceTeaser items={items} brands={brands} />
      <CTASection />
      <FuturisticFooter />
    </div>
  );
}
