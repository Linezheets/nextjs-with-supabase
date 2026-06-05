'use client';

import { useState } from 'react';

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

type Payment = { id: string; installment_seq: number; amount_usd: number; amount?: number; currency?: string; status: string; due_date: string; method: string };
type Order   = { id: string; status: string; payment_status: string; total_usd: number; currency?: string; items: Record<string,unknown>[]; buyer_name: string | null; notes: string | null; created_at: string; [key: string]: unknown };

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  new        : { bg: '#f5f5f5',  color: '#888'    },
  confirmed  : { bg: '#fff8e1',  color: GOLD      },
  processing : { bg: '#e8f4ff',  color: '#1a73e8' },
  shipped    : { bg: '#f0faf4',  color: '#2d7a4f' },
  delivered  : { bg: '#f0faf4',  color: '#2d7a4f' },
  cancelled  : { bg: '#fff0f0',  color: '#c0392b' },
  paid       : { bg: '#f0faf4',  color: '#2d7a4f' },
  unpaid     : { bg: '#f5f5f5',  color: '#888'    },
};

const ORDER_STATUSES = ['confirmed','processing','shipped','delivered','cancelled'];
const PAYMENT_BADGE: Record<string, { bg: string; color: string }> = {
  succeeded: { bg: '#f0faf4', color: '#2d7a4f' },
  pending  : { bg: '#fff8e1', color: GOLD      },
  failed   : { bg: '#fff0f0', color: '#c0392b' },
  processing: { bg: '#e8f4ff', color: '#1a73e8' },
};

export default function OrderDetailClient({
  order: initialOrder,
  payments,
  isBrand,
  brandName,
}: {
  order    : Record<string, unknown>;
  payments : Record<string, unknown>[];
  isBrand  : boolean;
  brandName: string | null;
}) {
  const [order, setOrder]   = useState<Order>(initialOrder as Order);
  const [newStatus, setNew] = useState(order.status);
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');
  const [tab, setTab]               = useState<'details' | 'payments'>('details');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeType, setDisputeType] = useState('dispute');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeSaving, setDisputeSaving] = useState(false);
  const [disputeDone, setDisputeDone]     = useState(false);

  const orderCurrency = order.currency ?? 'USD';
  const fmt = (n: number, cur?: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur ?? orderCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  async function updateStatus() {
    if (newStatus === order.status) return;
    setSaving(true);
    setErr('');
    const res  = await fetch(`/api/orders/${order.id}/status`, {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(json.error); return; }
    setOrder(o => ({ ...o, status: newStatus }));
  }

  async function raiseDispute() {
    if (disputeDesc.trim().length < 20) return;
    setDisputeSaving(true);
    const res = await fetch('/api/disputes', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ order_id: order.id, type: disputeType, description: disputeDesc }),
    });
    setDisputeSaving(false);
    if (res.ok) { setDisputeDone(true); setDisputeOpen(false); }
    else { const j = await res.json(); setErr(j.error ?? 'Failed to submit'); }
  }

  async function addTracking() {
    if (!tracking) return;
    setSaving(true);
    setErr('');
    const res  = await fetch(`/api/orders/${order.id}/tracking`, {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ tracking_number: tracking, carrier }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(json.error); return; }
    setOrder(o => ({ ...o, status: 'shipped', notes: json.order?.notes ?? o.notes }));
    setTracking('');
    setCarrier('');
  }

  async function chargeInstallment(paymentId: string) {
    const res  = await fetch(`/api/payments/charge-installment/${paymentId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    alert(`Payment ${json.payment_intent_status === 'succeeded' ? 'succeeded' : 'processing'} — ${fmt(json.amount)}`);
    window.location.reload();
  }

  const statusBadge  = STATUS_BADGE[order.status]         ?? STATUS_BADGE.new;
  const payBadge     = STATUS_BADGE[order.payment_status] ?? STATUS_BADGE.unpaid;
  const brandItems   = isBrand && brandName
    ? (order.items ?? []).filter(i => i.brand_name === brandName)
    : (order.items ?? []);

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <a href={isBrand ? '/dashboard/brand-store/orders' : '/dashboard/orders'}
          style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', textDecoration: 'none' }}>
          ← Back to Orders
        </a>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 4 }}>Order</p>
            <h1 style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 400, color: '#111' }}>{order.id}</h1>
            <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888', marginTop: 4 }}>
              {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {order.buyer_name && ` · ${order.buyer_name}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ ...statusBadge, padding: '5px 14px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>{order.status}</span>
            <span style={{ ...payBadge,    padding: '5px 14px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>{order.payment_status ?? 'unpaid'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 64px' }}>
        {['details','payments'].map(t => (
          <button key={t} onClick={() => setTab(t as 'details' | 'payments')}
            style={{ background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${GOLD}` : '2px solid transparent',
              padding: '16px 0', marginRight: 32, fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em',
              textTransform: 'uppercase', cursor: 'pointer', color: tab === t ? '#111' : '#888' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '32px 64px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
        {/* Main content */}
        <div>
          {tab === 'details' && (
            <>
              {/* Items */}
              <div style={{ background: '#fff', marginBottom: 24 }}>
                <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', padding: '16px 20px 0' }}>Items</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {['Product','Colour/Size','Qty','Price'].map(h => (
                        <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brandItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #fafafa' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {item.image_url ? <img src={String(item.image_url)} alt={String(item.title ?? '')} style={{ width: 36, height: 36, objectFit: 'cover' }} /> : null}
                            <span style={{ fontFamily: SERIF, fontSize: '13px', color: '#111' }}>{String(item.title ?? item.product_name ?? '')}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: SANS, fontSize: '12px', color: '#666' }}>
                          {[item.colour, item.size].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: MONO, fontSize: '13px', color: '#111' }}>
                          {item.qty as number ?? item.total_qty as number ?? item.quantity as number ?? 1}
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: MONO, fontSize: '13px', color: '#111' }}>
                          {fmt(Number(item.wholesale_price ?? item.wsp_usd ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                  <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Total</span>
                  <span style={{ fontFamily: MONO, fontSize: '18px', color: '#111' }}>{fmt(order.total_usd)}</span>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div style={{ background: '#fff', padding: '20px', marginBottom: 24 }}>
                  <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>Notes</p>
                  <p style={{ fontFamily: SANS, fontSize: '12px', color: '#666', whiteSpace: 'pre-line' }}>{order.notes}</p>
                </div>
              )}
            </>
          )}

          {tab === 'payments' && (
            <div style={{ background: '#fff' }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', padding: '16px 20px 0' }}>Payment Schedule</p>
              {payments.length === 0 ? (
                <p style={{ padding: 20, fontFamily: SANS, fontSize: '12px', color: '#bbb' }}>No payment records found.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {['#','Amount','Due Date','Method','Status',''].map(h => (
                        <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(payments as Payment[]).map(p => {
                      const pb = PAYMENT_BADGE[p.status] ?? PAYMENT_BADGE.pending;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #fafafa' }}>
                          <td style={{ padding: '12px 20px', fontFamily: MONO, fontSize: '12px', color: '#888' }}>{p.installment_seq}</td>
                          <td style={{ padding: '12px 20px', fontFamily: MONO, fontSize: '14px', color: '#111' }}>{fmt(p.amount ?? p.amount_usd, p.currency)}</td>
                          <td style={{ padding: '12px 20px', fontFamily: SANS, fontSize: '12px', color: '#666' }}>
                            {p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 20px', fontFamily: SANS, fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>{p.method}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ ...pb, padding: '3px 10px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>{p.status}</span>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            {!isBrand && p.status === 'pending' && (
                              <button onClick={() => chargeInstallment(p.id)}
                                style={{ background: '#111', color: '#fff', border: 'none', padding: '6px 14px', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>
                                Pay now
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Sidebar — brand actions */}
        {isBrand && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', padding: 24 }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 16 }}>Update Status</p>
              {err && <p style={{ color: '#df1b41', fontFamily: SANS, fontSize: '11px', marginBottom: 12 }}>{err}</p>}
              <select value={newStatus} onChange={e => setNew(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, outline: 'none', marginBottom: 12 }}>
                {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={updateStatus} disabled={saving || newStatus === order.status}
                style={{ width: '100%', padding: '10px 0', background: saving || newStatus === order.status ? '#f5f5f5' : '#111',
                  color: saving || newStatus === order.status ? '#aaa' : '#fff', border: 'none',
                  fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : 'Update'}
              </button>
            </div>

            <div style={{ background: '#fff', padding: 24 }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 16 }}>Add Tracking</p>
              <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
              <input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Carrier (optional)"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
              <button onClick={addTracking} disabled={saving || !tracking}
                style={{ width: '100%', padding: '10px 0', background: !tracking ? '#f5f5f5' : '#111',
                  color: !tracking ? '#aaa' : '#fff', border: 'none',
                  fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: !tracking ? 'default' : 'pointer' }}>
                Mark Shipped
              </button>
            </div>

            <a href={`/api/orders/${order.id}/invoice`} target="_blank"
              style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '12px 0', textAlign: 'center',
                fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#666', textDecoration: 'none' }}>
              Download Invoice PDF
            </a>

            {/* ── Dispute / Refund Request (buyer-side only) ── */}
            {!isBrand && (
              <div style={{ background: '#fff', padding: 24 }}>
                <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', marginBottom: 16 }}>
                  Issue or Dispute
                </p>
                {disputeDone ? (
                  <p style={{ fontSize: '11px', color: '#2d7a4f', fontFamily: SANS }}>
                    ✓ Request submitted — our team will be in touch within 2 business days.
                  </p>
                ) : !disputeOpen ? (
                  <button onClick={() => setDisputeOpen(true)}
                    style={{ width: '100%', padding: '10px 0', background: '#fff', border: '1px solid #e5e5e5',
                      color: '#888', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Raise a dispute or refund request
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select value={disputeType} onChange={e => setDisputeType(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '11px', fontFamily: SANS, outline: 'none' }}>
                      <option value="dispute">Dispute (general issue)</option>
                      <option value="refund_request">Refund Request</option>
                      <option value="return_request">Return Request</option>
                      <option value="credit_note_request">Credit Note Request</option>
                    </select>
                    <textarea
                      value={disputeDesc}
                      onChange={e => setDisputeDesc(e.target.value)}
                      placeholder="Describe the issue in detail (minimum 20 characters)…"
                      rows={4}
                      style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS,
                        outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
                    />
                    <p style={{ fontSize: '9px', color: '#bbb', fontFamily: SANS }}>
                      Refunds in wholesale are reviewed case-by-case. Our team will respond within 2 business days.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={raiseDispute}
                        disabled={disputeSaving || disputeDesc.trim().length < 20}
                        style={{ flex: 1, padding: '10px 0', background: disputeDesc.trim().length < 20 ? '#f5f5f5' : '#111',
                          color: disputeDesc.trim().length < 20 ? '#aaa' : '#fff', border: 'none',
                          fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
                          cursor: disputeDesc.trim().length < 20 ? 'default' : 'pointer' }}>
                        {disputeSaving ? 'Submitting…' : 'Submit'}
                      </button>
                      <button onClick={() => { setDisputeOpen(false); setDisputeDesc(''); }}
                        style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e5e5e5',
                          color: '#888', fontFamily: SANS, fontSize: '9px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
