'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { NavBarAuth } from '@/components/NavBarAuth';
import { LogoMark } from '@/components/LogoMark';

const GOLD        = '#c9a84c';
const GOLD_BRIGHT = '#e8c56b';
const GOLD_DIM    = '#7a6428';
const TEXT_MUTED  = 'rgba(255,255,255,0.50)';
const BORDER      = 'rgba(255,255,255,0.07)';
const GOLD_BORDER = 'rgba(201,168,76,0.18)';

// ── Dropdown data ─────────────────────────────────────────────────────────────

const SOLUTIONS = [
  { icon: '◈', title: 'Live Digital Linesheets',   desc: 'Replace PDFs with always-current digital catalogs. One link, every buyer.',      href: '/#for-brands',                    tag: 'For Brands' },
  { icon: '◉', title: 'Verified Buyer Network',     desc: 'Connect with authorised retailers and boutiques who are ready to order.',         href: '/marketplace',                    tag: 'Marketplace' },
  { icon: '✦', title: 'AI-Powered Merchandising',  desc: 'Brand matching, e-styling, look lineup and AI-generated storefronts.',           href: '/#ai-intelligence',               tag: 'AI Studio' },
  { icon: '◆', title: 'Intelligent POS & Stock',   desc: 'Point of sale, invoicing, restock alerts, and live inventory sync.',             href: '/#operations',                    tag: 'Operations' },
  { icon: '◎', title: 'B2C Store Builder',          desc: 'Generate a buyer-ready e-commerce storefront from your wholesale catalogue.',    href: '/dashboard/brand-store/editor',   tag: 'Store Builder' },
  { icon: '○', title: 'Fashion Events',             desc: 'Exclusive showroom events, fashion weeks, and private brand previews.',          href: '/fashionevents',                  tag: 'Events' },
];

const PRICING_ITEMS = [
  { label: 'Compare Plans',  desc: 'See all tiers side by side',           href: '/pricing' },
  { label: 'Starter',        desc: 'Free — up to 50 products',             href: '/pricing/starter' },
  { label: 'Brand Plan',     desc: '$149 / mo — scale wholesale globally', href: '/pricing/brand' },
  { label: 'Enterprise',     desc: 'Custom — multi-brand & agency',        href: '/pricing/enterprise' },
  { label: 'Pricing FAQ',    desc: 'Common questions answered',            href: '/pricing/faq' },
];

const INTEGRATIONS_ITEMS = [
  { label: 'All Integrations', desc: 'Full list of connected platforms',    href: '/integrations' },
  { label: 'Ecommerce',        desc: 'Shopify & WooCommerce sync',          href: '/integrations/ecommerce' },
  { label: 'Payments',         desc: 'Stripe, NET terms & installments',    href: '/integrations/payments' },
  { label: 'Accounting',       desc: 'QuickBooks, Xero & invoicing',        href: '/integrations/accounting' },
  { label: 'API & Webhooks',   desc: 'Build custom connections via our API',href: '/integrations/api' },
];

const MARKETPLACE_ITEMS = [
  { label: 'Browse Brands',        desc: 'Discover vetted luxury brands',        href: '/marketplace' },
  { label: 'For Buyers',           desc: 'How the marketplace works for buyers', href: '/marketplace/buyers' },
  { label: 'Featured Collections', desc: 'Curated picks this season',            href: '/marketplace/featured' },
  { label: 'Fashion Events',       desc: 'Showrooms, fashion weeks & previews',  href: '/fashionevents' },
];

// ── Simple dropdown ────────────────────────────────────────────────────────────

function NavDropdown({ label, items, navLinkStyle }: {
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
        onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}
      >
        {label}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-block', fontSize: 13, opacity: 0.55, lineHeight: 1 }}
        >▾</motion.span>
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
              width: 280, background: '#0a0a0a',
              border: `1px solid ${GOLD_BORDER}`,
              backdropFilter: 'blur(28px)',
              boxShadow: `0 20px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,168,76,0.06)`,
              padding: '0.5rem 0',
              zIndex: 1001,
            }}
            onMouseEnter={open_}
            onMouseLeave={close_}
          >
            {items.map(({ label: itemLabel, desc, href }) => (
              <Link
                key={href} href={href}
                style={{ display: 'block', padding: '0.85rem 1.25rem', textDecoration: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--font-mono),monospace', marginBottom: 3, fontWeight: 500 }}>{itemLabel}</p>
                <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5, fontFamily: 'var(--font-mono),monospace' }}>{desc}</p>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main navbar ────────────────────────────────────────────────────────────────

export function SiteNavbar() {
  const [scrolled,      setScrolled]      = useState(false);
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
    fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase',
    color: TEXT_MUTED, textDecoration: 'none',
    fontFamily: 'var(--font-mono), monospace', transition: 'color 0.2s',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: '#000',
        borderBottom: `1px solid ${scrolled ? GOLD_BORDER : 'rgba(255,255,255,0.06)'}`,
        transition: 'border-color 0.4s ease',
      }}
    >
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem',
        height: 64, display: 'flex', alignItems: 'center', gap: '2rem',
      }}>

        {/* Logo */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', textDecoration: 'none', flexShrink: 0 }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; (el.querySelector('.logo-wordmark') as HTMLElement | null)?.style && ((el.querySelector('.logo-wordmark') as HTMLElement).style.color = GOLD); }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; (el.querySelector('.logo-wordmark') as HTMLElement | null)?.style && ((el.querySelector('.logo-wordmark') as HTMLElement).style.color = '#fff'); }}
        >
          <LogoMark size={40} />
          <span className="logo-wordmark" style={{ fontSize: 13, letterSpacing: '0.5em', fontFamily: 'var(--font-serif), Georgia, serif', color: '#fff', fontWeight: 400, textTransform: 'uppercase', transition: 'color 0.2s' }}>
            Linezheets
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', marginLeft: '0.5rem' }}>

          {/* Solutions mega-menu */}
          <div style={{ position: 'relative' }} onMouseEnter={openSolutions} onMouseLeave={closeSolutions}>
            <button
              style={{ ...navLinkStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
              onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}
            >
              Solutions
              <motion.span
                animate={{ rotate: solutionsOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'inline-block', fontSize: 13, opacity: 0.6 }}
              >▾</motion.span>
            </button>

            <AnimatePresence>
              {solutionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 16px)', left: '-1rem',
                    width: 620, background: '#0a0a0a',
                    border: `1px solid ${GOLD_BORDER}`,
                    backdropFilter: 'blur(30px)',
                    boxShadow: `0 24px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,168,76,0.08)`,
                    padding: '1.5rem', zIndex: 1001,
                  }}
                  onMouseEnter={openSolutions}
                  onMouseLeave={closeSolutions}
                >
                  <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 10, letterSpacing: '0.55em', textTransform: 'uppercase', color: GOLD }}>Platform Solutions</p>
                    <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>Everything you need to run wholesale fashion, end to end.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: BORDER }}>
                    {SOLUTIONS.map(({ icon, title, desc, href, tag }) => (
                      <Link
                        key={title} href={href}
                        onClick={() => setSolutionsOpen(false)}
                        style={{ display: 'block', padding: '0.9rem 1.1rem', background: '#0a0a0a', textDecoration: 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0a0a0a'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                          <span style={{ fontSize: 16, color: GOLD, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                              <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>{title}</p>
                              <span style={{ fontSize: 8, letterSpacing: '0.25em', textTransform: 'uppercase', color: GOLD_DIM, fontFamily: 'var(--font-mono),monospace', border: `1px solid rgba(201,168,76,0.2)`, padding: '1px 5px' }}>{tag}</span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 10, lineHeight: 1.6, color: TEXT_MUTED }}>{desc}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '1.1rem', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: 'var(--font-mono),monospace', fontSize: 11, color: TEXT_MUTED }}>Ready to transform your wholesale business?</p>
                    <Link href="/join" style={{
                      fontFamily: 'var(--font-mono),monospace', fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase',
                      color: '#000', background: `linear-gradient(135deg,${GOLD_BRIGHT},${GOLD})`,
                      padding: '0.55rem 1.1rem', textDecoration: 'none', fontWeight: 700,
                    }}>
                      Apply for Access
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <NavDropdown label="Pricing"      items={PRICING_ITEMS}      navLinkStyle={navLinkStyle} />
          <NavDropdown label="Integrations" items={INTEGRATIONS_ITEMS} navLinkStyle={navLinkStyle} />
          <NavDropdown label="Marketplace"  items={MARKETPLACE_ITEMS}  navLinkStyle={navLinkStyle} />
        </nav>

        {/* Right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavBarAuth />
        </div>
      </div>
    </motion.header>
  );
}
