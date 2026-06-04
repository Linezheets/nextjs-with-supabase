import Link from 'next/link';

export const metadata = {
  title       : 'About — Linezheets',
  description : 'Linezheets is a private wholesale marketplace for authorised luxury retailers, operated by MXLLA Agency.',
};

export default function AboutPage() {
  return (
    <>
      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 h-14 flex items-center justify-between">
          <Link href="/" style={{
            fontFamily   : 'var(--font-serif), serif',
            fontSize     : '13px',
            letterSpacing: '0.15em',
            color        : '#111',
            textDecoration: 'none',
          }}>
            LINEZHEETS
          </Link>
          <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
            Private Wholesale
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-zinc-100 bg-black text-white">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
          <p className="text-[7.5px] uppercase tracking-[0.7em] mb-8" style={{ color: '#c9a84c' }}>
            About
          </p>
          <h1 style={{
            fontFamily   : 'var(--font-serif), serif',
            fontSize     : 'clamp(32px, 5vw, 56px)',
            fontWeight   : 400,
            lineHeight   : 1.15,
            letterSpacing: '-0.01em',
            color        : '#fff',
            maxWidth     : '640px',
          }}>
            A Private Room for{' '}
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>Luxury Wholesale</em>
          </h1>
          <p className="text-[12px] leading-[2] mt-6" style={{ color: '#666', maxWidth: '520px' }}>
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
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                Who we are
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                MXLLA Agency is a Hong Kong-based luxury fashion consultancy. We connect independent
                retailers with curated brands across ready-to-wear, accessories, and fine goods —
                working across the Paris fashion calendar and global trunk shows.
              </p>
            </div>

            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                What Linezheets is
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                Linezheets is our private digital showroom — a gated wholesale marketplace where
                pre-approved buyers discover seasonal collections, place orders, and access
                exclusive pricing outside of traditional trade fair timelines.
              </p>
            </div>

            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                Authorised buyers only
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                Access is by application and invitation only. We maintain a carefully selected
                network of retail partners whose values and clientele align with the brands we
                represent.
              </p>
            </div>
          </div>

          {/* Right column — stat-style cards */}
          <div className="space-y-px border border-zinc-100">
            {[
              { label: 'Headquarters',  value: 'Hong Kong SAR' },
              { label: 'Coverage',      value: 'Paris · Asia-Pacific · Middle East' },
              { label: 'Market',        value: 'Luxury & Contemporary Wholesale' },
              { label: 'Access',        value: 'By application & invitation' },
              { label: 'Operated by',   value: 'MXLLA Agency' },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[180px_1fr] border-b border-zinc-100 last:border-b-0">
                <div className="px-5 py-5 border-r border-zinc-100">
                  <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: '#bbb' }}>{label}</p>
                </div>
                <div className="px-5 py-5">
                  <p className="text-[12px] leading-[1.7]" style={{ color: '#444' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* CTA */}
        <div className="mt-20 pt-12 border-t border-zinc-100 flex flex-wrap gap-6 items-center">
          <Link href="/join"
            className="text-[9px] uppercase tracking-[0.4em] px-8 py-4 transition-opacity hover:opacity-70"
            style={{ background: '#c9a84c', color: '#fff', textDecoration: 'none' }}>
            Apply for Access
          </Link>
          <Link href="/contact"
            className="text-[9px] uppercase tracking-[0.4em] px-8 py-4 border border-zinc-200 transition-opacity hover:opacity-60"
            style={{ color: '#555', textDecoration: 'none' }}>
            Contact Us
          </Link>
        </div>
      </div>

      {/* Footer strip */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-8 flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>
            © {new Date().getFullYear()} MXLLA Agency Ltd.
          </p>
          <Link href="/"
            className="text-[9px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
            style={{ color: '#999', textDecoration: 'none' }}>
            Back to Home
          </Link>
        </div>
      </footer>
    </>
  );
}
