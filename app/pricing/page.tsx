import Link from 'next/link';

export const metadata = {
  title      : 'Pricing — Linezheets',
  description: 'Simple, transparent wholesale platform pricing. Start free. Scale as your business grows.',
};

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'var(--font-mono), "DM Mono", monospace';
const GOLD  = '#c9a84c';
const GOLD_B = '#e8c56b';

const PLANS = [
  {
    name    : 'Starter',
    price   : 'Free',
    period  : '',
    desc    : 'For emerging brands testing the wholesale market.',
    features: ['Up to 50 products', 'Basic digital linesheet', '5 buyer connections', 'Order management', 'Email support'],
    cta     : 'Get Started',
    href    : '/join',
    highlight: false,
  },
  {
    name    : 'Brand',
    price   : '$149',
    period  : '/ month',
    desc    : 'For established brands ready to scale wholesale globally.',
    features: ['Unlimited products', 'Live digital linesheets', 'Unlimited buyers', 'AI merchandising tools', 'Analytics & reports', 'Shopify sync', 'Priority support'],
    cta     : 'Apply for Access',
    href    : '/join',
    highlight: true,
  },
  {
    name    : 'Enterprise',
    price   : 'Custom',
    period  : '',
    desc    : 'For multi-brand agencies and large wholesale operations.',
    features: ['Everything in Brand', 'Multi-brand management', 'Custom integrations', 'Dedicated account manager', 'SLA & uptime guarantee', 'API access', 'White-label options'],
    cta     : 'Contact Sales',
    href    : '/contact',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: MONO, paddingTop: 64 }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '6rem 2.5rem 5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, marginBottom: '1.5rem' }}>
            Pricing
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.5rem,5vw,4.5rem)', fontWeight: 400, color: '#fff', marginBottom: '1.5rem', lineHeight: 1 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontFamily: MONO, fontSize: '14px', lineHeight: 1.9, color: 'rgba(255,255,255,0.45)', maxWidth: 420, margin: '0 auto' }}>
            Start free. Scale as your wholesale business grows. No hidden fees.
          </p>
        </div>

        {/* ── Plans grid ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.07)' }}>
          {PLANS.map(({ name, price, period, desc, features, cta, href, highlight }) => (
            <div key={name} style={{
              background  : highlight ? 'rgba(201,168,76,0.05)' : '#000',
              padding     : '3rem 2.5rem',
              position    : 'relative',
              borderTop   : highlight ? `2px solid ${GOLD}` : '2px solid transparent',
              display     : 'flex',
              flexDirection: 'column',
            }}>
              {highlight && (
                <p style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: GOLD, color: '#000',
                  fontFamily: MONO, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase',
                  padding: '3px 14px', fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  Most Popular
                </p>
              )}

              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase', color: highlight ? GOLD : 'rgba(255,255,255,0.35)', marginBottom: '1.5rem' }}>
                {name}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '1rem' }}>
                <span style={{ fontFamily: SERIF, fontSize: '3rem', fontWeight: 400, color: '#fff' }}>{price}</span>
                {period && <span style={{ fontFamily: MONO, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{period}</span>}
              </div>

              <p style={{ fontFamily: MONO, fontSize: '12px', lineHeight: 1.9, color: 'rgba(255,255,255,0.45)', marginBottom: '2.5rem' }}>
                {desc}
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
                {features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontFamily: MONO, fontSize: '12px', lineHeight: 1.7, color: 'rgba(255,255,255,0.65)' }}>
                    <span style={{ color: GOLD, flexShrink: 0, marginTop: 2, fontSize: '10px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={href} style={{
                display: 'block', textAlign: 'center', padding: '0.9rem',
                background   : highlight ? `linear-gradient(135deg,${GOLD_B},${GOLD})` : 'transparent',
                color        : highlight ? '#000' : 'rgba(255,255,255,0.6)',
                border       : highlight ? 'none' : '1px solid rgba(255,255,255,0.15)',
                fontFamily   : MONO, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase',
                textDecoration: 'none', fontWeight: highlight ? 700 : 400,
                transition   : 'all 0.2s',
              }}>
                {cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', fontFamily: MONO, fontSize: '11px', lineHeight: 1.9, color: 'rgba(255,255,255,0.25)' }}>
          All plans include a 14-day free trial. No credit card required.{' '}
          <Link href="/contact" style={{ color: GOLD, textDecoration: 'none' }}>Contact us</Link> for custom plans.
        </p>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4rem' }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '1.5rem 2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
        }}>
          <p style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} MXLLA Agency Ltd.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[{ label: 'Terms', href: '/terms' }, { label: 'Legal', href: '/legal' }, { label: 'Contact', href: '/contact' }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ fontFamily: MONO, fontSize: '7.5px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
