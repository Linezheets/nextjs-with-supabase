'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const PLATFORMS = [
  {
    name: 'Shopify',
    status: 'Live',
    tagline: 'One inventory. Every channel.',
    desc: 'Connect your Shopify store and Linezheets stay in perfect sync — products, variants, prices, and stock levels flow both ways in real time. Changes made in your Linezheets dashboard appear on your Shopify storefront within seconds.',
    features: [
      'Bi-directional product sync (create, update, archive)',
      'Variant-level inventory synchronisation',
      'Wholesale pricing tiers mapped to Shopify price lists',
      'Order push — wholesale orders placed via Linezheets appear in Shopify',
      'Metafield support for custom product attributes',
      'Webhook-based — no polling, near-instant updates',
    ],
    setup: 'Connect in 3 clicks from Settings → Integrations → Shopify. Authorise the OAuth app and select the product collections to sync.',
  },
  {
    name: 'WooCommerce',
    status: 'Live',
    tagline: 'WordPress wholesale, done right.',
    desc: 'Install the Linezheets WooCommerce plugin and your WordPress store becomes a live mirror of your wholesale catalogue. Manage everything from Linezheets — prices, stock, and descriptions — and watch them propagate to your site automatically.',
    features: [
      'REST API-based bi-directional sync',
      'Supports variable products and product bundles',
      'Automatic category mapping between Linezheets and WooCommerce',
      'Order ingestion — WooCommerce B2C orders appear alongside B2B wholesale orders',
      'Support for WooCommerce Subscriptions and Wholesale Suite plugins',
      'Scheduled full-sync fallback for data integrity',
    ],
    setup: 'Download the Linezheets plugin from your dashboard, upload it to WordPress, and enter your API key. Full sync completes in under 5 minutes for most catalogues.',
  },
];

function StatusBadge({ status }: { status: string }) {
  const bg = status === 'Live' ? 'rgba(45,122,79,0.15)' : status === 'Beta' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.06)';
  const color = status === 'Live' ? '#4caf82' : status === 'Beta' ? GOLD : 'rgba(255,255,255,0.35)';
  return (
    <span style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: MONO, padding: '3px 10px', background: bg, color }}>
      {status}
    </span>
  );
}

export default function EcommerceIntegrationsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/integrations" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← All Integrations
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 2.5rem' }}>
        <div style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            Ecommerce Integrations
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4.5vw,3.75rem)', fontWeight: 400, color: 'white', marginBottom: '1rem', lineHeight: 1.05 }}>
            Your storefront,<br />always in sync.
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 540, lineHeight: 1.75 }}>
            Connect Linezheets to your existing ecommerce store and manage wholesale and retail inventory from a single source of truth.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
          {PLATFORMS.map(({ name, status, tagline, desc, features, setup }) => (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '4rem', paddingBottom: '4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 400, color: 'white' }}>{name}</h2>
                  <StatusBadge status={status} />
                </div>
                <p style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1rem' }}>{tagline}</p>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.75 }}>{desc}</p>

                <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: MONO, marginBottom: '0.75rem' }}>Setup</p>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{setup}</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: MONO, marginBottom: '1.25rem' }}>
                  What syncs
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.08)' }}>
                      <span style={{ color: GOLD, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '4rem', textAlign: 'center' }}>
          <Link href="/join" style={{
            display: 'inline-block', padding: '0.9rem 2.25rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Connect Your Store
          </Link>
        </div>
      </div>
    </div>
  );
}
