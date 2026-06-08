'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const HOW_IT_WORKS = [
  { n: '01', title: 'Apply for access',    desc: 'Submit your buyer application. We verify your retail credentials — boutique, department store, or online retailer — within 48 hours.' },
  { n: '02', title: 'Get approved',         desc: 'Once approved you receive a VIP buyer badge and immediate access to the full private showroom catalogue.' },
  { n: '03', title: 'Browse & discover',   desc: 'Filter by category, season, price tier, and delivery window. Save brands, shortlist products, and build your buying plan.' },
  { n: '04', title: 'Place wholesale orders',desc: 'Order directly through the platform at wholesale prices. NET terms, installment plans, and multi-currency checkout are all supported.' },
  { n: '05', title: 'Track & reorder',      desc: 'Your dashboard shows every order, shipment, and invoice in one place. Reorder top performers with a single click.' },
];

const BUYER_TYPES = [
  { title: 'Luxury Boutiques',       desc: 'Independent boutiques and multi-door concept stores looking for exclusive, curated wholesale access.' },
  { title: 'Department Stores',      desc: 'Buying teams at department store chains who need to move fast and want consolidated brand management.' },
  { title: 'Online Retailers',       desc: 'DTC and marketplace-driven retailers who need digital linesheets and API-connected inventory feeds.' },
  { title: 'Rental & Styling Platforms', desc: 'Fashion rental and personal styling services who source editorial looks directly from brands.' },
];

const BUYER_BENEFITS = [
  'Access hundreds of verified luxury and contemporary brands',
  'Always-current digital linesheets — no more waiting for PDFs',
  'Place orders in your local currency with NET terms',
  'Direct messaging with brand sales contacts',
  'Early access to pre-season collections and exclusives',
  'Unified dashboard — every brand, order, and invoice in one place',
  'AI-powered brand matching based on your buying history',
];

export default function MarketplaceBuyersPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/marketplace" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← Marketplace
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 2.5rem' }}>

        {/* Hero */}
        <div style={{ marginBottom: '5rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            For Buyers
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'white', marginBottom: '1.25rem', lineHeight: 1.05 }}>
            The private showroom<br />for serious buyers.
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 560, lineHeight: 1.8, marginBottom: '2.5rem' }}>
            Linezheets is an invitation-only marketplace where verified retail buyers access hundreds of luxury and contemporary brands — without the trade show flights or the PDF inbox.
          </p>
          <Link href="/join" style={{
            display: 'inline-block', padding: '0.9rem 2.25rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Apply as a Buyer
          </Link>
        </div>

        {/* Who can join */}
        <div style={{ marginBottom: '5rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Who Can Join
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
            {BUYER_TYPES.map(({ title, desc }) => (
              <div key={title} style={{ background: '#000', padding: '2rem' }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>{title}</p>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', marginBottom: '5rem' }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
              Buyer Benefits
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {BUYER_BENEFITS.map(b => (
                <div key={b} style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ color: GOLD, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
              How It Works
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {HOW_IT_WORKS.map(({ n, title, desc }) => (
                <div key={n} style={{ display: 'flex', gap: '1.25rem' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: GOLD, flexShrink: 0, marginTop: 2, letterSpacing: '0.2em' }}>{n}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 3 }}>{title}</p>
                    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: '3rem', border: `1px solid rgba(201,168,76,0.2)`, background: 'rgba(201,168,76,0.03)', textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 400, color: 'white', marginBottom: '0.75rem' }}>
            Ready to access the showroom?
          </p>
          <p style={{ fontSize: 16, color: MUTED, marginBottom: '2rem' }}>
            Applications take less than 5 minutes. We approve qualified buyers within 48 hours.
          </p>
          <Link href="/join" style={{
            display: 'inline-block', padding: '0.9rem 2.5rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Apply for Buyer Access
          </Link>
        </div>
      </div>
    </div>
  );
}
