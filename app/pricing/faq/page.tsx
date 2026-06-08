'use client';
import { useState } from 'react';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const FAQS = [
  {
    q: 'Is the Starter plan really free forever?',
    a: 'Yes. There is no trial period, no auto-upgrade, and no credit card required. You can stay on the Starter plan indefinitely. It is limited to 50 products and 5 buyer connections.',
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'You can upgrade from Starter to Brand instantly from your dashboard. Downgrades take effect at the end of your current billing cycle. No penalties.',
  },
  {
    q: 'Is there an annual discount on the Brand plan?',
    a: 'Yes — paying annually works out to $1,490 per year, effectively giving you two months free compared to the monthly rate of $149.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards via Stripe. Enterprise accounts can also pay by bank transfer or invoice with NET 30 terms.',
  },
  {
    q: 'Does the Brand plan include a free trial?',
    a: 'All paid plans include a 14-day free trial. No credit card is required to start the trial. You only get charged if you choose to continue after the trial ends.',
  },
  {
    q: 'Can I add extra team members on the Brand plan?',
    a: 'The Brand plan includes 5 team members. If you need more seats, you can purchase additional seats at $25 / seat / month, or speak to us about an Enterprise plan.',
  },
  {
    q: 'What is included in "priority support"?',
    a: 'Brand plan subscribers receive a 4-hour email response SLA during business hours (HKT), plus access to live chat and a dedicated onboarding call within 48 hours of signup.',
  },
  {
    q: 'Can I request a refund?',
    a: 'We offer a full refund within 14 days of your first paid charge if you are not satisfied. After that, charges are non-refundable but you can cancel any time to prevent future billing.',
  },
  {
    q: 'Do you offer non-profit or early-stage brand discounts?',
    a: 'Yes. Reach out to us at billing@linezheets.com with a brief description of your organisation. We assess requests individually and typically offer 30–50% off.',
  },
  {
    q: 'How does Enterprise pricing work?',
    a: 'Enterprise is quoted based on the number of brands, users, and integrations you need. There is no fixed price — contact us and we will put together a proposal within one business day.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '1.5rem 0',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
        }}>
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>{q}</span>
        <span style={{ color: GOLD, fontSize: 18, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)', display: 'inline-block' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.8, paddingBottom: '1.5rem', paddingRight: '2rem' }}>
          {a}
        </p>
      )}
    </div>
  );
}

export default function PricingFAQPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/pricing" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← All Plans
        </Link>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '4rem 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            Pricing FAQ
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4vw,3.5rem)', fontWeight: 400, color: 'white', lineHeight: 1.08 }}>
            Common questions, answered.
          </h1>
        </div>

        <div>
          {FAQS.map(({ q, a }) => (
            <FAQItem key={q} q={q} a={a} />
          ))}
        </div>

        <div style={{ marginTop: '4rem', padding: '2.5rem', border: `1px solid rgba(201,168,76,0.18)`, background: 'rgba(201,168,76,0.04)', textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontSize: '1.5rem', fontWeight: 400, color: 'white', marginBottom: '0.75rem' }}>
            Still have questions?
          </p>
          <p style={{ fontSize: 15, color: MUTED, marginBottom: '2rem' }}>
            Our team is happy to walk you through which plan is right for your business.
          </p>
          <Link href="/contact" style={{
            display: 'inline-block', padding: '0.9rem 2.25rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
