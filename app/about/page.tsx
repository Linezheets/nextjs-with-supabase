import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';

export const metadata = {
  title       : 'About — Linezheets',
  description : 'Linezheets is a private wholesale marketplace for authorised luxury retailers, operated by MXLLA Agency.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-white/10 bg-black text-white" style={{ paddingTop: 64 }}>
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
          <p
            className="text-[7.5px] uppercase tracking-[0.7em] mb-8"
            style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}
          >
            About
          </p>
          <h1
            style={{
              fontFamily   : 'var(--font-serif), Georgia, serif',
              fontSize     : 'clamp(32px, 5vw, 56px)',
              fontWeight   : 400,
              lineHeight   : 1.15,
              letterSpacing: '-0.01em',
              color        : '#fff',
              maxWidth     : '640px',
            }}
          >
            A Private Room for{' '}
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>Luxury Wholesale</em>
          </h1>
          <p
            className="text-[13px] leading-[2] mt-6"
            style={{ color: '#888', maxWidth: '520px', fontFamily: 'var(--font-mono), monospace' }}
          >
            Linezheets is the VIP wholesale channel operated by MXLLA Agency — built exclusively
            for authorised buyers and emerging luxury brands.
          </p>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24">

          {/* Left column */}
          <div className="space-y-10">
            {[
              {
                label: 'Who we are',
                body : 'MXLLA Agency is a Hong Kong-based luxury fashion consultancy. We connect independent retailers with curated brands across ready-to-wear, accessories, and fine goods — working across the Paris fashion calendar and global trunk shows.',
              },
              {
                label: 'What Linezheets is',
                body : 'Linezheets is our private digital showroom — a gated wholesale marketplace where pre-approved buyers discover seasonal collections, place orders, and access exclusive pricing outside of traditional trade fair timelines.',
              },
              {
                label: 'Authorised buyers only',
                body : 'Access is by application and invitation only. We maintain a carefully selected network of retail partners whose values and clientele align with the brands we represent.',
              },
            ].map(({ label, body }) => (
              <div key={label}>
                <p
                  className="text-[7.5px] uppercase tracking-[0.55em] mb-4"
                  style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}
                >
                  {label}
                </p>
                <p
                  className="text-[13px] leading-[2]"
                  style={{ color: 'rgba(255,255,255,0.62)', fontFamily: 'var(--font-mono), monospace' }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>

          {/* Right column — stat cards */}
          <div className="space-y-px border border-white/10">
            {[
              { label: 'Headquarters', value: 'Hong Kong SAR' },
              { label: 'Coverage',     value: 'Paris · Asia-Pacific · Middle East' },
              { label: 'Market',       value: 'Luxury & Contemporary Wholesale' },
              { label: 'Access',       value: 'By application & invitation' },
              { label: 'Operated by',  value: 'MXLLA Agency' },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[180px_1fr] border-b border-white/10 last:border-b-0">
                <div className="px-5 py-5 border-r border-white/10">
                  <p
                    className="text-[9px] uppercase tracking-[0.4em]"
                    style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {label}
                  </p>
                </div>
                <div className="px-5 py-5">
                  <p
                    className="text-[12px] leading-[1.7]"
                    style={{ color: 'rgba(255,255,255,0.62)', fontFamily: 'var(--font-mono), monospace' }}
                  >
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 pt-12 border-t border-white/10 flex flex-wrap gap-6 items-center">
          <Link
            href="/join"
            className="text-[9px] uppercase tracking-[0.4em] px-8 py-4 transition-opacity hover:opacity-70"
            style={{
              background    : 'linear-gradient(135deg,#e8c56b,#c9a84c)',
              color         : '#000',
              textDecoration: 'none',
              fontFamily    : 'var(--font-mono), monospace',
              fontWeight    : 600,
            }}
          >
            Apply for Access
          </Link>
          <Link
            href="/contact"
            className="text-[9px] uppercase tracking-[0.4em] px-8 py-4 border border-white/15 transition-opacity hover:opacity-60"
            style={{ color: 'rgba(255,255,255,0.62)', textDecoration: 'none', fontFamily: 'var(--font-mono), monospace' }}
          >
            Contact Us
          </Link>
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
