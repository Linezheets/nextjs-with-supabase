'use client';

import { useState } from 'react';

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

type Plan = {
  id: string; name: string; price_monthly: number | null; price_annual: number | null;
  features: string[]; popular?: boolean;
  limits: { max_products: number; ai_features: boolean; marketplace: boolean };
};

type SubDetail = {
  billing_cycle       : string;
  current_period_end  : string;
  cancel_at_period_end: boolean;
} | null;

const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', price_monthly: 49, price_annual: 39,
    limits: { max_products: 50, ai_features: false, marketplace: false },
    features: ['Up to 50 products','5 line sheets/month','Basic AI matching','Stripe payments','Shippo labels'],
  },
  {
    id: 'studio', name: 'Studio', price_monthly: 149, price_annual: 119,
    limits: { max_products: -1, ai_features: true, marketplace: true },
    popular: true,
    features: ['Unlimited products','Unlimited line sheets','Full AI Studio','Marketplace listing','ERP sync','Buyer intelligence','Priority support'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price_monthly: null, price_annual: null,
    limits: { max_products: -1, ai_features: true, marketplace: true },
    features: ['Everything in Studio','Multi-brand portfolio','Custom AI training','Dedicated CSM','SLA uptime','SSO / SAML'],
  },
];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active  : { bg: '#f0faf4', color: '#2d7a4f' },
  trialing: { bg: '#fff8e1', color: GOLD },
  canceled: { bg: '#fff0f0', color: '#c0392b' },
  past_due: { bg: '#fff0f0', color: '#c0392b' },
};

export default function SubscriptionsClient({
  currentTier,
  currentStatus,
  subscription,
}: {
  currentTier  : string;
  currentStatus: string;
  subscription : SubDetail;
}) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr]         = useState('');
  const [msg, setMsg]         = useState('');

  const badge = STATUS_BADGE[currentStatus] ?? STATUS_BADGE.trialing;

  async function handleSubscribe(tierId: string) {
    if (tierId === 'enterprise') {
      window.open('mailto:info@mxlla.com?subject=Enterprise%20Plan%20Inquiry', '_blank');
      return;
    }
    setLoading(tierId);
    setErr('');
    const res  = await fetch('/api/subscriptions/subscribe', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ tier: tierId, billing }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) { setErr(json.error); return; }
    setMsg(`Subscribed to ${tierId} (${billing}) — ${json.subscription.status}`);
    if (json.clientSecret) {
      // In production, load Stripe Elements to confirm payment
      setMsg(prev => prev + '. Complete payment in Stripe.');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel at end of billing period?')) return;
    setLoading('cancel');
    const res  = await fetch('/api/subscriptions/cancel', { method: 'POST' });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) { setErr(json.error); return; }
    setMsg(json.message + (json.endsAt ? ` Ends: ${new Date(json.endsAt).toLocaleDateString()}` : ''));
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
          Brand Store / Subscription
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 400, color: '#111' }}>
            Your Plan
          </h1>
          <span style={{ ...badge, padding: '4px 12px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>
            {currentStatus}
          </span>
        </div>

        {subscription && (
          <div style={{ marginTop: 12, fontFamily: SANS, fontSize: '12px', color: '#888' }}>
            <span style={{ fontFamily: MONO, fontSize: '12px', color: GOLD, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              {currentTier}
            </span>
            {' '}&nbsp;·&nbsp;{subscription.billing_cycle} billing
            {subscription.current_period_end && (
              <> · renews {new Date(subscription.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
            {subscription.cancel_at_period_end && (
              <span style={{ color: '#df1b41' }}> · cancels at period end</span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ padding: '0 64px' }}>
        {err && <p style={{ marginTop: 16, color: '#df1b41', fontFamily: SANS, fontSize: '12px' }}>{err}</p>}
        {msg && <p style={{ marginTop: 16, color: '#2d7a4f', fontFamily: SANS, fontSize: '12px' }}>{msg}</p>}
      </div>

      {/* Billing toggle */}
      <div style={{ padding: '32px 64px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#888' }}>Billing Cycle</p>
        {(['monthly','annual'] as const).map(b => (
          <button key={b} onClick={() => setBilling(b)}
            style={{ background: billing === b ? '#111' : '#fff', color: billing === b ? '#fff' : '#888',
              border: '1px solid #e5e5e5', padding: '6px 18px', fontSize: '9px', letterSpacing: '0.3em',
              textTransform: 'uppercase', cursor: 'pointer', fontFamily: SANS }}>
            {b}{b === 'annual' && ' (save 20%)'}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ padding: '28px 64px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#f0f0f0' }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentTier;
          const price     = billing === 'annual' ? plan.price_annual : plan.price_monthly;
          return (
            <div key={plan.id} style={{ background: '#fff', padding: 32, position: 'relative' }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: GOLD, color: '#fff', fontSize: '7px', letterSpacing: '0.4em', textTransform: 'uppercase', padding: '3px 10px', fontFamily: SANS }}>
                  Popular
                </div>
              )}
              <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
                {plan.name}
              </p>
              <div style={{ marginBottom: 20 }}>
                {price !== null ? (
                  <>
                    <span style={{ fontFamily: MONO, fontSize: '36px', color: '#111' }}>${price}</span>
                    <span style={{ fontFamily: SANS, fontSize: '12px', color: '#888' }}>/mo</span>
                  </>
                ) : (
                  <span style={{ fontFamily: SERIF, fontSize: '24px', color: '#111', fontStyle: 'italic' }}>Custom</span>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontFamily: SANS, fontSize: '12px', color: '#666', display: 'flex', gap: 8 }}>
                    <span style={{ color: GOLD }}>—</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
                style={{
                  width: '100%', padding: '11px 0',
                  background: isCurrent ? '#f5f5f5' : '#111',
                  color: isCurrent ? '#888' : '#fff',
                  border: isCurrent ? '1px solid #e5e5e5' : 'none',
                  fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
                  cursor: loading === plan.id ? 'default' : 'pointer',
                }}
              >
                {loading === plan.id ? 'Please wait…'
                  : isCurrent ? 'Current plan'
                  : plan.id === 'enterprise' ? 'Contact sales'
                  : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Cancel */}
      {subscription && !subscription.cancel_at_period_end && currentStatus === 'active' && (
        <div style={{ padding: '32px 64px 64px' }}>
          <button onClick={handleCancel} disabled={loading === 'cancel'}
            style={{ background: 'none', border: 'none', fontFamily: SANS, fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', cursor: 'pointer', textDecoration: 'underline' }}>
            {loading === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        </div>
      )}
    </div>
  );
}
