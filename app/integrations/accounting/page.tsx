'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const PLATFORMS = [
  {
    name: 'QuickBooks',
    status: 'Live',
    desc: 'Every wholesale order placed on Linezheets flows directly into QuickBooks as a sales invoice. Payments, credits, and refunds reconcile automatically — no manual data entry.',
    features: [
      'Auto-create QuickBooks invoices on order confirmation',
      'Payment matching — Stripe payments reconcile against QB invoices',
      'Customer sync — buyer profiles mirror QB contacts',
      'Product / item mapping with custom account codes',
      'Credit note creation on order cancellation or return',
      'Supports QuickBooks Online (all regions)',
    ],
  },
  {
    name: 'Xero',
    status: 'Coming Soon',
    desc: 'The Xero integration is in private beta. It will offer the same full invoice and payment reconciliation as QuickBooks, with support for Xero\'s tracking categories and multi-currency accounts.',
    features: [
      'Invoice creation and payment reconciliation',
      'Xero tracking categories mapped to Linezheets brand/season tags',
      'Multi-currency invoice support',
      'Contact and product sync',
      'Bank feed reconciliation via Xero\'s bank import',
      'Estimated availability: Q3 2026',
    ],
  },
];

const WORKFLOW_STEPS = [
  { n: '01', title: 'Order placed',      desc: 'A buyer submits a wholesale order through Linezheets.' },
  { n: '02', title: 'Invoice created',   desc: 'Linezheets instantly creates a matching invoice in your accounting platform.' },
  { n: '03', title: 'Payment received',  desc: 'Stripe processes the payment and marks the invoice as paid.' },
  { n: '04', title: 'Accounts updated',  desc: 'Your balance sheet and P&L update in real time — no manual steps.' },
];

function StatusBadge({ status }: { status: string }) {
  const bg = status === 'Live' ? 'rgba(45,122,79,0.15)' : 'rgba(255,255,255,0.06)';
  const color = status === 'Live' ? '#4caf82' : 'rgba(255,255,255,0.35)';
  return (
    <span style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: MONO, padding: '3px 10px', background: bg, color }}>
      {status}
    </span>
  );
}

export default function AccountingIntegrationsPage() {
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
            Accounting Integrations
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4.5vw,3.75rem)', fontWeight: 400, color: 'white', marginBottom: '1.25rem', lineHeight: 1.05 }}>
            Your books update<br />themselves.
          </h1>
          <p style={{ fontSize: 17, color: MUTED, maxWidth: 540, lineHeight: 1.75 }}>
            Connect your accounting software and every order, payment, and credit note flows in automatically. Close the month without a spreadsheet in sight.
          </p>
        </div>

        {/* Workflow */}
        <div style={{ marginBottom: '5rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            How it works
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
            {WORKFLOW_STEPS.map(({ n, title, desc }) => (
              <div key={n} style={{ background: '#000', padding: '2rem 1.5rem' }}>
                <p style={{ fontFamily: MONO, fontSize: 11, color: GOLD, marginBottom: '1rem', letterSpacing: '0.3em' }}>{n}</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>{title}</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {PLATFORMS.map(({ name, status, desc, features }) => (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem', padding: '3rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 400, color: 'white' }}>{name}</h2>
                  <StatusBadge status={status} />
                </div>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.75 }}>{desc}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: MONO, marginBottom: '1rem' }}>Features</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ color: GOLD, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f}</span>
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
            Connect Your Accounting
          </Link>
        </div>
      </div>
    </div>
  );
}
