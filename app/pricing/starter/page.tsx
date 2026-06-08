'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const FEATURES = [
  { title: 'Up to 50 products',         desc: 'List your hero SKUs and build a curated digital linesheet immediately.' },
  { title: 'Basic digital linesheet',   desc: 'A clean, shareable URL — no PDF, no attachments, always current.' },
  { title: '5 buyer connections',        desc: 'Connect with up to five verified wholesale buyers from our network.' },
  { title: 'Order management',           desc: 'Receive, review, and confirm orders through a simple dashboard.' },
  { title: 'Email support',              desc: 'Our team responds within 48 hours to help you get set up.' },
];

const LIMITS = [
  { label: 'Products',        value: '50' },
  { label: 'Buyer connections', value: '5' },
  { label: 'Linesheets',       value: '1' },
  { label: 'Team members',     value: '1' },
  { label: 'Analytics',        value: 'Basic' },
  { label: 'API access',       value: 'No' },
  { label: 'Shopify sync',     value: 'No' },
];

export default function StarterPricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      {/* Back nav */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/pricing" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.2s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← All Plans
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 2.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            Starter Plan
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'white', marginBottom: '1rem', lineHeight: 1.05 }}>
            Start free.<br />No credit card.
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 520, lineHeight: 1.75 }}>
            Built for emerging brands taking their first steps into wholesale. Publish your first linesheet today and start connecting with verified buyers.
          </p>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: SERIF, fontSize: '4rem', fontWeight: 400, color: 'white', lineHeight: 1 }}>Free</span>
            <span style={{ fontSize: 15, color: MUTED }}>forever</span>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/join" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
              color: '#000', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO, fontWeight: 600,
            }}>
              Get Started Free
            </Link>
            <Link href="/pricing" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO,
            }}>
              Compare Plans
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>

          {/* Features */}
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
              What&apos;s Included
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {FEATURES.map(({ title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ color: GOLD, flexShrink: 0, fontSize: 16, marginTop: 2 }}>✓</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{title}</p>
                    <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Limits table */}
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
              Plan Limits
            </p>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {LIMITS.map(({ label, value }, i) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.25rem',
                  borderBottom: i < LIMITS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{ fontSize: 14, color: MUTED }}>{label}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: MONO }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Upgrade nudge */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(201,168,76,0.05)', border: `1px solid rgba(201,168,76,0.18)` }}>
              <p style={{ fontSize: 14, color: MUTED, marginBottom: '1rem', lineHeight: 1.65 }}>
                Ready to scale? Upgrade to the Brand Plan for unlimited products, AI merchandising, and Shopify sync.
              </p>
              <Link href="/pricing/brand" style={{
                fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase',
                color: GOLD, textDecoration: 'none', fontFamily: MONO,
              }}>
                View Brand Plan →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
