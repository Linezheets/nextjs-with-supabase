'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const FEATURES = [
  { title: 'Unlimited products',         desc: 'No cap on SKUs — list your full catalogue with variants, pricing tiers, and rich imagery.' },
  { title: 'Live digital linesheets',    desc: 'Always-current shareable URLs. Update once, buyers see it instantly.' },
  { title: 'Unlimited buyer connections',desc: 'Connect and transact with as many verified wholesale buyers as your business demands.' },
  { title: 'AI merchandising tools',     desc: 'Brand matching, look lineup generation, and AI-drafted product descriptions at scale.' },
  { title: 'Analytics & reports',        desc: 'View engagement, buyer activity, top SKUs, and revenue breakdowns in a live dashboard.' },
  { title: 'Shopify sync',               desc: 'Push products, prices, and stock levels to Shopify in real time. One inventory, everywhere.' },
  { title: 'Priority support',           desc: '4-hour response SLA via email and live chat. A dedicated onboarding session on signup.' },
];

const COMPARISON = [
  { label: 'Products',          starter: '50',    brand: 'Unlimited' },
  { label: 'Buyer connections', starter: '5',     brand: 'Unlimited' },
  { label: 'Linesheets',        starter: '1',     brand: 'Unlimited' },
  { label: 'Team members',      starter: '1',     brand: '5' },
  { label: 'Analytics',         starter: 'Basic', brand: 'Full + export' },
  { label: 'Shopify sync',      starter: 'No',    brand: 'Yes' },
  { label: 'AI tools',          starter: 'No',    brand: 'Yes' },
  { label: 'API access',        starter: 'No',    brand: 'Read-only' },
  { label: 'Priority support',  starter: 'No',    brand: 'Yes' },
];

export default function BrandPricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      {/* Back nav */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/pricing" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← All Plans
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 2.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'inline-block', background: GOLD, color: '#000', fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', padding: '4px 16px', fontFamily: MONO, fontWeight: 600, marginBottom: '1.5rem' }}>
            Most Popular
          </div>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            Brand Plan
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'white', marginBottom: '1rem', lineHeight: 1.05 }}>
            Scale your wholesale<br />operation globally.
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 540, lineHeight: 1.75 }}>
            Everything growing brands need — unlimited products, AI merchandising, Shopify sync, and a live analytics dashboard that shows exactly what buyers are looking at.
          </p>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: SERIF, fontSize: '4rem', fontWeight: 400, color: 'white', lineHeight: 1 }}>$149</span>
            <span style={{ fontSize: 15, color: MUTED }}> / month</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: '0.5rem', fontFamily: MONO }}>
            $1,490 / year — save 2 months
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/join" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
              color: '#000', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO, fontWeight: 600,
            }}>
              Apply for Access
            </Link>
            <Link href="/pricing/enterprise" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO,
            }}>
              Need More? → Enterprise
            </Link>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: '5rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Everything Included
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {FEATURES.map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(201,168,76,0.03)' }}>
                <span style={{ color: GOLD, flexShrink: 0, fontSize: 16, marginTop: 2 }}>✓</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{title}</p>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Starter vs Brand comparison */}
        <div>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Starter vs. Brand
          </p>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>Feature</span>
              <span style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>Starter</span>
              <span style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO }}>Brand</span>
            </div>
            {COMPARISON.map(({ label, starter, brand }, i) => (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '0.9rem 1.25rem',
                borderBottom: i < COMPARISON.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 14, color: MUTED }}>{label}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>{starter}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', fontFamily: MONO }}>{brand}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
