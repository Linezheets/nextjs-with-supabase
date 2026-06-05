'use client';
import Link from 'next/link';
const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';

const INTEGRATIONS = [
  { name: 'Shopify', icon: '🛍', desc: 'Sync your entire product catalogue, prices, and inventory in real time.', status: 'Live' },
  { name: 'WooCommerce', icon: '🛒', desc: 'Connect your WooCommerce store for automatic two-way product sync.', status: 'Live' },
  { name: 'Stripe', icon: '💳', desc: 'Accept wholesale payments with NET 30/60/90 terms and installment plans.', status: 'Live' },
  { name: 'QuickBooks', icon: '📊', desc: 'Push invoices and orders directly into your accounting software.', status: 'Live' },
  { name: 'Xero', icon: '📋', desc: 'Sync financial data, invoices, and payment records automatically.', status: 'Coming Soon' },
  { name: 'NuOrder', icon: '📦', desc: 'Import your existing NuOrder product catalogue and buyer relationships.', status: 'Coming Soon' },
  { name: 'Joor', icon: '🔗', desc: 'Migrate from Joor with full data portability for products and orders.', status: 'Coming Soon' },
  { name: 'Faire', icon: '🏪', desc: 'Cross-list your products on Faire while managing orders in Linezheets.', status: 'Beta' },
  { name: 'Mailchimp', icon: '✉️', desc: 'Sync buyer contacts and automate wholesale email campaigns.', status: 'Live' },
];

export default function IntegrationsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: SANS, paddingTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '5rem 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.5rem' }}>Integrations</p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4.5rem)', fontWeight: 400, color: 'white', marginBottom: '1.5rem', lineHeight: 1 }}>
            Connect your tools
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto' }}>
            Linezheets plugs into the platforms you already use — no migration headaches.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.07)' }}>
          {INTEGRATIONS.map(({ name, icon, desc, status }) => (
            <div key={name} style={{ background: '#000', padding: '2.5rem', transition: 'background 0.2s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0a0a0a')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#000')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <span style={{
                  fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: MONO,
                  padding: '3px 10px',
                  background: status === 'Live' ? 'rgba(45,122,79,0.15)' : status === 'Beta' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.06)',
                  color: status === 'Live' ? '#4caf82' : status === 'Beta' ? GOLD : 'rgba(255,255,255,0.35)',
                }}>{status}</span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'white', marginBottom: '0.75rem' }}>{name}</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '4rem', textAlign: 'center', padding: '3rem', border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
          <p style={{ fontFamily: SERIF, fontSize: '1.8rem', fontWeight: 400, color: 'white', marginBottom: '1rem' }}>Need a custom integration?</p>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginBottom: '2rem' }}>Our API is open — connect any platform your team uses.</p>
          <Link href="/contact" style={{ display: 'inline-block', padding: '0.9rem 2.5rem', background: `linear-gradient(135deg,${GOLD},#8a6f2e)`, color: '#000', textDecoration: 'none', fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase', fontFamily: MONO, fontWeight: 600 }}>
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
