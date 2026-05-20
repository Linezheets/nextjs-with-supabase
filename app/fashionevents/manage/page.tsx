'use client';

import { useState, useEffect } from 'react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  fashion_week: 'Fashion Week', tradeshow: 'Tradeshow', showroom: 'Showroom',
  runway: 'Runway Show', popup: 'Pop-up', networking: 'Networking', market_week: 'Market Week',
};
const STATUS_COLORS: Record<string, string> = {
  draft: '#666', pending: '#C9A84C', approved: '#A4C47E',
  live: '#A4C47E', past: '#555', cancelled: '#C47E7E',
};

interface FashionEvent {
  id: string; title: string; type: string; city: string;
  date_start: string; date_end?: string; status: string;
  is_public: boolean; capacity?: number;
}
interface Attendee {
  id: string; user_name: string; user_email: string;
  user_type: string; company_name?: string;
  status: string; notes?: string; created_at: string; checked_in_at?: string;
}

const BLANK_FORM = {
  title: '', type: 'showroom', description: '', city: '', country: '',
  venue_name: '', address: '', date_start: '', date_end: '', time_start: '', time_end: '',
  website_url: '', capacity: '', is_public: true, host_name: '', event_tag: '', season: '',
  cover_image_url: '',
};

export default function ManagePage() {
  const [events,     setEvents]     = useState<FashionEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<string | null>(null);
  const [form,       setForm]       = useState({ ...BLANK_FORM });
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState('');
  const [attendeeEventId, setAttendeeEventId] = useState<string | null>(null);
  const [attendees,  setAttendees]  = useState<Attendee[]>([]);
  const [aLoading,   setALoading]   = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    const res = await fetch('/api/events?limit=100');
    // Also load my own drafts/pending via a separate pattern
    // For now show all events (server filters based on auth)
    const j = await res.json();
    setEvents(j.events || []);
    setLoading(false);
  };

  const loadAttendees = async (eventId: string) => {
    setAttendeeEventId(eventId);
    setALoading(true);
    const res = await fetch(`/api/events/${eventId}/attendees`);
    const j   = await res.json();
    setAttendees(j.attendees || []);
    setALoading(false);
  };

  const updateRSVP = async (eventId: string, rsvpId: string, status: string) => {
    await fetch(`/api/events/${eventId}/rsvps/${rsvpId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAttendees(eventId);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK_FORM });
    setShowForm(true);
    setMsg('');
  };

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/events/${id}`);
    const j   = await res.json();
    const e   = j.event;
    setForm({
      title: e.title || '', type: e.type || 'showroom', description: e.description || '',
      city: e.city || '', country: e.country || '', venue_name: e.venue_name || '',
      address: e.address || '', date_start: e.date_start || '', date_end: e.date_end || '',
      time_start: e.time_start || '', time_end: e.time_end || '',
      website_url: e.website_url || '',
      capacity: e.capacity ? String(e.capacity) : '',
      is_public: e.is_public !== false,
      host_name: e.host_name || '', event_tag: e.event_tag || '',
      season: e.season || '', cover_image_url: e.cover_image_url || '',
    });
    setEditing(id);
    setShowForm(true);
    setMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const url    = editing ? `/api/events/${editing}` : '/api/events';
      const method = editing ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, capacity: form.capacity ? parseInt(form.capacity) : null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setMsg(editing
        ? 'Event updated.'
        : j.status === 'approved'
          ? 'Event created and published.'
          : 'Event submitted for approval.'
      );
      setShowForm(false);
      loadEvents();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelEvent = async (id: string) => {
    if (!confirm('Cancel this event?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    loadEvents();
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
            Event Management
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '2.2rem', fontWeight: 400, color: '#F5F0E8' }}>
            My Events
          </h1>
        </div>
        <button onClick={openCreate} style={{
          background: '#C9A84C', border: 'none', color: '#07070E',
          padding: '12px 28px', cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif', fontSize: 9,
          letterSpacing: '0.4em', textTransform: 'uppercase',
        }}>
          + New Event
        </button>
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

      {/* ── Create / Edit form ─────────────────────────────────────────────── */}
      {showForm && (
        <div style={{
          background: '#0D0D1A', border: '1px solid rgba(201,168,76,0.2)',
          padding: '32px', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.4rem', fontWeight: 400, color: '#F5F0E8' }}>
              {editing ? 'Edit Event' : 'New Event'}
            </h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Title */}
              <FormField label="Event Title *" colSpan={2}>
                <input value={form.title} onChange={f('title')} required style={inputStyle} placeholder="e.g. MXLLA SS27 Showroom" />
              </FormField>
              {/* Type */}
              <FormField label="Event Type *">
                <select value={form.type} onChange={f('type')} required style={inputStyle}>
                  {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              {/* City */}
              <FormField label="City *">
                <input value={form.city} onChange={f('city')} required style={inputStyle} placeholder="Paris" />
              </FormField>
              {/* Venue */}
              <FormField label="Venue Name">
                <input value={form.venue_name} onChange={f('venue_name')} style={inputStyle} placeholder="Palais de Tokyo" />
              </FormField>
              {/* Country */}
              <FormField label="Country">
                <input value={form.country} onChange={f('country')} style={inputStyle} placeholder="France" />
              </FormField>
              {/* Date start */}
              <FormField label="Date Start *">
                <input type="date" value={form.date_start} onChange={f('date_start')} required style={inputStyle} />
              </FormField>
              {/* Date end */}
              <FormField label="Date End">
                <input type="date" value={form.date_end} onChange={f('date_end')} style={inputStyle} />
              </FormField>
              {/* Time */}
              <FormField label="Start Time">
                <input type="time" value={form.time_start} onChange={f('time_start')} style={inputStyle} />
              </FormField>
              <FormField label="End Time">
                <input type="time" value={form.time_end} onChange={f('time_end')} style={inputStyle} />
              </FormField>
              {/* Host */}
              <FormField label="Host / Brand Name">
                <input value={form.host_name} onChange={f('host_name')} style={inputStyle} placeholder="MXLLA Agency" />
              </FormField>
              {/* Season */}
              <FormField label="Season / Event Tag">
                <input value={form.event_tag} onChange={f('event_tag')} style={inputStyle} placeholder="PFW SS27" />
              </FormField>
              {/* Capacity */}
              <FormField label="Capacity (leave blank = unlimited)">
                <input type="number" value={form.capacity} onChange={f('capacity')} style={inputStyle} min={1} />
              </FormField>
              {/* Cover image */}
              <FormField label="Cover Image URL">
                <input value={form.cover_image_url} onChange={f('cover_image_url')} style={inputStyle} placeholder="https://…" />
              </FormField>
              {/* Website */}
              <FormField label="Website URL">
                <input value={form.website_url} onChange={f('website_url')} style={inputStyle} placeholder="https://…" />
              </FormField>
              {/* Description */}
              <FormField label="Description" colSpan={2}>
                <textarea value={form.description} onChange={f('description')} rows={4} style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="What should attendees expect?" />
              </FormField>
              {/* Access */}
              <FormField label="Access Type" colSpan={2}>
                <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(245,240,232,0.6)' }}>
                  <input type="checkbox" checked={form.is_public}
                    onChange={e => setForm(prev => ({ ...prev, is_public: e.target.checked }))}
                    style={{ accentColor: '#C9A84C' }} />
                  Public event (anyone can RSVP without approval)
                </label>
              </FormField>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{
                background: saving ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none',
                color: '#07070E', padding: '11px 32px', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.4em', textTransform: 'uppercase',
              }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Submit Event'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(245,240,232,0.4)', padding: '11px 20px',
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontSize: 9,
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Events list ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(201,168,76,0.4)', letterSpacing: '0.3em' }}>
          Loading…
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, fontFamily: 'system-ui', fontSize: 13, color: 'rgba(245,240,232,0.2)' }}>
          No events yet. Create your first event above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {events.map(ev => (
            <div key={ev.id}>
              <div style={{
                background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.06)',
                padding: '18px 24px',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{
                      fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.3em', textTransform: 'uppercase',
                      color: STATUS_COLORS[ev.status] || '#888',
                      border: `1px solid ${STATUS_COLORS[ev.status] || '#888'}40`,
                      padding: '2px 8px',
                    }}>
                      {ev.status}
                    </span>
                    <span style={{ fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.25)' }}>
                      {TYPE_LABELS[ev.type]}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.05rem', color: '#F5F0E8', marginBottom: 4 }}>
                    {ev.title}
                  </div>
                  <div style={{ fontFamily: 'system-ui', fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>
                    {ev.city} · {format(new Date(ev.date_start), 'MMM d, yyyy')}
                    {ev.capacity ? ` · Cap: ${ev.capacity}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn onClick={() => loadAttendees(attendeeEventId === ev.id ? (() => { setAttendeeEventId(null); return ev.id; })() : ev.id)}>
                    {attendeeEventId === ev.id ? 'Hide List' : 'Attendees'}
                  </Btn>
                  <Btn onClick={() => openEdit(ev.id)}>Edit</Btn>
                  <a href={`/fashionevents/scan/${ev.id}`} style={{ ...btnStyle, textDecoration: 'none' }}>Scan</a>
                  <Btn onClick={() => cancelEvent(ev.id)} danger>Cancel</Btn>
                </div>
              </div>

              {/* Attendee panel */}
              {attendeeEventId === ev.id && (
                <div style={{
                  background: '#080813', border: '1px solid rgba(255,255,255,0.05)',
                  borderTop: 'none', padding: '20px 24px',
                }}>
                  <p style={{ fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.25)', marginBottom: 16 }}>
                    Attendees ({attendees.length})
                  </p>
                  {aLoading ? (
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(201,168,76,0.4)' }}>Loading…</p>
                  ) : attendees.length === 0 ? (
                    <p style={{ fontFamily: 'system-ui', fontSize: 12, color: 'rgba(245,240,232,0.2)' }}>No RSVPs yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {attendees.map(a => (
                        <div key={a.id} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
                          padding: '10px 16px', background: '#0D0D1A',
                        }}>
                          <div>
                            <span style={{ fontSize: 13, color: '#F5F0E8', marginRight: 10 }}>{a.user_name || a.user_email}</span>
                            {a.company_name && <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>{a.company_name} · </span>}
                            <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)', textTransform: 'capitalize' }}>{a.user_type}</span>
                            {a.notes && <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', marginTop: 3 }}>"{a.notes}"</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{
                              fontFamily: 'system-ui', fontSize: 8, letterSpacing: '0.25em', textTransform: 'uppercase',
                              color: STATUS_COLORS[a.status] || '#888', padding: '2px 8px',
                              border: `1px solid ${STATUS_COLORS[a.status] || '#888'}30`,
                            }}>
                              {a.status.replace('_', ' ')}
                            </span>
                            {a.status === 'pending' && (
                              <>
                                <Btn onClick={() => updateRSVP(ev.id, a.id, 'approved')}>✓ Approve</Btn>
                                <Btn onClick={() => updateRSVP(ev.id, a.id, 'declined')} danger>✗ Decline</Btn>
                              </>
                            )}
                            {a.status === 'waitlisted' && (
                              <Btn onClick={() => updateRSVP(ev.id, a.id, 'approved')}>↑ Approve</Btn>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#F5F0E8', padding: '8px 12px',
  fontFamily: 'system-ui, sans-serif', fontSize: 12, outline: 'none',
};
const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(245,240,232,0.4)', padding: '5px 12px', cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif', fontSize: 9,
  letterSpacing: '0.2em', textTransform: 'uppercase',
};
function Btn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      ...btnStyle,
      color: danger ? '#C47E7E' : 'rgba(245,240,232,0.4)',
      borderColor: danger ? 'rgba(196,126,126,0.25)' : 'rgba(255,255,255,0.1)',
    }}>
      {children}
    </button>
  );
}
function FormField({ label, children, colSpan = 1 }: { label: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <div style={{ gridColumn: colSpan === 2 ? '1 / -1' : undefined }}>
      <label style={{
        fontFamily: 'system-ui, sans-serif', fontSize: 8,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: 'rgba(245,240,232,0.3)', display: 'block', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
