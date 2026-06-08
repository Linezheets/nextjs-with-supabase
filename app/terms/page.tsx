import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';

export const metadata = {
  title      : 'Terms & Privacy — Linezheets',
  description: 'Terms of Service and Privacy Policy for the Linezheets private wholesale platform, operated by MXLLA Agency Ltd.',
};

const EFFECTIVE_DATE = '1 June 2026';
const COMPANY_FULL   = 'MXLLA Agency Ltd.';
const COMPANY_EMAIL  = 'legal@linezheets.com';
const JURISDICTION   = 'Hong Kong Special Administrative Region';
const SITE_URL       = 'linezheets.com';

// ── Section data ──────────────────────────────────────────────────────────────

const TERMS_SECTIONS: { id: string; index: string; title: string; body: React.ReactNode }[] = [
  {
    id   : 'acceptance',
    index: '01',
    title: 'Acceptance of Terms',
    body : (
      <>
        <p>
          By accessing or using the Linezheets platform (the &ldquo;Platform&rdquo;), including any
          associated websites, APIs, buyer portals, brand storefronts, and services operated by{' '}
          {COMPANY_FULL} (&ldquo;Linezheets&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;).
        </p>
        <p>
          If you are registering on behalf of a business entity, you represent that you have the
          authority to bind that entity to these Terms. If you do not agree, you must not use the
          Platform.
        </p>
        <p>
          These Terms apply in addition to any separate Master Wholesale Agreement, brand onboarding
          contract, or commission schedule signed with Linezheets. In the event of conflict, the
          executed agreement prevails.
        </p>
      </>
    ),
  },
  {
    id   : 'eligibility',
    index: '02',
    title: 'Eligibility & Access',
    body : (
      <>
        <p>
          The Platform is a private, invitation-only wholesale marketplace. Access is granted solely
          to authorised wholesale buyers and verified brand partners. To register you must:
        </p>
        <ul>
          <li>be a registered business entity or sole trader with a valid trading address;</li>
          <li>operate within the luxury, contemporary, or premium fashion segments;</li>
          <li>complete the application process and receive written approval from Linezheets; and</li>
          <li>be at least 18 years of age.</li>
        </ul>
        <p>
          Linezheets reserves the right to refuse, suspend, or revoke access at its sole discretion,
          including without limitation for fraudulent applications, misrepresentation, or conduct
          incompatible with the Platform&rsquo;s standards.
        </p>
      </>
    ),
  },
  {
    id   : 'account',
    index: '03',
    title: 'Account Responsibilities',
    body : (
      <>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and for
          all activity that occurs under your account. You must notify Linezheets immediately at{' '}
          <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> if you suspect any unauthorised
          access or security breach.
        </p>
        <p>
          You agree not to share, transfer, or sell your account access to any third party. Each
          account corresponds to a single verified business entity. Multi-brand agencies must
          register under an Enterprise plan.
        </p>
      </>
    ),
  },
  {
    id   : 'platform-use',
    index: '04',
    title: 'Permitted & Prohibited Use',
    body : (
      <>
        <p>You may use the Platform solely for legitimate wholesale trade activities. You must not:</p>
        <ul>
          <li>scrape, crawl, or extract data from the Platform without prior written consent;</li>
          <li>reverse-engineer, decompile, or attempt to access the Platform&rsquo;s source code;</li>
          <li>submit false, misleading, or plagiarised product listings or business information;</li>
          <li>use the Platform to conduct retail-to-consumer transactions (it is strictly B2B);</li>
          <li>
            transmit spam, unsolicited communications, or malicious software through the Platform;
          </li>
          <li>
            circumvent or attempt to circumvent any access controls, payment systems, or security
            features; or
          </li>
          <li>
            use AI-generated content or third-party data to inflate product catalogues or fabricate
            reviews, pricing, or availability.
          </li>
        </ul>
        <p>
          Violation of these rules may result in immediate account suspension and potential legal
          action.
        </p>
      </>
    ),
  },
  {
    id   : 'orders-payments',
    index: '05',
    title: 'Orders & Payments',
    body : (
      <>
        <p>
          Orders placed through the Platform constitute a binding commitment between the buyer and
          the brand. Linezheets acts as a facilitator and is not a party to the transaction unless
          explicitly stated in a signed agreement.
        </p>
        <p>
          Payment terms (including NET terms, deposit requirements, and currency) are agreed between
          buyer and brand and may be facilitated by Stripe or other payment processors. Linezheets is
          not responsible for failed payments, FX losses, or disputed charges arising from
          buyer-brand transactions.
        </p>
        <p>
          Platform subscription fees are billed in advance, non-refundable, and governed by the
          pricing schedule published at{' '}
          <Link href="/pricing" style={{ color: '#c9a84c' }}>linezheets.com/pricing</Link>.
        </p>
      </>
    ),
  },
  {
    id   : 'ip',
    index: '06',
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
          solely to facilitate wholesale trade.
        </p>
        <p>
          You may not reproduce, distribute, modify, publicly display, or create derivative works
          from any Platform content without prior written consent from Linezheets.
        </p>
      </>
    ),
  },
  {
    id   : 'ai-tools',
    index: '07',
    title: 'AI-Powered Features',
    body : (
      <>
        <p>
          The Platform includes AI-powered tools for product matching, trend analysis, linesheet
          generation, and storefront creation. These features are provided for informational and
          operational convenience only and do not constitute professional merchandising, financial,
          or legal advice.
        </p>
        <p>
          AI-generated recommendations are based on available data and may contain errors or
          omissions. You are solely responsible for any business decisions made in reliance on
          AI-generated outputs. Linezheets does not warrant the accuracy, completeness, or fitness
          for purpose of any AI-generated content.
        </p>
      </>
    ),
  },
  {
    id   : 'limitation',
    index: '08',
    title: 'Limitation of Liability',
    body : (
      <>
        <p>
          To the fullest extent permitted by law, Linezheets shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including loss of profits,
          revenue, data, or business opportunities.
        </p>
        <p>
          Our aggregate liability for any claim shall not exceed the greater of: (a) platform fees
          paid by you in the twelve months preceding the claim; or (b) HKD 2,000.
        </p>
        <p>
          The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without any
          warranty, express or implied, including warranties of merchantability, fitness for a
          particular purpose, or non-infringement.
        </p>
      </>
    ),
  },
  {
    id   : 'governing-law',
    index: '09',
    title: 'Governing Law',
    body : (
      <>
        <p>
          These Terms are governed by the laws of the <strong>{JURISDICTION}</strong>. You submit
          to the exclusive jurisdiction of the courts of {JURISDICTION} for any dispute arising
          under these Terms.
        </p>
        <p>
          Before initiating legal proceedings, both parties agree to attempt good-faith negotiation
          for 30 days. Unresolved disputes may be referred to the{' '}
          <strong>Hong Kong International Arbitration Centre (HKIAC)</strong> under its Administered
          Arbitration Rules. The seat is Hong Kong; proceedings are conducted in English.
        </p>
      </>
    ),
  },
  {
    id   : 'changes',
    index: '10',
    title: 'Changes to Terms',
    body : (
      <>
        <p>
          Linezheets may update these Terms at any time. Material changes will be communicated by
          email to your registered address at least 14 days before taking effect. Continued use of
          the Platform after the effective date constitutes acceptance.
        </p>
        <p>
          To close your account, contact{' '}
          <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>.
        </p>
      </>
    ),
  },
];

const PRIVACY_SECTIONS: { id: string; index: string; title: string; body: React.ReactNode }[] = [
  {
    id   : 'data-collected',
    index: '11',
    title: 'Data We Collect',
    body : (
      <>
        <p>We collect the following categories of personal and business data:</p>
        <ul>
          <li>
            <strong>Registration data:</strong> business name, contact name, email address,
            country, website, and business type provided during sign-up.
          </li>
          <li>
            <strong>Profile data:</strong> uploaded brand assets, product catalogues, pricing, and
            inventory information.
          </li>
          <li>
            <strong>Transaction data:</strong> order history, payment records, offer exchanges, and
            communication logs with other Platform users.
          </li>
          <li>
            <strong>Usage data:</strong> page views, feature interactions, session duration, device
            type, IP address, and browser type collected via server logs and analytics.
          </li>
          <li>
            <strong>Communications:</strong> messages sent via the Platform chat, support tickets,
            and emails exchanged with Linezheets.
          </li>
        </ul>
        <p>
          We do not collect sensitive personal data (e.g. health, biometric, or financial account
          data) beyond what is strictly necessary for payment processing via our third-party
          processor (Stripe).
        </p>
      </>
    ),
  },
  {
    id   : 'how-we-use',
    index: '12',
    title: 'How We Use Your Data',
    body : (
      <>
        <p>Your data is used solely for the following purposes:</p>
        <ul>
          <li>verifying your business identity and eligibility for Platform access;</li>
          <li>operating and improving the Platform and its AI-powered features;</li>
          <li>facilitating introductions and trade between buyers and brands;</li>
          <li>processing subscription payments and invoicing;</li>
          <li>sending transactional emails (order confirmations, alerts, account notices);</li>
          <li>complying with applicable laws and regulatory obligations; and</li>
          <li>
            with your explicit consent: sending marketing communications about new Platform
            features, curated brand updates, or seasonal announcements.
          </li>
        </ul>
        <p>
          We do not sell, rent, or broker your personal data to third parties. We do not use your
          data for advertising profiling or targeted advertising outside the Platform.
        </p>
      </>
    ),
  },
  {
    id   : 'legal-basis',
    index: '13',
    title: 'Legal Basis for Processing',
    body : (
      <>
        <p>
          For users in the European Economic Area, we rely on the following lawful bases under the
          GDPR:
        </p>
        <ul>
          <li>
            <strong>Contract performance</strong> — processing necessary to provide the Platform
            services you have signed up for.
          </li>
          <li>
            <strong>Legitimate interests</strong> — fraud prevention, Platform security, and
            improving our services where our interests are not overridden by your rights.
          </li>
          <li>
            <strong>Legal obligation</strong> — retaining records required by Hong Kong company law,
            tax regulations, or other applicable legislation.
          </li>
          <li>
            <strong>Consent</strong> — for optional marketing emails. You may withdraw consent at
            any time by clicking &ldquo;unsubscribe&rdquo; or emailing{' '}
            <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id   : 'data-sharing',
    index: '14',
    title: 'Data Sharing & Third Parties',
    body : (
      <>
        <p>
          We share your data only with trusted service providers who process it on our behalf under
          strict confidentiality agreements:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — database hosting and authentication (EU-region servers).
          </li>
          <li>
            <strong>Stripe</strong> — payment processing. Stripe&rsquo;s privacy policy governs
            payment data.
          </li>
          <li>
            <strong>SendGrid (Twilio)</strong> — transactional and marketing email delivery.
          </li>
          <li>
            <strong>Shopify</strong> — where you have connected a Shopify store via our integration,
            we exchange product and order data scoped to your authorised connection.
          </li>
          <li>
            <strong>Vercel</strong> — cloud infrastructure and edge network hosting.
          </li>
        </ul>
        <p>
          We may disclose your data if required by law, court order, or regulatory authority, or
          to protect the rights, property, or safety of Linezheets, its users, or the public.
        </p>
        <p>
          In the event of a merger, acquisition, or sale of substantially all assets, user data may
          be transferred to the successor entity, subject to the same privacy commitments.
        </p>
      </>
    ),
  },
  {
    id   : 'data-retention',
    index: '15',
    title: 'Data Retention',
    body : (
      <>
        <p>
          We retain your account data for as long as your account remains active. Upon account
          closure, we delete or anonymise your personal data within 90 days, except where we are
          legally required to retain it (e.g. financial records required under Hong Kong law for
          7 years).
        </p>
        <p>
          Transaction logs and audit trails may be retained for up to 7 years to comply with
          applicable accounting, tax, and anti-money laundering obligations.
        </p>
      </>
    ),
  },
  {
    id   : 'your-rights',
    index: '16',
    title: 'Your Rights',
    body : (
      <>
        <p>
          Depending on your jurisdiction, you may have the following rights regarding your personal
          data:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Correction</strong> — request correction of inaccurate or incomplete data.
          </li>
          <li>
            <strong>Deletion</strong> — request deletion of your personal data (subject to legal
            retention obligations).
          </li>
          <li>
            <strong>Portability</strong> — request your data in a structured, machine-readable
            format (GDPR users).
          </li>
          <li>
            <strong>Objection / Restriction</strong> — object to or restrict certain processing
            activities (GDPR users).
          </li>
          <li>
            <strong>Withdraw consent</strong> — at any time for marketing communications.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{' '}
          <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> with &ldquo;Data
          Rights&rdquo; in the subject line. We will respond within 30 days.
        </p>
        <p>
          If you are an EEA resident and believe we have not adequately addressed your concern, you
          have the right to lodge a complaint with your local Data Protection Authority.
        </p>
      </>
    ),
  },
  {
    id   : 'cookies',
    index: '17',
    title: 'Cookies & Tracking',
    body : (
      <>
        <p>
          The Platform uses cookies and similar technologies solely for essential functionality —
          session management, authentication, and security. We do not use advertising or tracking
          cookies.
        </p>
        <p>
          <strong>Essential cookies</strong> cannot be disabled as they are required for the
          Platform to function. These include your authentication token and CSRF protection tokens.
        </p>
        <p>
          We may use first-party analytics (aggregated, non-identifying usage statistics) to
          understand how the Platform is used and to prioritise improvements. No third-party
          advertising trackers are loaded.
        </p>
      </>
    ),
  },
  {
    id   : 'security',
    index: '18',
    title: 'Security',
    body : (
      <>
        <p>
          We implement industry-standard technical and organisational measures to protect your data,
          including TLS encryption in transit, AES-256 encryption at rest for sensitive fields,
          row-level security on all database tables, and multi-factor authentication support.
        </p>
        <p>
          However, no method of transmission over the internet is 100% secure. We cannot guarantee
          absolute security. In the event of a data breach that is likely to result in a high risk
          to your rights, we will notify affected users within 72 hours as required by applicable
          law.
        </p>
      </>
    ),
  },
  {
    id   : 'contact-privacy',
    index: '19',
    title: 'Contact for Privacy Matters',
    body : (
      <>
        <p>
          All privacy-related enquiries should be directed to:
        </p>
        <ul>
          <li><strong>Email:</strong> <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a></li>
          <li><strong>Subject line:</strong> Privacy Enquiry</li>
          <li><strong>Company:</strong> {COMPANY_FULL}</li>
          <li><strong>Jurisdiction:</strong> {JURISDICTION}</li>
        </ul>
        <p>
          We aim to respond to all privacy enquiries within 10 business days.
        </p>
      </>
    ),
  },
];

const ALL_SECTIONS = [...TERMS_SECTIONS, ...PRIVACY_SECTIONS];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: 'var(--font-mono), monospace' }}>

      <PublicNav label="Terms & Privacy" />

      {/* Hero */}
      <section className="border-b border-zinc-100 bg-black text-white">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 md:py-28">
          <p
            className="text-[7.5px] uppercase tracking-[0.7em] mb-8"
            style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}
          >
            Legal Documentation
          </p>
          <h1
            style={{
              fontFamily  : 'var(--font-serif), Georgia, serif',
              fontSize    : 'clamp(2.2rem, 5vw, 4rem)',
              fontWeight  : 400,
              lineHeight  : 1.05,
              marginBottom: '2rem',
            }}
          >
            Terms of Service<br />
            <em style={{ color: '#c9a84c', fontStyle: 'italic' }}>&amp; Privacy Policy</em>
          </h1>
          <p className="text-[12px] leading-[2]" style={{ color: '#666', maxWidth: '520px' }}>
            These documents govern your use of Linezheets and explain how we collect, use,
            and protect your data. Please read carefully before using the Platform.
          </p>
          <div className="mt-10 flex flex-wrap gap-8">
            <Chip label="Effective Date" value={EFFECTIVE_DATE} />
            <Chip label="Jurisdiction"   value={JURISDICTION} />
            <Chip label="Company"        value={COMPANY_FULL} />
          </div>
        </div>
      </section>

      {/* Jump nav */}
      <div className="border-b border-zinc-100 bg-zinc-50 hidden md:block">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-4 flex gap-8">
          <a
            href="#acceptance"
            className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
            style={{ color: '#c9a84c', textDecoration: 'none' }}
          >
            Terms of Service ↓
          </a>
          <a
            href="#data-collected"
            className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
            style={{ color: '#888', textDecoration: 'none' }}
          >
            Privacy Policy ↓
          </a>
          <a
            href="#contact-privacy"
            className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
            style={{ color: '#888', textDecoration: 'none' }}
          >
            Contact ↓
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20 flex gap-16 items-start">

        {/* Table of contents — sticky sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-10">
          <div className="mb-8">
            <p
              className="text-[7px] uppercase tracking-[0.5em] mb-3"
              style={{ color: '#c9a84c', fontFamily: 'var(--font-mono), monospace' }}
            >
              Terms of Service
            </p>
            <nav className="space-y-2.5">
              {TERMS_SECTIONS.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-start gap-3 group"
                  style={{ textDecoration: 'none' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '9px', color: '#c9a84c', lineHeight: '1.6', flexShrink: 0 }}>
                    {s.index}
                  </span>
                  <span className="text-[10px] leading-[1.6] group-hover:opacity-60 transition-opacity" style={{ color: '#888' }}>
                    {s.title}
                  </span>
                </a>
              ))}
            </nav>
          </div>

          <div>
            <p
              className="text-[7px] uppercase tracking-[0.5em] mb-3"
              style={{ color: '#888', fontFamily: 'var(--font-mono), monospace' }}
            >
              Privacy Policy
            </p>
            <nav className="space-y-2.5">
              {PRIVACY_SECTIONS.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-start gap-3 group"
                  style={{ textDecoration: 'none' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '9px', color: '#c9a84c', lineHeight: '1.6', flexShrink: 0 }}>
                    {s.index}
                  </span>
                  <span className="text-[10px] leading-[1.6] group-hover:opacity-60 transition-opacity" style={{ color: '#888' }}>
                    {s.title}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Sections */}
        <main className="flex-1 min-w-0">

          {/* Terms divider */}
          <div className="mb-12 pb-6 border-b border-zinc-100">
            <p className="text-[8px] uppercase tracking-[0.6em]" style={{ color: '#c9a84c' }}>
              Part I — Terms of Service
            </p>
          </div>

          <div className="space-y-16">
            {TERMS_SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-10">
                <div className="flex items-baseline gap-4 mb-6">
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#c9a84c', flexShrink: 0 }}>
                    {s.index}
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.5rem', fontWeight: 400, color: '#111', lineHeight: 1.1 }}>
                    {s.title}
                  </h2>
                </div>
                <div className="mb-8 h-px" style={{ background: i === 0 ? '#c9a84c' : '#f0f0f0' }} />
                <div className="legal-body">{s.body}</div>
              </section>
            ))}
          </div>

          {/* Privacy divider */}
          <div className="my-16 py-6 border-t border-b border-zinc-100">
            <p className="text-[8px] uppercase tracking-[0.6em]" style={{ color: '#888' }}>
              Part II — Privacy Policy
            </p>
          </div>

          <div className="space-y-16">
            {PRIVACY_SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-10">
                <div className="flex items-baseline gap-4 mb-6">
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#c9a84c', flexShrink: 0 }}>
                    {s.index}
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.5rem', fontWeight: 400, color: '#111', lineHeight: 1.1 }}>
                    {s.title}
                  </h2>
                </div>
                <div className="mb-8 h-px" style={{ background: i === 0 ? '#888' : '#f0f0f0' }} />
                <div className="legal-body">{s.body}</div>
              </section>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-16 pt-10 border-t border-zinc-100">
            <p className="text-[10px] leading-[1.9]" style={{ color: '#aaa' }}>
              For legal or privacy enquiries, contact{' '}
              <a href={`mailto:${COMPANY_EMAIL}`} className="underline underline-offset-2">
                {COMPANY_EMAIL}
              </a>
              . This document does not constitute legal advice. See also our{' '}
              <Link href="/legal" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                Legal Declarations
              </Link>{' '}
              for indemnification, liability limitations, and governing law details.
            </p>
            <p className="mt-4 text-[9px] uppercase tracking-[0.4em]" style={{ color: '#ccc' }}>
              © {new Date().getFullYear()} {COMPANY_FULL} · All rights reserved
            </p>
          </div>
        </main>
      </div>

      <PublicFooter />

      {/* Scoped styles */}
      <style>{`
        .legal-body p {
          font-size: 13px;
          line-height: 2;
          color: #444;
          margin-bottom: 1.25rem;
          font-family: var(--font-mono), monospace;
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
          font-family: var(--font-mono), monospace;
        }
        .legal-body ul li::before {
          content: '—';
          position: absolute;
          left: 0;
          color: #c9a84c;
          font-size: 11px;
        }
        .legal-body a {
          color: #c9a84c;
          text-decoration: none;
        }
        .legal-body a:hover {
          opacity: 0.7;
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
      <p className="text-[7px] uppercase tracking-[0.5em] mb-1" style={{ color: '#555', fontFamily: 'var(--font-mono), monospace' }}>{label}</p>
      <p className="text-[11px]" style={{ color: '#999', fontFamily: 'var(--font-mono), monospace' }}>{value}</p>
    </div>
  );
}
