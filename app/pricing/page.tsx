import Link from 'next/link';
const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    desc: 'Perfect for emerging brands testing the wholesale market.',
    features: ['Up to 50 products', 'Basic digital linesheet', '5 buyer connections', 'Order management', 'Email support'],
    cta: 'Get Started',
    href: '/join',
    highlight: false,
  },
  {
    name: 'Brand',
    price: '$149',
    period: '/ month',
    desc: 'For established brands ready to scale wholesale globally.',
    features: ['Unlimited products', 'Live digital linesheets', 'Unlimited buyers', 'AI merchandising tools', 'Analytics & reports', 'Shopify sync', 'Priority support'],
    cta: 'Apply for Access',
    href: '/join',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For multi-brand agencies and large wholesale operations.',
    features: ['Everything in Brand', 'Multi-brand management', 'Custom integrations', 'Dedicated account manager', 'SLA & uptime guarantee', 'API access', 'White-label options'],
    cta: 'Contact Sales',
    href: '/contact',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: SANS, paddingTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '5rem 2.5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.5rem' }}>
            Pricing
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4.5rem)', fontWeight: 400, color: 'white', marginBottom: '1.5rem', lineHeight: 1 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto' }}>
            Start free. Scale as your wholesale business grows. No hidden fees.
          </p>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.08)' }}>
          {PLANS.map(({ name, price, period, desc, features, cta, href, highlight }) => (
            <div key={name} style={{
              background: highlight ? 'rgba(201,168,76,0.06)' : '#000',
              padding: '3rem 2.5rem',
              position: 'relative',
              borderTop: highlight ? `2px solid ${GOLD}` : '2px solid transparent',
            }}>
              {highlight && (
                <p style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#000', fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', padding: '4px 16px', fontFamily: MONO, fontWeight: 600 }}>
                  Most Popular
                </p>
              )}
              <p style={{ fontSize: 13, letterSpacing: '0.4em', textTransform: 'uppercase', color: highlight ? GOLD : 'rgba(255,255,255,0.4)', fontFamily: MONO, marginBottom: '1.5rem' }}>{name}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1rem' }}>
                <span style={{ fontFamily: SERIF, fontSize: '3rem', fontWeight: 400, color: 'white' }}>{price}</span>
                {period && <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>{period}</span>}
              </div>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: '2.5rem', lineHeight: 1.7 }}>{desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                    <span style={{ color: GOLD, flexShrink: 0, marginTop: 2 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href={href} style={{
                display: 'block', textAlign: 'center', padding: '0.9rem',
                background: highlight ? `linear-gradient(135deg,${GOLD},#8a6f2e)` : 'transparent',
                color: highlight ? '#000' : 'rgba(255,255,255,0.7)',
                border: highlight ? 'none' : '1px solid rgba(255,255,255,0.2)',
                fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
                textDecoration: 'none', fontFamily: MONO, fontWeight: highlight ? 600 : 400,
                transition: 'all 0.2s',
              }}>{cta}</Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
          All plans include a 14-day free trial. No credit card required.{' '}
          <Link href="/contact" style={{ color: GOLD, textDecoration: 'none' }}>Contact us</Link> for custom plans.
        </p>
      </div>
    </div>
  );
}
