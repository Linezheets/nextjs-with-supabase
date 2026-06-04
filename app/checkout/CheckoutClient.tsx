'use client';

import { useState, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

type PaymentTerms = {
  payment_methods  : string[];
  flow             : 'immediate' | 'pay_later' | 'installments';
  deadline_days    : number | null;
  installment_count: number;
  installment_days : number;
};

type Order = {
  id       : string;
  total_usd: number;
  items    : { name: string | null; size: string; quantity: number; wholesale_price: number | null; brand_name: string | null }[];
  notes    : string | null;
};

type WireInstructions = {
  financial_addresses?: {
    type      : string;
    routing_number?: string;
    account_number?: string;
    bank_name?: string;
    swift_code?: string;
    iban?: string;
    bic?: string;
    reference?: string;
  }[];
  hosted_instructions_url?: string;
  reference?: string;
};

// ── Inner form (needs Stripe context) ────────────────────────────────────────
function PaymentForm({
  orderId,
  method,
  flow,
  onSuccess,
}: {
  orderId  : string;
  method   : string;
  flow     : string;
  onSuccess: (result?: WireInstructions) => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    // 1. Validate the Elements form fields first (deferred intent pattern)
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? 'Please check your payment details');
      setLoading(false);
      return;
    }

    // 2. Create intent server-side
    const res = await fetch('/api/payments/create-intent', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order_id: orderId, method, flow }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create payment'); setLoading(false); return; }

    // 3. Card / ACH — confirm with the clientSecret returned from the server
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      clientSecret  : data.client_secret,
      confirmParams : {
        return_url: `${window.location.origin}/dashboard/orders`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed');
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }, [stripe, elements, orderId, method, flow, onSuccess]);

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'accordion',
          ...(method === 'ach' ? { defaultValues: { billingDetails: {} } } : {}),
        }}
      />
      {error && (
        <p className="mt-3 text-[11px] text-red-500 tracking-[0.05em]">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="mt-6 w-full py-4 text-[10px] uppercase tracking-[0.35em] bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Processing…' : 'Confirm Payment'}
      </button>
    </form>
  );
}

// ── Wire instructions panel ───────────────────────────────────────────────────
function WireInstructionsPanel({ instructions, orderId }: { instructions: WireInstructions; orderId: string }) {
  const addr = instructions?.financial_addresses?.[0];
  return (
    <div className="border border-zinc-200 p-8 space-y-6">
      <div>
        <p className="text-[8px] uppercase tracking-[0.5em] mb-2" style={{ color: '#c9a84c' }}>
          Wire Transfer Instructions
        </p>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Transfer funds to the account below. Your payment will be automatically matched once received — typically 1–3 business days.
        </p>
      </div>
      {addr && (
        <dl className="space-y-3 text-[11px]">
          {addr.bank_name      && <Row label="Bank"           value={addr.bank_name} />}
          {addr.routing_number && <Row label="Routing No."    value={addr.routing_number} />}
          {addr.account_number && <Row label="Account No."    value={addr.account_number} />}
          {addr.swift_code     && <Row label="SWIFT / BIC"    value={addr.swift_code} />}
          {addr.iban           && <Row label="IBAN"           value={addr.iban} />}
          <Row label="Reference" value={instructions.reference ?? addr.reference ?? orderId} highlight />
        </dl>
      )}
      {instructions.hosted_instructions_url && (
        <a
          href={instructions.hosted_instructions_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[9px] uppercase tracking-[0.4em] underline underline-offset-4"
        >
          View full instructions →
        </a>
      )}
      <div className="border-t border-zinc-100 pt-4">
        <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-400">
          Include the reference code in your transfer so we can match your payment automatically.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-400 uppercase tracking-[0.1em] min-w-[120px]">{label}</dt>
      <dd
        className="font-mono text-right"
        style={highlight ? { color: '#c9a84c', fontWeight: 600 } : { color: '#111' }}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Installment schedule preview ──────────────────────────────────────────────
function InstallmentSchedule({
  total,
  count,
  intervalDays,
}: {
  total      : number;
  count      : number;
  intervalDays: number;
}) {
  const per = total / count;
  return (
    <div className="border border-zinc-100 p-5 space-y-2">
      <p className="text-[8px] uppercase tracking-[0.4em] text-zinc-400 mb-3">Payment Schedule</p>
      {Array.from({ length: count }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + intervalDays * i);
        return (
          <div key={i} className="flex justify-between text-[11px]">
            <span className="text-zinc-500">
              {i === 0 ? 'Today' : `+${intervalDays * i} days — ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </span>
            <span className="font-mono">${per.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CheckoutClient({
  order,
  paymentTerms,
  stripePublishableKey,
}: {
  order               : Order;
  paymentTerms        : PaymentTerms;
  stripePublishableKey: string;
}) {
  // loadStripe must be stable across renders — store in a ref so it's created once
  const stripePromiseRef = useRef(loadStripe(stripePublishableKey));
  const stripePromise = stripePromiseRef.current;

  const availableMethods = paymentTerms.payment_methods;
  const [method,         setMethod]         = useState<string>(availableMethods[0] ?? 'card');
  const [flow,           setFlow]           = useState<string>(paymentTerms.flow);
  const [done,           setDone]           = useState(false);
  const [wireInstructions, setWireInstructions] = useState<WireInstructions | null>(null);
  const [wireLoading,    setWireLoading]    = useState(false);
  const [wireError,      setWireError]      = useState<string | null>(null);

  // Determine Stripe Elements payment_method_types from selected method
  const stripeMethodTypes =
    method === 'ach'  ? ['us_bank_account'] :
    method === 'wire' ? [] : // wire doesn't use Elements
    ['card'];

  const elementsOptions = stripeMethodTypes.length > 0 ? {
    mode    : 'payment' as const,
    amount  : Math.round((order.total_usd ?? 0) * 100),
    currency: 'usd',
    payment_method_types: stripeMethodTypes,
    appearance: {
      theme    : 'stripe' as const,
      variables: {
        colorPrimary      : '#000000',
        colorBackground   : '#ffffff',
        colorText         : '#111111',
        colorDanger       : '#df1b41',
        fontFamily        : 'system-ui, -apple-system, sans-serif',
        spacingUnit       : '4px',
        borderRadius      : '0px',
        fontSizeBase      : '12px',
      },
    },
  } : null;

  const handleSuccess = (result?: WireInstructions) => {
    if (result) { setWireInstructions(result); }
    setDone(true);
  };

  const handleWireSubmit = async () => {
    setWireLoading(true);
    setWireError(null);
    const res = await fetch('/api/payments/create-intent', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order_id: order.id, method: 'wire', flow }),
    });
    const data = await res.json();
    setWireLoading(false);
    if (!res.ok) { setWireError(data.error ?? 'Failed to create wire transfer'); return; }
    handleSuccess(data.instructions);
  };

  const methodLabel: Record<string, string> = {
    card: 'Credit / Debit Card',
    ach : 'ACH Bank Transfer (US)',
    wire: 'Wire / SEPA Transfer',
  };

  const flowLabel: Record<string, string> = {
    immediate   : 'Pay now',
    pay_later   : `Pay within ${paymentTerms.deadline_days ?? 30} days`,
    installments: `${paymentTerms.installment_count} instalments`,
  };

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/" style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400 }}>
            LINEZHEETS
          </a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Secure Checkout</span>
          <a href="/dashboard" className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888' }}>
            Cancel
          </a>
        </div>
      </header>

      <main className="pt-[60px]">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-20">

            {/* Left — payment form */}
            <div>
              <p className="text-[8px] uppercase tracking-[0.6em] mb-6" style={{ color: '#c9a84c' }}>
                Payment
              </p>
              <h1 style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize  : 'clamp(28px, 4vw, 48px)',
                fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.01em',
                marginBottom: '48px',
              }}>
                Complete Your Order
              </h1>

              {done && wireInstructions ? (
                <WireInstructionsPanel instructions={wireInstructions} orderId={order.id} />
              ) : done ? (
                <div className="border border-zinc-100 p-8 text-center space-y-4">
                  <p className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#c9a84c' }}>Confirmed</p>
                  <p className="text-[13px]">Your payment is being processed.</p>
                  <a href="/dashboard/orders" className="inline-block text-[9px] uppercase tracking-[0.4em] underline underline-offset-4 mt-4">
                    View orders →
                  </a>
                </div>
              ) : (
                <div className="space-y-8">

                  {/* Payment method picker */}
                  {availableMethods.length > 1 && (
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.4em] text-zinc-400 mb-3">Payment method</p>
                      <div className="flex flex-wrap gap-2">
                        {availableMethods.map(m => (
                          <button
                            key={m}
                            onClick={() => setMethod(m)}
                            className="px-5 py-2.5 text-[9px] uppercase tracking-[0.3em] border transition-colors"
                            style={{
                              borderColor: method === m ? '#000' : '#e5e5e5',
                              background : method === m ? '#000' : '#fff',
                              color      : method === m ? '#fff' : '#888',
                            }}
                          >
                            {methodLabel[m] ?? m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flow picker (if seller allows options) */}
                  {paymentTerms.flow !== 'immediate' && method !== 'wire' && (
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.4em] text-zinc-400 mb-3">Payment timing</p>
                      <div className="flex flex-wrap gap-2">
                        {(['immediate', paymentTerms.flow] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setFlow(f)}
                            className="px-5 py-2.5 text-[9px] uppercase tracking-[0.3em] border transition-colors"
                            style={{
                              borderColor: flow === f ? '#000' : '#e5e5e5',
                              background : flow === f ? '#000' : '#fff',
                              color      : flow === f ? '#fff' : '#888',
                            }}
                          >
                            {flowLabel[f]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Installment schedule preview */}
                  {flow === 'installments' && method !== 'wire' && (
                    <InstallmentSchedule
                      total={order.total_usd ?? 0}
                      count={paymentTerms.installment_count}
                      intervalDays={paymentTerms.installment_days}
                    />
                  )}

                  {/* Wire — no Elements, just submit button */}
                  {method === 'wire' ? (
                    <div className="space-y-4">
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        After confirming, you&apos;ll receive unique bank transfer instructions with a reference code. Send the wire from your bank and we&apos;ll automatically match and confirm your payment.
                      </p>
                      {wireError && (
                        <p className="text-[11px] text-red-500 tracking-[0.05em]">{wireError}</p>
                      )}
                      <button
                        onClick={handleWireSubmit}
                        disabled={wireLoading}
                        className="w-full py-4 text-[10px] uppercase tracking-[0.35em] bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                      >
                        {wireLoading ? 'Generating…' : 'Get Wire Instructions'}
                      </button>
                    </div>
                  ) : elementsOptions && (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <PaymentForm
                        orderId={order.id}
                        method={method}
                        flow={flow}
                        onSuccess={handleSuccess}
                      />
                    </Elements>
                  )}

                  {method === 'ach' && (
                    <p className="text-[9px] text-zinc-400 leading-relaxed">
                      ACH transfers take 3–5 business days to clear. Your order will be confirmed once payment settles. Instant verification powered by Stripe Financial Connections.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right — order summary */}
            <div>
              <p className="text-[8px] uppercase tracking-[0.5em] text-zinc-400 mb-6">Order Summary</p>
              <div className="border border-zinc-100 p-6 space-y-4">
                <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 pb-3 border-b border-zinc-100">
                  {order.id}
                </p>
                {(order.items ?? []).map((item, i) => (
                  <div key={i} className="flex justify-between gap-4 text-[11px]">
                    <div>
                      <p className="text-black">{item.name}</p>
                      <p className="text-zinc-400">Size {item.size} · Qty {item.quantity}</p>
                    </div>
                    <p className="font-mono whitespace-nowrap">
                      ${((item.wholesale_price ?? 0) * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
                <div className="border-t border-zinc-100 pt-4 flex justify-between">
                  <span className="text-[9px] uppercase tracking-[0.4em] text-zinc-500">Total</span>
                  <span className="text-[13px] font-mono" style={{ color: '#c9a84c' }}>
                    ${(order.total_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
