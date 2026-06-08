'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const FEATURES = [
  { title: 'NET 30 / 60 / 90 terms',       desc: 'Offer deferred payment terms to trusted buyers. Linezheets tracks due dates and sends automated reminders.' },
  { title: 'Installment plans',             desc: 'Split wholesale orders into 2, 3, or 4 payments. Stripe handles the scheduling and retries automatically.' },
  { title: 'Multi-currency support',        desc: 'Accept USD, EUR, GBP, HKD, CNY, and 135+ other currencies. Buyers pay in their local currency.' },
  { title: 'Instant payout options',        desc: 'Access funds immediately after a buyer pays, or batch payouts on your preferred schedule.' },
  { title: 'Automated invoicing',           desc: 'PDF invoices are generated and emailed to buyers on order confirmation. Reminders go out automatically.' },
  { title: 'Dispute & chargeback handling', desc: 'Linezheets surfaces disputes in your dashboard with the evidence pre-compiled. Respond with one click.' },
  { title: 'PCI-DSS compliance',            desc: 'All card data is handled by Stripe — Linezheets never stores raw card numbers. PCI Level 1 certified.' },
  { title: 'Buyer credit limits',           desc: 'Set per-buyer spending caps. Orders exceeding the limit are held for manual approval.' },
];

const PAYMENT_METHODS = ['Visa / Mastercard', 'American Express', 'Apple Pay', 'Google Pay', 'ACH / Bank transfer', 'SEPA Direct Debit', 'Alipay', 'WeChat Pay'];

export default function PaymentsIntegrationsPage() {
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

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', marginBottom: '5rem', alignItems: 'end' }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
              Payments
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4.5vw,3.75rem)', fontWeight: 400, color: 'white', marginBottom: '1.25rem', lineHeight: 1.05 }}>
              Wholesale payments,<br />built for fashion.
            </h1>
            <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.75 }}>
              Powered by Stripe, the payments layer in Linezheets is purpose-built for wholesale — NET terms, installments, multi-currency, and automated invoicing included out of the box.
            </p>
          </div>

          {/* Stripe badge */}
          <div style={{ padding: '2rem', border: `1px solid rgba(201,168,76,0.18)`, background: 'rgba(201,168,76,0.04)' }}>
            <p style={{ fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: MONO, marginBottom: '0.75rem' }}>Powered by</p>
            <p style={{ fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 400, color: 'white', marginBottom: '0.75rem' }}>Stripe</p>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginBottom: '1.5rem' }}>
              Stripe processes millions in wholesale transactions daily. Your funds are protected by bank-grade encryption, PCI-DSS Level 1 certification, and 99.999% uptime.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['PCI Level 1', 'SOC 2', '135+ Currencies'].map(badge => (
                <span key={badge} style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: MONO, padding: '4px 10px', border: '1px solid rgba(201,168,76,0.25)', color: GOLD }}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Payment Features
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
            {FEATURES.map(({ title, desc }) => (
              <div key={title} style={{ background: '#000', padding: '1.75rem 2rem' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>{title}</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Accepted methods */}
        <div>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.5rem' }}>
            Accepted Payment Methods
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {PAYMENT_METHODS.map(m => (
              <span key={m} style={{
                fontSize: 13, color: 'rgba(255,255,255,0.7)', padding: '0.6rem 1.25rem',
                border: '1px solid rgba(255,255,255,0.1)', fontFamily: MONO,
              }}>{m}</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '4rem', textAlign: 'center' }}>
          <Link href="/join" style={{
            display: 'inline-block', padding: '0.9rem 2.25rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Start Accepting Payments
          </Link>
        </div>
      </div>
    </div>
  );
}
