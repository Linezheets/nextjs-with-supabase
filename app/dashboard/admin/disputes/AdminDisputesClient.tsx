'use client';

import { useState, useEffect } from 'react';

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const MONO  = 'DM Mono, ui-monospace, monospace';

type Dispute = {
  id             : string;
  order_id       : string;
  raised_by      : string;
  raised_by_role : 'buyer' | 'brand';
  type           : string;
  description    : string;
  status         : string;
  resolution_notes: string | null;
  created_at     : string;
  order          : { id: string; buyer_name: string | null; total_usd: number; currency: string | null; status: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  open               : '#df1b41',
  under_review       : '#c9a84c',
  resolved_refund    : '#52b788',
  resolved_credit    : '#52b788',
  resolved_no_action : '#888',
  closed             : '#555',
};

const RESOLUTIONS = [
  { value: 'under_review',        label: 'Mark Under Review'    },
  { value: 'resolved_refund',     label: 'Approve — Refund'     },
  { value: 'resolved_credit',     label: 'Approve — Credit Note'},
  { value: 'resolved_no_action',  label: 'No Action Required'   },
  { value: 'closed',              label: 'Close Dispute'        },
];

function fmt(n: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
}

export default function AdminDisputesClient() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('open');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('under_review');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  useEffect(() => {
    setLoading(true);
    const qs = filter !== 'all' ? `?status=${filter}` : '';
    fetch(`/api/disputes${qs}`)
      .then(r => r.json())
      .then(d => {
        const list: Dispute[] = d.disputes ?? [];
        setDisputes(list);
        setLoading(false);
        // Auto-select if deep-linked from email notification
        const highlight = new URLSearchParams(window.location.search).get('highlight');
        if (highlight) {
          const found = list.find(x => x.id === highlight);
          if (found) { setSelected(found); setFilter('all'); }
        }
      })
      .catch(() => setLoading(false));
  }, [filter]);

  async function resolve() {
    if (!selected) return;
    setSaving(true);
    setErr('');
    const res = await fetch(`/api/disputes/${selected.id}`, {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ status: resolution, resolution_notes: notes || undefined }),
    });
    setSaving(false);
    const j = await res.json();
    if (!res.ok) { setErr(j.error ?? 'Failed'); return; }
    // Refresh list
    setDisputes(ds => ds.map(d => d.id === selected.id ? { ...d, status: resolution, resolution_notes: notes || null } : d));
    setSelected(null);
    setNotes('');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', fontFamily: SANS }}>
      {/* Header */}
      <div className="px-8 py-5 border-b" style={{ borderColor: '#1e1e1e' }}>
        <div className="flex items-center gap-6">
          <a href="/dashboard/admin/buyers"
             className="text-[8px] uppercase tracking-[0.4em] hover:opacity-60 transition-opacity"
             style={{ color: '#555', fontFamily: MONO }}>← Admin</a>
          <h1 style={{ fontFamily: SERIF, fontSize: '18px', color: '#fff', letterSpacing: '0.05em' }}>
            Disputes &amp; Refund Requests
          </h1>
        </div>
      </div>

      <div className="px-8 py-6" style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['open', 'under_review', 'resolved_refund', 'resolved_credit', 'resolved_no_action', 'closed', 'all'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: '5px 14px', fontSize: '8px', letterSpacing: '0.35em',
                textTransform: 'uppercase', fontFamily: SANS, cursor: 'pointer',
                background: filter === s ? GOLD : 'transparent',
                color     : filter === s ? '#000' : '#666',
                border    : `1px solid ${filter === s ? GOLD : '#333'}`,
              }}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#555', fontFamily: MONO, fontSize: '11px' }}>Loading…</p>
        ) : disputes.length === 0 ? (
          <p style={{ color: '#555', fontFamily: MONO, fontSize: '11px' }}>No disputes found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 1, background: '#1a1a1a' }}>
            {disputes.map(d => (
              <div key={d.id}
                onClick={() => { setSelected(d); setResolution('under_review'); setNotes(''); setErr(''); }}
                style={{
                  background: selected?.id === d.id ? '#1e1c17' : '#111',
                  padding: '16px 20px', cursor: 'pointer',
                  borderLeft: selected?.id === d.id ? `3px solid ${GOLD}` : '3px solid transparent',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', fontSize: '7px',
                        letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS,
                        background: (STATUS_COLORS[d.status] ?? '#555') + '22',
                        color: STATUS_COLORS[d.status] ?? '#555',
                      }}>{d.status.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '7px', color: '#555', fontFamily: MONO, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        {d.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '7px', color: '#444', fontFamily: MONO }}>
                        {d.raised_by_role}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#ccc', fontFamily: SANS, marginBottom: 2 }}>
                      Order <strong style={{ color: '#fff' }}>{d.order_id}</strong>
                      {d.order?.buyer_name && <span style={{ color: '#888' }}> · {d.order.buyer_name}</span>}
                      {d.order && <span style={{ color: GOLD, fontFamily: MONO }}> · {fmt(d.order.total_usd, d.order.currency ?? 'USD')}</span>}
                    </p>
                    <p style={{ fontSize: '10px', color: '#666', fontFamily: SANS,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>
                      {d.description}
                    </p>
                  </div>
                  <span style={{ fontSize: '8px', color: '#444', fontFamily: MONO, whiteSpace: 'nowrap' }}>
                    {new Date(d.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolution panel */}
        {selected && (
          <div style={{ marginTop: 24, background: '#141414', border: '1px solid #2a2a2a', padding: 28 }}>
            <p style={{ fontSize: '8px', color: '#555', fontFamily: MONO, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 12 }}>
              Resolve — {selected.order_id}
            </p>
            <p style={{ fontSize: '12px', color: '#ccc', fontFamily: SANS, marginBottom: 16, lineHeight: 1.6 }}>
              {selected.description}
            </p>
            {selected.resolution_notes && (
              <p style={{ fontSize: '10px', color: GOLD, fontFamily: SANS, marginBottom: 12 }}>
                Previous note: {selected.resolution_notes}
              </p>
            )}
            <select value={resolution} onChange={e => setResolution(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: '#1e1e1e',
                border: '1px solid #333', color: '#ccc', fontSize: '11px', fontFamily: SANS,
                outline: 'none', marginBottom: 12 }}>
              {RESOLUTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Resolution notes (sent to buyer/brand)…"
              rows={3}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: '#1e1e1e',
                border: '1px solid #333', color: '#ccc', fontSize: '11px', fontFamily: SANS,
                outline: 'none', resize: 'vertical', lineHeight: 1.5, marginBottom: 12, boxSizing: 'border-box' }} />
            {err && <p style={{ color: '#df1b41', fontSize: '10px', fontFamily: SANS, marginBottom: 8 }}>{err}</p>}
            {resolution === 'resolved_refund' && (
              <p style={{ fontSize: '9px', color: GOLD, fontFamily: SANS, marginBottom: 12 }}>
                ⚠ This will mark the order as refund_approved. Process the actual Stripe refund manually via the Stripe dashboard.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resolve} disabled={saving}
                style={{ padding: '10px 24px', background: saving ? '#333' : GOLD, color: '#000',
                  border: 'none', fontSize: '8px', letterSpacing: '0.35em', textTransform: 'uppercase',
                  fontFamily: SANS, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save Resolution'}
              </button>
              <button onClick={() => setSelected(null)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #333',
                  color: '#666', fontSize: '8px', cursor: 'pointer', fontFamily: SANS }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
