import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const metadata = {
  title      : 'Contact — Linezheets',
  description: 'Get in touch with the Linezheets team for buyer enquiries, brand partnerships, and general questions.',
};

const CONTACT_EMAIL = 'info@mxlla.com';
const MONO = 'var(--font-mono), "DM Mono", monospace';
const SERIF = 'var(--font-serif), Georgia, serif';

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-100 bg-black text-white" style={{ paddingTop: 64 }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
          <p
            className="text-[7.5px] uppercase tracking-[0.7em] mb-8"
            style={{ color: '#c9a84c', fontFamily: MONO }}
          >
            Contact
          </p>
          <h1
            style={{
              fontFamily   : SERIF,
              fontSize     : 'clamp(32px, 5vw, 56px)',
              fontWeight   : 400,
              lineHeight   : 1.15,
              letterSpacing: '-0.01em',
              color        : '#fff',
              maxWidth     : '560px',
            }}
          >
            Get in{' '}
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>Touch</em>
          </h1>
          <p
            className="text-[12px] leading-[2] mt-6"
            style={{ color: '#666', maxWidth: '480px', fontFamily: MONO }}
          >
            For buyer enquiries, brand partnerships, or any questions about the platform —
            reach us directly below.
          </p>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24">

          {/* Contact methods */}
          <div className="space-y-px border border-zinc-100">
            {[
              {
                label: 'General Enquiries',
                value: CONTACT_EMAIL,
                href : `mailto:${CONTACT_EMAIL}`,
                note : 'Buyer access, platform questions, partnerships',
              },
              {
                label: 'Buyer Applications',
                value: CONTACT_EMAIL,
                href : `mailto:${CONTACT_EMAIL}?subject=Buyer%20Application`,
                note : 'New wholesale account requests',
              },
              {
                label: 'Brand Partnerships',
                value: CONTACT_EMAIL,
                href : `mailto:${CONTACT_EMAIL}?subject=Brand%20Partnership`,
                note : 'Listing your brand on the platform',
              },
              {
                label: 'Headquarters',
                value: 'Hong Kong SAR',
                href : null,
                note : 'Events & showrooms: Paris fashion calendar',
              },
            ].map(({ label, value, href, note }) => (
              <div key={label} className="border-b border-zinc-100 last:border-b-0 px-5 py-6">
                <p
                  className="text-[8px] uppercase tracking-[0.45em] mb-2"
                  style={{ color: '#c9a84c', fontFamily: MONO }}
                >
                  {label}
                </p>
                {href ? (
                  <a
                    href={href}
                    className="text-[13px] underline underline-offset-4 hover:opacity-60 transition-opacity"
                    style={{ color: '#111', fontFamily: MONO }}
                  >
                    {value}
                  </a>
                ) : (
                  <p className="text-[13px]" style={{ color: '#111', fontFamily: MONO }}>{value}</p>
                )}
                <p
                  className="text-[10px] mt-2 leading-[1.7]"
                  style={{ color: '#aaa', fontFamily: MONO }}
                >
                  {note}
                </p>
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="space-y-10">
            {[
              {
                label: 'Response time',
                body : 'We aim to respond to all enquiries within 48 hours. During Paris fashion week periods, response times may be slightly longer.',
                cta  : null,
              },
              {
                label: 'Wholesale buyers',
                body : 'If you are an authorised buyer with an active account, sign in to your dashboard for direct support and order management.',
                cta  : { label: 'Go to Dashboard →', href: '/dashboard', gold: false },
              },
              {
                label: 'New to Linezheets?',
                body : 'Access is by application only. Submit your business details and we will review your account request.',
                cta  : { label: 'Apply for Access', href: '/join', gold: true },
              },
            ].map(({ label, body, cta }) => (
              <div key={label}>
                <p
                  className="text-[7.5px] uppercase tracking-[0.55em] mb-4"
                  style={{ color: '#c9a84c', fontFamily: MONO }}
                >
                  {label}
                </p>
                <p
                  className="text-[13px] leading-[2]"
                  style={{ color: '#444', fontFamily: MONO }}
                >
                  {body}
                </p>
                {cta && (
                  <Link
                    href={cta.href}
                    className="inline-block mt-4 text-[9px] uppercase tracking-[0.4em] transition-opacity hover:opacity-70"
                    style={cta.gold
                      ? {
                          background    : 'linear-gradient(135deg,#e8c56b,#c9a84c)',
                          color         : '#000',
                          padding       : '0.6rem 1.5rem',
                          textDecoration: 'none',
                          fontFamily    : MONO,
                          fontWeight    : 600,
                        }
                      : {
                          color         : '#c9a84c',
                          textDecoration: 'none',
                          fontFamily    : MONO,
                        }
                    }
                  >
                    {cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
