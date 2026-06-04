import Link from 'next/link';

export const metadata = {
  title       : 'Legal — Linezheets',
  description : 'Indemnification, costs not covered, governing law declarations, and legal notices for Linezheets wholesale platform.',
};

const EFFECTIVE_DATE = '1 June 2026';
const COMPANY_FULL   = 'MXLLA Agency Ltd.';
const COMPANY_EMAIL  = 'legal@linezheets.com';
const JURISDICTION   = 'Hong Kong Special Administrative Region';

// ── Section data ──────────────────────────────────────────────────────────────

const SECTIONS: { id: string; index: string; title: string; body: React.ReactNode }[] = [
  {
    id   : 'agreement',
    index: '01',
    title: 'Scope of Agreement',
    body : (
      <>
        <p>
          These Legal Terms (&ldquo;Terms&rdquo;) govern your access to and use of the Linezheets private
          wholesale platform, including all associated services, APIs, buyer portals, and brand
          storefronts (collectively, the &ldquo;Platform&rdquo;), operated by {COMPANY_FULL}
          (&ldquo;Linezheets&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;).
        </p>
        <p>
          By registering, accessing, or using the Platform in any capacity — whether as an authorised
          wholesale buyer, a brand partner, or an administrator — you agree to be bound by these Terms
          in full. If you do not agree, you must cease use immediately and request account deletion at{' '}
          <a href={`mailto:${COMPANY_EMAIL}`} className="underline underline-offset-2">{COMPANY_EMAIL}</a>.
        </p>
        <p>
          These Terms apply in addition to any separate Master Wholesale Agreement, brand onboarding
          contract, or commission schedule you have signed with Linezheets. In the event of conflict,
          the executed agreement prevails.
        </p>
      </>
    ),
  },
  {
    id   : 'indemnification',
    index: '02',
    title: 'Indemnification',
    body : (
      <>
        <p>
          You agree to indemnify, defend, and hold harmless Linezheets, its officers, directors,
          employees, agents, licensors, and service providers from and against any claims, liabilities,
          damages, judgements, awards, losses, costs, expenses, or fees (including reasonable legal
          fees) arising out of or relating to:
        </p>
        <ul>
          <li>your violation of these Terms or any applicable law or regulation;</li>
          <li>
            your use or misuse of the Platform, including any content or data you submit, transmit,
            or display;
          </li>
          <li>
            your infringement of any intellectual property, privacy, or other rights of any third
            party;
          </li>
          <li>
            any transaction entered into between you and another Platform user (buyer-to-brand or
            brand-to-buyer), including disputes over quality, delivery, payment, or returns;
          </li>
          <li>
            your failure to comply with applicable customs, import, export, or trade-sanction
            regulations in your jurisdiction; or
          </li>
          <li>
            any representations you make to third parties regarding Linezheets or the Platform.
          </li>
        </ul>
        <p>
          Linezheets reserves the right to assume exclusive control of the defence of any matter
          otherwise subject to indemnification by you, in which case you will cooperate fully at your
          own expense.
        </p>
      </>
    ),
  },
  {
    id   : 'costs-not-covered',
    index: '03',
    title: 'Costs Not Covered by Linezheets',
    body : (
      <>
        <p>
          Linezheets does <strong>not</strong> cover, reimburse, or assume liability for any of the
          following costs incurred by buyers, brands, or any other party:
        </p>
        <Table
          rows={[
            ['Shipping & Logistics',        'All freight, courier, insurance, and last-mile delivery costs are the sole responsibility of the transacting parties. Linezheets does not act as a freight agent or carrier.'],
            ['Customs & Import Duties',     'Import tariffs, VAT, GST, duty, or customs brokerage fees imposed by the destination country are borne entirely by the buyer.'],
            ['Currency & FX Losses',        'Any foreign exchange conversion fees, bank charges, or currency-fluctuation losses arising from cross-border transactions.'],
            ['Returns & Restocking',        'Return shipping, restocking fees, re-inspection costs, or losses from rejected goods are negotiated directly between buyer and brand.'],
            ['Legal & Professional Fees',   'Costs incurred engaging solicitors, arbitrators, translators, or accountants in connection with any Platform transaction or dispute.'],
            ['Third-Party Platform Fees',   'Shopify subscription costs, payment processor fees, ERP licensing, or any other third-party software expense.'],
            ['Trade Show & Travel Costs',   'Attendance, registration, accommodation, or travel for fashion weeks, trade exhibitions, or brand showrooms.'],
            ['Product Development',         'Sampling, prototyping, custom manufacturing, or co-creation costs initiated between buyer and brand outside an explicit Linezheets co-development contract.'],
            ['Marketing & Advertising',     'Any marketing, photography, influencer, or campaign costs to promote brands or products sourced via the Platform.'],
            ['Tax Obligations',             'Your own corporate tax, income tax, or sales-tax obligations in your jurisdiction. Each party is solely responsible for its own tax affairs.'],
          ]}
        />
        <p>
          This list is illustrative and not exhaustive. Unless a cost is explicitly included in a
          signed written agreement with Linezheets, assume it is not covered.
        </p>
      </>
    ),
  },
  {
    id   : 'liability',
    index: '04',
    title: 'Limitation of Liability',
    body : (
      <>
        <p>
          To the fullest extent permitted by applicable law, Linezheets and its affiliates, officers,
          directors, employees, and agents shall not be liable for:
        </p>
        <ul>
          <li>
            any <strong>indirect, incidental, special, consequential, or punitive damages</strong>,
            including loss of profits, revenue, data, goodwill, or business opportunities, even if
            advised of the possibility of such damages;
          </li>
          <li>
            damages or losses resulting from <strong>third-party conduct</strong> — including other
            buyers, brands, payment processors, logistics providers, or force-majeure events;
          </li>
          <li>
            any loss arising from <strong>Platform downtime, data loss, or security incidents</strong>{' '}
            outside our reasonable control;
          </li>
          <li>
            any errors, omissions, or inaccuracies in <strong>product listings, pricing, or
            availability</strong> provided by brand partners; or
          </li>
          <li>
            your reliance on <strong>AI-generated recommendations</strong> (matching, forecasting,
            trend analysis) — these are informational only and do not constitute professional advice.
          </li>
        </ul>
        <p>
          In any event, our aggregate liability to you for any claim arising under or in connection
          with these Terms shall not exceed the greater of: (a) the total platform fees paid by you
          to Linezheets in the twelve (12) months immediately preceding the event giving rise to the
          claim; or (b) HKD 2,000.
        </p>
      </>
    ),
  },
  {
    id   : 'warranties',
    index: '05',
    title: 'Disclaimer of Warranties',
    body : (
      <>
        <p>
          The Platform and all content, features, and services are provided on an{' '}
          <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong> basis without any
          warranty of any kind, express or implied.
        </p>
        <p>
          Linezheets expressly disclaims all warranties, including but not limited to implied
          warranties of <strong>merchantability, fitness for a particular purpose, title, and
          non-infringement</strong>. We do not warrant that the Platform will be uninterrupted,
          error-free, secure, or free of viruses or other harmful components.
        </p>
        <p>
          Linezheets does not endorse, guarantee, or take responsibility for the quality,
          authenticity, safety, legality, or fitness for purpose of any products listed by brand
          partners. Buyers assume all risk in assessing and purchasing goods via the Platform.
        </p>
      </>
    ),
  },
  {
    id   : 'governing-law',
    index: '06',
    title: 'Governing Law & Jurisdiction',
    body : (
      <>
        <p>
          These Terms and any dispute or claim arising out of or in connection with them (including
          non-contractual disputes or claims) shall be governed by and construed in accordance with
          the laws of the <strong>{JURISDICTION}</strong>, without regard to its conflict-of-law
          provisions.
        </p>
        <p>
          You irrevocably submit to the exclusive jurisdiction of the courts of{' '}
          <strong>{JURISDICTION}</strong> to settle any dispute or claim arising out of or in
          connection with these Terms or their subject matter. Notwithstanding the foregoing,
          Linezheets reserves the right to seek injunctive or other equitable relief in any
          competent court worldwide.
        </p>
      </>
    ),
  },
  {
    id   : 'dispute-resolution',
    index: '07',
    title: 'Dispute Resolution',
    body : (
      <>
        <p>
          Before initiating any formal legal proceeding, each party agrees to attempt to resolve any
          dispute arising under these Terms by good-faith negotiation for a period of{' '}
          <strong>thirty (30) days</strong> following written notice of the dispute.
        </p>
        <p>
          If the dispute is not resolved within the thirty-day negotiation period, either party may
          refer the dispute to arbitration administered by the{' '}
          <strong>Hong Kong International Arbitration Centre (HKIAC)</strong> under the HKIAC
          Administered Arbitration Rules then in force. The seat of arbitration shall be Hong Kong.
          The arbitration shall be conducted in <strong>English</strong>. The arbitral award shall be
          final and binding on both parties.
        </p>
        <p>
          Nothing in this clause prevents Linezheets from seeking urgent interlocutory relief from a
          court of competent jurisdiction.
        </p>
      </>
    ),
  },
  {
    id   : 'intellectual-property',
    index: '08',
    title: 'Intellectual Property',
    body : (
      <>
        <p>
          All content on the Platform — including the Linezheets name, logo, trademarks, editorial
          copy, design system, source code, AI models, and data structures — is the exclusive
          property of {COMPANY_FULL} or its licensors and is protected by applicable intellectual
          property laws.
        </p>
        <p>
          Brand partners retain all IP rights in their product imagery, descriptions, and branding
          assets, and grant Linezheets a non-exclusive, royalty-free licence to display such assets
          on the Platform solely to facilitate wholesale trade.
        </p>
        <p>
          You may not reproduce, distribute, modify, publicly display, or create derivative works
          from any Platform content without prior written consent from Linezheets.
        </p>
      </>
    ),
  },
  {
    id   : 'data-privacy',
    index: '09',
    title: 'Data Protection & Privacy',
    body : (
      <>
        <p>
          Linezheets processes personal data in accordance with the{' '}
          <strong>Personal Data (Privacy) Ordinance (Cap. 486) of Hong Kong</strong> and, where
          applicable, the <strong>General Data Protection Regulation (GDPR)</strong> for users
          based in the European Economic Area.
        </p>
        <p>
          By using the Platform, you consent to the collection, processing, and transfer of your
          personal and business data as described in our Privacy Policy. You are responsible for
          ensuring that any personal data you submit about third parties (e.g., staff accounts) has
          been collected lawfully and that appropriate consents are in place.
        </p>
      </>
    ),
  },
  {
    id   : 'termination',
    index: '10',
    title: 'Termination & Suspension',
    body : (
      <>
        <p>
          Linezheets may, at its sole discretion, suspend or terminate your access to the Platform
          at any time, with or without notice, if:
        </p>
        <ul>
          <li>you breach any provision of these Terms;</li>
          <li>you engage in fraudulent, abusive, or unlawful conduct;</li>
          <li>continued access poses a risk to other users, brands, or the Platform&#8217;s integrity; or</li>
          <li>a court or regulatory authority requires us to do so.</li>
        </ul>
        <p>
          Upon termination, your right to access the Platform ceases immediately. Clauses 02
          (Indemnification), 03 (Costs Not Covered), 04 (Limitation of Liability), 06 (Governing
          Law), and 07 (Dispute Resolution) survive termination.
        </p>
      </>
    ),
  },
  {
    id   : 'amendments',
    index: '11',
    title: 'Amendments',
    body : (
      <>
        <p>
          Linezheets may revise these Terms at any time. Material changes will be communicated by
          email to your registered address and/or by a prominent notice on the Platform at least
          14 days before the change takes effect. Continued use of the Platform after the effective
          date constitutes acceptance of the revised Terms.
        </p>
        <p>
          If you do not agree to the revised Terms, you must stop using the Platform and notify us
          at <a href={`mailto:${COMPANY_EMAIL}`} className="underline underline-offset-2">{COMPANY_EMAIL}</a> to
          request account closure.
        </p>
      </>
    ),
  },
  {
    id   : 'general',
    index: '12',
    title: 'General Provisions',
    body : (
      <>
        <p>
          <strong>Entire Agreement.</strong> These Terms, together with any signed wholesale or
          brand-partner agreement, constitute the entire agreement between you and Linezheets with
          respect to the Platform and supersede all prior negotiations, representations, or
          agreements.
        </p>
        <p>
          <strong>Severability.</strong> If any provision of these Terms is found invalid or
          unenforceable, that provision will be modified to the minimum extent necessary to make it
          enforceable, and the remaining provisions will remain in full force.
        </p>
        <p>
          <strong>No Waiver.</strong> Failure by Linezheets to enforce any right or provision shall
          not constitute a waiver of that right or provision.
        </p>
        <p>
          <strong>Assignment.</strong> You may not assign or transfer your rights or obligations
          under these Terms without prior written consent from Linezheets. We may assign our rights
          without restriction.
        </p>
        <p>
          <strong>Force Majeure.</strong> Linezheets is not liable for any failure or delay in
          performance due to causes beyond our reasonable control, including natural disasters,
          pandemics, civil unrest, government action, or infrastructure failure.
        </p>
        <p>
          <strong>Language.</strong> These Terms are drafted in English. Any translation is provided
          for convenience only; in the event of inconsistency, the English version prevails.
        </p>
        <p>
          <strong>Contact.</strong> All legal notices to Linezheets must be sent by email to{' '}
          <a href={`mailto:${COMPANY_EMAIL}`} className="underline underline-offset-2">{COMPANY_EMAIL}</a> with
          &ldquo;Legal Notice&rdquo; in the subject line, or by post to our registered address.
        </p>
      </>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{
            fontFamily  : 'var(--font-serif), Georgia, serif',
            fontSize    : '15px',
            letterSpacing: '0.5em',
            fontWeight  : 400,
          }}>
            LINEZHEETS
          </Link>
          <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>
            Legal
          </p>
          <Link href="/join"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888' }}>
            Join
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-zinc-100 bg-black text-white">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
          <p className="text-[7.5px] uppercase tracking-[0.7em] mb-8" style={{ color: '#c9a84c' }}>
            Legal Documentation
          </p>
          <h1 style={{
            fontFamily  : 'var(--font-serif), Georgia, serif',
            fontSize    : 'clamp(2.2rem, 5vw, 4rem)',
            fontWeight  : 400,
            lineHeight  : 1.05,
            marginBottom: '2rem',
          }}>
            Terms, Indemnity<br />
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>&amp; Legal Declarations</em>
          </h1>
          <p className="text-[12px] leading-[2]" style={{ color: '#666', maxWidth: '520px' }}>
            These terms govern the relationship between Linezheets and all registered buyers and
            brand partners. Please read carefully before using the Platform.
          </p>
          <div className="mt-10 flex flex-wrap gap-8">
            <Chip label="Effective Date" value={EFFECTIVE_DATE} />
            <Chip label="Jurisdiction"   value={JURISDICTION} />
            <Chip label="Company"        value={COMPANY_FULL} />
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 flex gap-16 items-start">

        {/* Table of contents — sticky sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-10">
          <p className="text-[7px] uppercase tracking-[0.5em] mb-6" style={{ color: '#bbb' }}>
            Contents
          </p>
          <nav className="space-y-3">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-start gap-3 group"
                style={{ textDecoration: 'none' }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize  : '9px',
                  color     : '#c9a84c',
                  lineHeight: '1.6',
                  flexShrink: 0,
                }}>
                  {s.index}
                </span>
                <span className="text-[10px] leading-[1.6] group-hover:opacity-60 transition-opacity"
                      style={{ color: '#888' }}>
                  {s.title}
                </span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Sections */}
        <main className="flex-1 min-w-0 space-y-16">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-10">
              {/* Section header */}
              <div className="flex items-baseline gap-4 mb-6">
                <span style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize  : '10px',
                  color     : '#c9a84c',
                  flexShrink: 0,
                }}>
                  {s.index}
                </span>
                <h2 style={{
                  fontFamily  : 'var(--font-serif), Georgia, serif',
                  fontSize    : '1.5rem',
                  fontWeight  : 400,
                  color       : '#111',
                  lineHeight  : 1.1,
                }}>
                  {s.title}
                </h2>
              </div>
              {/* Rule */}
              <div className="mb-8 h-px" style={{ background: i === 0 ? '#c9a84c' : '#f0f0f0' }} />
              {/* Body */}
              <div className="legal-body">
                {s.body}
              </div>
            </section>
          ))}

          {/* Footer note */}
          <div className="pt-10 border-t border-zinc-100">
            <p className="text-[10px] leading-[1.9]" style={{ color: '#aaa' }}>
              For legal enquiries, please contact{' '}
              <a href={`mailto:${COMPANY_EMAIL}`} className="underline underline-offset-2">
                {COMPANY_EMAIL}
              </a>
              . This document does not constitute legal advice. Linezheets recommends that buyers
              and brands obtain independent legal counsel before entering into wholesale transactions
              across international jurisdictions.
            </p>
            <p className="mt-4 text-[9px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>
              © {new Date().getFullYear()} {COMPANY_FULL} · All rights reserved
            </p>
          </div>
        </main>
      </div>

      {/* Scoped styles */}
      <style>{`
        .legal-body p {
          font-size: 13px;
          line-height: 2;
          color: #444;
          margin-bottom: 1.25rem;
        }
        .legal-body ul {
          margin: 0.75rem 0 1.25rem 0;
          padding-left: 0;
          list-style: none;
        }
        .legal-body ul li {
          font-size: 13px;
          line-height: 1.9;
          color: #444;
          padding: 0.4rem 0 0.4rem 1.5rem;
          border-bottom: 1px solid #f5f5f5;
          position: relative;
        }
        .legal-body ul li::before {
          content: '—';
          position: absolute;
          left: 0;
          color: #c9a84c;
          font-size: 11px;
        }
        .legal-body a {
          color: inherit;
        }
        .legal-body strong {
          color: #111;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[7px] uppercase tracking-[0.5em] mb-1" style={{ color: '#555' }}>{label}</p>
      <p className="text-[11px]" style={{ color: '#999', fontFamily: 'var(--font-mono), monospace' }}>
        {value}
      </p>
    </div>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="my-6 border border-zinc-100">
      {rows.map(([category, detail], i) => (
        <div
          key={category}
          className="grid grid-cols-[200px_1fr] border-b border-zinc-50 last:border-b-0"
          style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}
        >
          <div className="px-4 py-4 border-r border-zinc-100">
            <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: '#c9a84c' }}>
              {category}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[12px] leading-[1.8]" style={{ color: '#555' }}>{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
