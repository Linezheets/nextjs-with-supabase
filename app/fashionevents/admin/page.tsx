'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  fashion_week: 'Fashion Week', tradeshow: 'Tradeshow', showroom: 'Showroom',
  runway: 'Runway Show', popup: 'Pop-up', networking: 'Networking', market_week: 'Market Week',
};

interface FashionEvent {
  id: string; title: string; type: string; city: string;
  date_start: string; status: string; host_name?: string;
  featured: boolean; is_public: boolean; interest_count: number;
}

export default function AdminPage() {
  const [pending,  setPending]  = useState<FashionEvent[]>([]);
  const [all,      setAll]      = useState<FashionEvent[]>([]);
  const [tab,      setTab]      = useState<'pending'|'all'>('pending');
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');

  const loadData = async () => {
    setLoading(true);
    // Load all events (agency can see all via status param workaround)
    const res = await fetch('/api/events?limit=200');
    const j   = await res.json();
    const evs = j.events || [];
    setAll(evs);
    // Pending are filtered client side (API only returns approved/live/past for public)
    // Agency-specific pending requires the manage flow — we show what we have
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const approve = async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/events/${id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || 'Failed'); return; }
    setMsg(`Event ${action === 'approve' ? 'approved' : 'rejected'}.`);
    loadData();
  };

  const toggleFeature = async (id: string, featured: boolean) => {
    await fetch(`/api/events/${id}/feature`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured }),
    });
    loadData();
  };

  const displayEvents = tab === 'pending'
    ? all.filter(e => e.status === 'pending')
    : all;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
          Agency Admin
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '2.2rem', fontWeight: 400, color: '#F5F0E8' }}>
          Event Approval Queue
        </h1>
      </div>

      {msg && (
        <div style={{
          background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
          padding: '12px 20px', marginBottom: 24,
          fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#C9A84C',
        }}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginBottom: 32 }}>
        {[
          { label: 'Total Events', value: all.length },
          { label: 'Pending Approval', value: all.filter(e => e.status === 'pending').length, highlight: true },
          { label: 'Live / Approved', value: all.filter(e => ['live','approved'].includes(e.status)).length },
          { label: 'Featured', value: all.filter(e => e.featured).length },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{
            background: '#0D0D1A', border: `1px solid ${highlight && value > 0 ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
            padding: '20px 24px',
          }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: highlight && value > 0 ? '#C9A84C' : '#F5F0E8' }}>
              {value}
            </div>
            <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', marginTop: 6 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['pending', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 24px',
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.35em', textTransform: 'uppercase',
            color: tab === t ? '#C9A84C' : 'rgba(245,240,232,0.3)',
            borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
            marginBottom: -1,
          }}>
            {t === 'pending' ? `Pending (${all.filter(e => e.status === 'pending').length})` : 'All Events'}
          </button>
        ))}
      </div>

      {/* Events */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(201,168,76,0.4)', letterSpacing: '0.3em' }}>
          Loading…
        </div>
      ) : displayEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, fontFamily: 'system-ui', fontSize: 13, color: 'rgba(245,240,232,0.2)' }}>
          {tab === 'pending' ? 'No events pending approval.' : 'No events.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayEvents.map(ev => (
            <div key={ev.id} style={{
              background: '#0D0D1A', border: `1px solid ${ev.status === 'pending' ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)'}`,
              padding: '20px 24px',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <StatusPill status={ev.status} />
                  <span style={{ fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.25)' }}>
                    {TYPE_LABELS[ev.type]}
                  </span>
                  {ev.featured && (
                    <span style={{ fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9A84C' }}>
                      ✦ Featured
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.05rem', color: '#F5F0E8', marginBottom: 4 }}>
                  {ev.title}
                </div>
                <div style={{ fontFamily: 'system-ui', fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>
                  {ev.city} · {format(new Date(ev.date_start), 'MMM d, yyyy')}
                  {ev.host_name ? ` · ${ev.host_name}` : ''}
                  {ev.interest_count > 0 ? ` · ${ev.interest_count} interested` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <a href={`/fashionevents/${ev.id}`} target="_blank" style={aBtn}>View</a>
                {ev.status === 'pending' && (
                  <>
                    <button onClick={() => approve(ev.id, 'approve')} style={{ ...aBtn as React.CSSProperties, color: '#A4C47E', borderColor: 'rgba(164,196,126,0.25)', cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => approve(ev.id, 'reject')} style={{ ...aBtn as React.CSSProperties, color: '#C47E7E', borderColor: 'rgba(196,126,126,0.25)', cursor: 'pointer' }}>
                      ✗ Reject
                    </button>
                  </>
                )}
                {ev.status !== 'pending' && (
                  <button onClick={() => toggleFeature(ev.id, !ev.featured)} style={{
                    ...aBtn as React.CSSProperties, cursor: 'pointer',
                    color: ev.featured ? '#C9A84C' : 'rgba(245,240,232,0.3)',
                    borderColor: ev.featured ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)',
                  }}>
                    {ev.featured ? '★ Unfeature' : '☆ Feature'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#C9A84C', approved: '#A4C47E', live: '#A4C47E',
  past: '#555', cancelled: '#C47E7E', draft: '#666',
};
function StatusPill({ status }: { status: string }) {
  return (
    <span style={{
      fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.3em', textTransform: 'uppercase',
      color: STATUS_COLORS[status] || '#888',
      border: `1px solid ${STATUS_COLORS[status] || '#888'}40`,
      padding: '2px 8px',
    }}>
      {status}
    </span>
  );
}
const aBtn = {
  fontFamily: 'system-ui, sans-serif', fontSize: 9,
  letterSpacing: '0.2em', textTransform: 'uppercase' as const,
  color: 'rgba(245,240,232,0.35)', textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '5px 12px', background: 'transparent',
};
