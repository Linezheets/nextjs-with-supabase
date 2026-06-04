import Link from 'next/link';

export const metadata = {
  title       : 'Contact — Linezheets',
  description : 'Get in touch with the Linezheets team for buyer enquiries, brand partnerships, and general questions.',
};

const CONTACT_EMAIL = 'info@mxlla.com';

export default function ContactPage() {
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
            Contact
          </p>
          <h1 style={{
            fontFamily   : 'var(--font-serif), serif',
            fontSize     : 'clamp(32px, 5vw, 56px)',
            fontWeight   : 400,
            lineHeight   : 1.15,
            letterSpacing: '-0.01em',
            color        : '#fff',
            maxWidth     : '560px',
          }}>
            Get in{' '}
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>Touch</em>
          </h1>
          <p className="text-[12px] leading-[2] mt-6" style={{ color: '#666', maxWidth: '480px' }}>
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
                label  : 'General Enquiries',
                value  : CONTACT_EMAIL,
                href   : `mailto:${CONTACT_EMAIL}`,
                note   : 'Buyer access, platform questions, partnerships',
              },
              {
                label  : 'Buyer Applications',
                value  : CONTACT_EMAIL,
                href   : `mailto:${CONTACT_EMAIL}?subject=Buyer%20Application`,
                note   : 'New wholesale account requests',
              },
              {
                label  : 'Brand Partnerships',
                value  : CONTACT_EMAIL,
                href   : `mailto:${CONTACT_EMAIL}?subject=Brand%20Partnership`,
                note   : 'Listing your brand on the platform',
              },
              {
                label  : 'Headquarters',
                value  : 'Hong Kong SAR',
                href   : null,
                note   : 'Events & showrooms: Paris fashion calendar',
              },
            ].map(({ label, value, href, note }) => (
              <div key={label} className="border-b border-zinc-100 last:border-b-0 px-5 py-6">
                <p className="text-[8px] uppercase tracking-[0.45em] mb-2" style={{ color: '#c9a84c' }}>
                  {label}
                </p>
                {href ? (
                  <a href={href}
                    className="text-[13px] underline underline-offset-4 hover:opacity-60 transition-opacity"
                    style={{ color: '#111', fontFamily: 'var(--font-mono), monospace' }}>
                    {value}
                  </a>
                ) : (
                  <p className="text-[13px]" style={{ color: '#111' }}>{value}</p>
                )}
                <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: '#aaa' }}>{note}</p>
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="space-y-10">
            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                Response time
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                We aim to respond to all enquiries within 48 hours. During Paris fashion week
                periods, response times may be slightly longer.
              </p>
            </div>

            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                Wholesale buyers
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                If you are an authorised buyer with an active account, please sign in to your
                dashboard for direct support and order management.
              </p>
              <Link href="/dashboard"
                className="inline-block mt-4 text-[9px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
                style={{ color: '#c9a84c', textDecoration: 'none' }}>
                Go to Dashboard →
              </Link>
            </div>

            <div>
              <p className="text-[7.5px] uppercase tracking-[0.55em] mb-4" style={{ color: '#c9a84c' }}>
                New to Linezheets?
              </p>
              <p className="text-[13px] leading-[2]" style={{ color: '#444' }}>
                Access is by application only. Submit your details and we will review your
                account request.
              </p>
              <Link href="/join"
                className="inline-block mt-4 text-[9px] uppercase tracking-[0.4em] px-6 py-3 transition-opacity hover:opacity-70"
                style={{ background: '#c9a84c', color: '#fff', textDecoration: 'none' }}>
                Apply for Access
              </Link>
            </div>
          </div>

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
