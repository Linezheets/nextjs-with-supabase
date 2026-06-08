'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const FEATURES = [
  { title: 'Everything in Brand',           desc: 'Full access to every feature in the Brand plan, across all brands.' },
  { title: 'Multi-brand management',        desc: 'Manage dozens of independent brands under one agency account. Separate dashboards, unified billing.' },
  { title: 'Custom integrations',           desc: 'We build and maintain any custom connector your team needs — ERP, 3PL, WMS, or proprietary systems.' },
  { title: 'Dedicated account manager',     desc: 'A named contact who understands your business, available by phone, email, and Slack.' },
  { title: '99.9% uptime SLA',              desc: 'Enterprise-grade infrastructure with contractual uptime guarantees and priority incident response.' },
  { title: 'Full API access',               desc: 'Read/write API access for every resource. Webhooks, event streams, and sandbox environments.' },
  { title: 'White-label options',           desc: 'Deploy Linezheets under your own brand domain for client portals and agency offerings.' },
  { title: 'SSO & advanced security',       desc: 'SAML 2.0 single sign-on, audit logs, role-based access control, and custom data retention.' },
  { title: 'Custom onboarding & training',  desc: 'Full migration support, team training sessions, and custom documentation for your workflow.' },
];

const CONTACT_FIELDS = [
  { label: 'Company name',    placeholder: 'Maison Margiela' },
  { label: 'Your name',       placeholder: 'Your full name' },
  { label: 'Work email',      placeholder: 'you@company.com' },
  { label: 'Number of brands',placeholder: 'e.g. 12' },
];

export default function EnterprisePricingPage() {
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'start' }}>

          {/* Left — copy + features */}
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
              Enterprise
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem,4vw,3.25rem)', fontWeight: 400, color: 'white', marginBottom: '1.25rem', lineHeight: 1.08 }}>
              For multi-brand agencies<br />and large operations.
            </h1>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.75, marginBottom: '3rem' }}>
              Custom pricing based on the number of brands, seats, and integrations you need. We structure contracts to match how your agency actually works — not the other way around.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {FEATURES.map(({ title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ color: GOLD, flexShrink: 0, marginTop: 2 }}>✦</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 3 }}>{title}</p>
                    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — contact form */}
          <div style={{ position: 'sticky', top: 96 }}>
            <div style={{ padding: '2.5rem', border: `1px solid rgba(201,168,76,0.2)`, background: 'rgba(201,168,76,0.03)' }}>
              <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '0.75rem' }}>
                Get a Custom Quote
              </p>
              <p style={{ fontSize: 15, color: MUTED, marginBottom: '2rem', lineHeight: 1.65 }}>
                Tell us about your operation and we&apos;ll put together a tailored proposal within one business day.
              </p>

              <form action="/api/contact" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <input type="hidden" name="subject" value="Enterprise Pricing Inquiry" />
                {CONTACT_FIELDS.map(({ label, placeholder }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, marginBottom: '0.5rem' }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      name={label.toLowerCase().replace(/ /g, '_')}
                      placeholder={placeholder}
                      required
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', padding: '0.75rem 1rem', fontSize: 14,
                        outline: 'none', boxSizing: 'border-box',
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, marginBottom: '0.5rem' }}>
                    Tell us about your needs
                  </label>
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="E.g. 15 brands, need ERP integration and white-label portal…"
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white', padding: '0.75rem 1rem', fontSize: 14,
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  />
                </div>
                <button type="submit" style={{
                  padding: '0.95rem',
                  background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
                  color: '#000', border: 'none', cursor: 'pointer',
                  fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
                  fontFamily: MONO, fontWeight: 600,
                }}>
                  Request Enterprise Quote
                </button>
              </form>

              <p style={{ marginTop: '1.5rem', fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Or email us directly at{' '}
                <a href="mailto:enterprise@linezheets.com" style={{ color: GOLD, textDecoration: 'none' }}>
                  enterprise@linezheets.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
