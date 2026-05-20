'use client';

import { useState, useEffect } from 'react';

interface EventData {
  id: string;
  title: string;
  status: string;
  is_public: boolean;
  date_start: string;
  capacity?: number;
}

interface Props {
  event: EventData;
  userId: string | null;
  userEmail: string | null;
}

const STATUS_COPY: Record<string, { label: string; color: string; desc: string }> = {
  pending:    { label: 'Request Sent',  color: '#C9A84C',  desc: 'Your request is awaiting host approval.' },
  approved:   { label: 'Approved ✓',   color: '#A4C47E',  desc: 'You\'re confirmed. Your QR pass is below.' },
  waitlisted: { label: 'Waitlisted',   color: '#7EB8C4',  desc: 'You\'re on the waitlist.' },
  declined:   { label: 'Declined',     color: '#C47E7E',  desc: 'Your RSVP was not approved for this event.' },
  checked_in: { label: 'Checked In ✓', color: '#A4C47E',  desc: 'You have checked in to this event.' },
};

export default function RSVPSection({ event, userId, userEmail }: Props) {
  const [rsvp,        setRsvp]        = useState<any>(null);
  const [qrDataUrl,   setQrDataUrl]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [interested,  setInterested]  = useState(false);
  const [intCount,    setIntCount]    = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [userName,    setUserName]    = useState('');
  const [company,     setCompany]     = useState('');
  const [userType,    setUserType]    = useState('buyer');
  const [notes,       setNotes]       = useState('');
  const [message,     setMessage]     = useState('');

  const isPast = event.date_start && new Date(event.date_start) < new Date();
  const isOpen = ['approved','live'].includes(event.status) && !isPast;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/events/${event.id}/my-rsvp`).then(r => r.json()),
      fetch(`/api/events/${event.id}/interest`).then(r => r.json()),
    ]).then(([rsvpJson, intJson]) => {
      setRsvp(rsvpJson.rsvp);
      setQrDataUrl(rsvpJson.rsvp?.qr_data_url || null);
      setInterested(intJson.my_interest);
      setIntCount(intJson.count);
      setLoading(false);
    });
  }, [event.id, userId]);

  useEffect(() => {
    if (!userId) {
      fetch(`/api/events/${event.id}/interest`).then(r => r.json()).then(j => setIntCount(j.count));
    }
  }, [event.id, userId]);

  const handleInterest = async () => {
    if (!userId) { window.location.href = `/login?next=/fashionevents/${event.id}`; return; }
    const res = await fetch(`/api/events/${event.id}/interest`, { method: 'POST' });
    const j   = await res.json();
    setInterested(j.interested);
    setIntCount(c => j.interested ? c + 1 : c - 1);
  };

  const handleRSVP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { window.location.href = `/login?next=/fashionevents/${event.id}`; return; }
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName, company_name: company, user_type: userType, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRsvp(json.rsvp);
      setShowForm(false);
      if (json.rsvp?.status === 'approved') {
        // Reload to get QR
        const r2 = await fetch(`/api/events/${event.id}/my-rsvp`);
        const j2 = await r2.json();
        setQrDataUrl(j2.rsvp?.qr_data_url || null);
        setMessage('You\'re approved! Your QR pass is ready.');
      } else if (json.rsvp?.status === 'waitlisted') {
        setMessage('Event is at capacity — you\'ve been added to the waitlist.');
      } else {
        setMessage('Your request has been sent. You\'ll be notified when approved.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const statusInfo = rsvp ? STATUS_COPY[rsvp.status] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Interest button ─────────────────────────────────────────────── */}
      <div style={{
        background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={handleInterest} style={{
          flex: 1, padding: '10px 0',
          background: interested ? 'rgba(201,168,76,0.12)' : 'transparent',
          border: `1px solid ${interested ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: interested ? '#C9A84C' : 'rgba(245,240,232,0.4)',
          fontFamily: 'system-ui, sans-serif', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {interested ? '★ Interested' : '☆ Mark Interest'}
        </button>
        {intCount > 0 && (
          <span style={{
            fontFamily: 'DM Mono, monospace', fontSize: 11,
            color: 'rgba(245,240,232,0.25)',
          }}>
            {intCount}
          </span>
        )}
      </div>

      {/* ── RSVP state ──────────────────────────────────────────────────── */}
      {rsvp && statusInfo ? (
        <div style={{
          background: '#0D0D1A', border: `1px solid ${statusInfo.color}30`,
          padding: '24px 28px',
        }}>
          <div style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.35em', textTransform: 'uppercase',
            color: statusInfo.color, marginBottom: 8,
          }}>
            {statusInfo.label}
          </div>
          <p style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 12,
            color: 'rgba(245,240,232,0.45)', marginBottom: 0,
          }}>
            {statusInfo.desc}
          </p>
        </div>
      ) : isOpen ? (
        !showForm ? (
          <button onClick={() => {
            if (!userId) { window.location.href = `/login?next=/fashionevents/${event.id}`; return; }
            setShowForm(true);
          }} style={{
            background: '#C9A84C', border: 'none',
            color: '#07070E', padding: '16px',
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.4em', textTransform: 'uppercase',
            cursor: 'pointer', width: '100%',
          }}>
            {event.is_public ? 'RSVP Now' : 'Request Invite'}
          </button>
        ) : (
          <form onSubmit={handleRSVP} style={{
            background: '#0D0D1A', border: '1px solid rgba(201,168,76,0.2)',
            padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <p style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.4em', textTransform: 'uppercase',
              color: 'rgba(245,240,232,0.3)', marginBottom: 4,
            }}>
              {event.is_public ? 'RSVP' : 'Request Invite'}
            </p>
            {[
              { id: 'userName', label: 'Full Name', value: userName, set: setUserName, required: true, type: 'text' },
              { id: 'company', label: 'Company / Brand', value: company, set: setCompany, required: false, type: 'text' },
            ].map(({ id, label, value, set, required, type }) => (
              <div key={id}>
                <label style={{
                  fontFamily: 'system-ui, sans-serif', fontSize: 8,
                  letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: 'rgba(245,240,232,0.35)', display: 'block', marginBottom: 5,
                }}>
                  {label}{required && ' *'}
                </label>
                <input
                  type={type} value={value} onChange={e => set(e.target.value)} required={required}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#F5F0E8', padding: '8px 12px',
                    fontFamily: 'system-ui, sans-serif', fontSize: 12, outline: 'none',
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 8,
                letterSpacing: '0.3em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.35)', display: 'block', marginBottom: 5,
              }}>
                Attending as
              </label>
              <select value={userType} onChange={e => setUserType(e.target.value)} style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.1)',
                color: '#F5F0E8', padding: '8px 12px',
                fontFamily: 'system-ui, sans-serif', fontSize: 12, outline: 'none',
              }}>
                <option value="buyer">Buyer</option>
                <option value="brand">Brand</option>
                <option value="press">Press</option>
                <option value="host">Host</option>
                <option value="general">General</option>
              </select>
            </div>
            {!event.is_public && (
              <div>
                <label style={{
                  fontFamily: 'system-ui, sans-serif', fontSize: 8,
                  letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: 'rgba(245,240,232,0.35)', display: 'block', marginBottom: 5,
                }}>
                  Why do you want to attend?
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F5F0E8', padding: '8px 12px',
                  fontFamily: 'system-ui, sans-serif', fontSize: 12, outline: 'none',
                  resize: 'vertical',
                }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={submitting} style={{
                flex: 1, padding: '10px',
                background: submitting ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                border: 'none', color: '#07070E', cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.35em', textTransform: 'uppercase',
              }}>
                {submitting ? 'Sending…' : 'Submit'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                padding: '10px 16px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(245,240,232,0.4)', cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
              }}>
                ✕
              </button>
            </div>
          </form>
        )
      ) : null}

      {/* ── Status message ──────────────────────────────────────────────── */}
      {message && (
        <div style={{
          background: 'rgba(201,168,76,0.08)',
          border: '1px solid rgba(201,168,76,0.2)',
          padding: '14px 20px',
          fontFamily: 'system-ui, sans-serif', fontSize: 12,
          color: 'rgba(245,240,232,0.7)',
        }}>
          {message}
        </div>
      )}

      {/* ── QR Code ─────────────────────────────────────────────────────── */}
      {qrDataUrl && (
        <div style={{
          background: '#0D0D1A', border: '1px solid rgba(164,196,126,0.2)',
          padding: '28px', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 8,
            letterSpacing: '0.4em', textTransform: 'uppercase',
            color: '#A4C47E', marginBottom: 20,
          }}>
            Your Event Pass
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Event QR Pass"
            style={{ width: 200, height: 200, display: 'block', margin: '0 auto 16px' }} />
          <p style={{
            fontFamily: 'DM Mono, monospace', fontSize: 9,
            color: 'rgba(245,240,232,0.25)', letterSpacing: '0.1em',
          }}>
            Present at entry for check-in
          </p>
          <a href={qrDataUrl} download="event-pass.png" style={{
            display: 'inline-block', marginTop: 14,
            fontFamily: 'system-ui, sans-serif', fontSize: 8,
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color: '#C9A84C', textDecoration: 'none',
            borderBottom: '1px solid rgba(201,168,76,0.3)',
          }}>
            Download Pass
          </a>
        </div>
      )}

      {!userId && isOpen && (
        <div style={{
          background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.06)',
          padding: '20px', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 12,
            color: 'rgba(245,240,232,0.35)', marginBottom: 14,
          }}>
            Sign in to RSVP or express interest
          </p>
          <a href={`/login?next=/fashionevents/${event.id}`} style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.35em', textTransform: 'uppercase',
            color: '#C9A84C', textDecoration: 'none',
            border: '1px solid rgba(201,168,76,0.3)',
            padding: '8px 20px', display: 'inline-block',
          }}>
            Sign In →
          </a>
        </div>
      )}
    </div>
  );
}
