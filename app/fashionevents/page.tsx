'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, isPast, isFuture } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FashionEvent {
  id: string;
  title: string;
  type: string;
  city: string;
  country?: string;
  venue_name?: string;
  lat?: number;
  lng?: number;
  date_start: string;
  date_end?: string;
  time_start?: string;
  cover_image_url?: string;
  is_public: boolean;
  status: string;
  host_name?: string;
  event_tag?: string;
  season?: string;
  featured: boolean;
  capacity?: number;
  interest_count: number;
}

const TYPE_LABELS: Record<string, string> = {
  fashion_week: 'Fashion Week',
  tradeshow: 'Tradeshow',
  showroom: 'Showroom',
  runway: 'Runway Show',
  popup: 'Pop-up',
  networking: 'Networking',
  market_week: 'Market Week',
};

const TYPE_COLORS: Record<string, string> = {
  fashion_week: '#C9A84C',
  runway: '#B87EAA',
  tradeshow: '#7EB8C4',
  showroom: '#A4C47E',
  popup: '#C4977E',
  networking: '#7E9BC4',
  market_week: '#C4BC7E',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EventCard({ event }: { event: FashionEvent }) {
  const color  = TYPE_COLORS[event.type] || '#C9A84C';
  const isPastEvent = event.date_start && isPast(new Date(event.date_end || event.date_start));

  return (
    <Link href={`/fashionevents/${event.id}`} style={{ textDecoration: 'none' }}>
      <article style={{
        background: '#0D0D1A',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: 'pointer',
        opacity: isPastEvent ? 0.6 : 1,
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.3)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Cover image or placeholder */}
        <div style={{
          height: 180, background: '#111120', position: 'relative', overflow: 'hidden',
        }}>
          {event.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.cover_image_url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7)' }} />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${color}18 0%, #07070E 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 40, opacity: 0.15 }}>◈</span>
            </div>
          )}

          {/* Type badge */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(7,7,14,0.85)',
            border: `1px solid ${color}40`,
            padding: '3px 10px',
            fontFamily: 'system-ui, sans-serif', fontSize: 8,
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color,
          }}>
            {TYPE_LABELS[event.type] || event.type}
          </div>

          {event.featured && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.4)',
              padding: '3px 10px',
              fontFamily: 'system-ui, sans-serif', fontSize: 8,
              letterSpacing: '0.3em', textTransform: 'uppercase',
              color: '#C9A84C',
            }}>
              Featured
            </div>
          )}

          {isPastEvent && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(7,7,14,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.4em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.3)',
              }}>Past Event</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px 20px' }}>
          <h3 style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '1.1rem', fontWeight: 400, color: '#F5F0E8',
            marginBottom: 8, lineHeight: 1.2,
          }}>
            {event.title}
          </h3>

          <p style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 11,
            color: 'rgba(245,240,232,0.5)', marginBottom: 12,
          }}>
            {event.venue_name ? `${event.venue_name} · ` : ''}{event.city}
            {event.country ? `, ${event.country}` : ''}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10,
              color: color,
            }}>
              {format(new Date(event.date_start), 'MMM d')}
              {event.date_end && event.date_end !== event.date_start
                ? ` – ${format(new Date(event.date_end), 'MMM d, yyyy')}`
                : `, ${format(new Date(event.date_start), 'yyyy')}`}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {event.interest_count > 0 && (
                <span style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 9,
                  color: 'rgba(245,240,232,0.3)',
                }}>
                  {event.interest_count} interested
                </span>
              )}
              <span style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.25em', textTransform: 'uppercase',
                color: event.is_public ? 'rgba(164,196,126,0.7)' : 'rgba(201,168,76,0.6)',
              }}>
                {event.is_public ? 'Open' : 'Invite'}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FashionEventsPage() {
  const [events,   setEvents]   = useState<FashionEvent[]>([]);
  const [featured, setFeatured] = useState<FashionEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'grid'|'list'|'calendar'|'map'>('grid');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [futureOnly, setFutureOnly] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '60' });
    if (typeFilter) params.set('type', typeFilter);
    if (cityFilter) params.set('city', cityFilter);
    if (futureOnly) params.set('from', new Date().toISOString().slice(0, 10));

    const res = await fetch(`/api/events?${params}`);
    const json = await res.json();
    setEvents(json.events || []);
    setLoading(false);
  }, [typeFilter, cityFilter, futureOnly]);

  useEffect(() => {
    // Load featured separately
    fetch('/api/events?featured=1&limit=3')
      .then(r => r.json())
      .then(j => setFeatured(j.events || []));
    loadEvents();
  }, [loadEvents]);

  const cities = [...new Set(events.map(e => e.city))].slice(0, 12);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 32px 60px',
        maxWidth: 1280, margin: '0 auto',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <p style={{
          fontSize: 9, letterSpacing: '0.7em', textTransform: 'uppercase',
          color: '#C9A84C', marginBottom: 20,
        }}>
          Global Fashion Calendar
        </p>
        <h1 style={{
          fontFamily: 'var(--font-serif), Georgia, serif',
          fontSize: 'clamp(2.8rem, 6vw, 5.5rem)',
          fontWeight: 400, lineHeight: 0.95, letterSpacing: '-0.01em',
          color: '#F5F0E8', marginBottom: 28,
        }}>
          Fashion Events<br />
          <em style={{ color: 'rgba(245,240,232,0.25)', fontStyle: 'italic' }}>Worldwide</em>
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(245,240,232,0.45)', maxWidth: 520, lineHeight: 1.8 }}>
          Discover fashion weeks, runway shows, tradeshows, and brand showrooms.
          RSVP, collect your QR pass, and connect with the industry.
        </p>

        <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/fashionevents/manage" style={{
            padding: '10px 28px', background: '#C9A84C',
            color: '#07070E', textDecoration: 'none',
            fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase',
          }}>
            Post an Event
          </Link>
          <Link href="#events" style={{
            padding: '10px 28px',
            border: '1px solid rgba(245,240,232,0.15)',
            color: 'rgba(245,240,232,0.6)', textDecoration: 'none',
            fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase',
          }}>
            Browse All
          </Link>
        </div>
      </section>

      {/* ── Featured Events ───────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section style={{
          maxWidth: 1280, margin: '0 auto', padding: '56px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <p style={{
            fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase',
            color: 'rgba(245,240,232,0.3)', marginBottom: 28,
          }}>
            Featured
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 2 }}>
            {featured.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {/* ── Filter + View toggle ──────────────────────────────────────────── */}
      <section id="events" style={{
        maxWidth: 1280, margin: '0 auto', padding: '40px 32px 24px',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.1)',
            color: '#F5F0E8', padding: '8px 14px',
            fontFamily: 'system-ui, sans-serif', fontSize: 10,
            letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* City filter */}
        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          style={{
            background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.1)',
            color: '#F5F0E8', padding: '8px 14px',
            fontFamily: 'system-ui, sans-serif', fontSize: 10,
            letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Future only toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(245,240,232,0.4)',
        }}>
          <input type="checkbox" checked={futureOnly} onChange={e => setFutureOnly(e.target.checked)}
            style={{ accentColor: '#C9A84C' }} />
          Upcoming only
        </label>

        <div style={{ flex: 1 }} />

        {/* View toggle */}
        {(['grid','list','calendar','map'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? 'rgba(201,168,76,0.15)' : 'transparent',
            border: `1px solid ${view === v ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: view === v ? '#C9A84C' : 'rgba(245,240,232,0.3)',
            padding: '7px 16px', cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.3em', textTransform: 'uppercase',
          }}>
            {v === 'grid' ? '⊞' : v === 'list' ? '≡' : v === 'calendar' ? '▦' : '◎'} {v}
          </button>
        ))}

        <span style={{
          fontFamily: 'DM Mono, monospace', fontSize: 10,
          color: 'rgba(245,240,232,0.2)',
        }}>
          {events.length} events
        </span>
      </section>

      {/* ── Events output ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 80px' }}>
        {loading ? (
          <div style={{
            padding: 80, textAlign: 'center',
            fontFamily: 'DM Mono, monospace', fontSize: 10,
            color: 'rgba(201,168,76,0.4)', letterSpacing: '0.3em',
          }}>
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div style={{
            padding: 80, textAlign: 'center',
            fontFamily: 'DM Mono, monospace', fontSize: 10,
            color: 'rgba(245,240,232,0.2)', letterSpacing: '0.2em',
          }}>
            No events found. <Link href="/fashionevents/manage"
              style={{ color: '#C9A84C', textDecoration: 'none' }}>Post one →</Link>
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 2 }}>
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {events.map(e => (
              <Link key={e.id} href={`/fashionevents/${e.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#0D0D1A',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '16px 24px',
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr auto auto',
                  gap: 24, alignItems: 'center',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={el => (el.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)')}
                  onMouseLeave={el => (el.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
                >
                  <div style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 10,
                    color: TYPE_COLORS[e.type] || '#C9A84C',
                  }}>
                    {format(new Date(e.date_start), 'dd MMM yyyy')}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-serif), Georgia, serif',
                      fontSize: '1rem', color: '#F5F0E8', marginBottom: 3,
                    }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>
                      {e.venue_name ? `${e.venue_name} · ` : ''}{e.city}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'system-ui, sans-serif', fontSize: 8,
                    letterSpacing: '0.3em', textTransform: 'uppercase',
                    color: TYPE_COLORS[e.type] || '#C9A84C',
                    padding: '3px 10px', border: `1px solid ${TYPE_COLORS[e.type] || '#C9A84C'}30`,
                  }}>
                    {TYPE_LABELS[e.type] || e.type}
                  </div>
                  <div style={{
                    fontFamily: 'system-ui, sans-serif', fontSize: 9,
                    color: 'rgba(245,240,232,0.25)',
                  }}>
                    {e.interest_count > 0 ? `${e.interest_count} interested` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : view === 'calendar' ? (
          <CalendarView events={events} />
        ) : (
          /* ── Map View ── */
          <MapView events={events} />
        )}
      </section>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ events }: { events: FashionEvent[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today    = new Date();
  const baseDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year     = baseDate.getFullYear();
  const month    = baseDate.getMonth(); // 0-based

  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = baseDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Group events by date_start (within this month)
  const byDay: Record<number, FashionEvent[]> = {};
  for (const e of events) {
    if (!e.date_start) continue;
    const d = new Date(e.date_start + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e);
    }
    // Also mark days within a multi-day event range
    if (e.date_end && e.date_end !== e.date_start) {
      const end = new Date(e.date_end + 'T00:00:00');
      const start = new Date(e.date_start + 'T00:00:00');
      for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
        if (t.getFullYear() === year && t.getMonth() === month) {
          const day = t.getDate();
          if (!byDay[day]) byDay[day] = [];
          if (!byDay[day].find(ev => ev.id === e.id)) byDay[day].push(e);
        }
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div>
      {/* Month nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        marginBottom: 24, paddingTop: 8,
      }}>
        <button onClick={() => setMonthOffset(o => o - 1)} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(245,240,232,0.5)', padding: '6px 14px', cursor: 'pointer',
          fontFamily: 'DM Mono, monospace', fontSize: 12,
        }}>←</button>
        <span style={{
          fontFamily: 'var(--font-serif), Georgia, serif',
          fontSize: '1.3rem', color: '#F5F0E8', minWidth: 220, textAlign: 'center',
        }}>{monthName}</span>
        <button onClick={() => setMonthOffset(o => o + 1)} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(245,240,232,0.5)', padding: '6px 14px', cursor: 'pointer',
          fontFamily: 'DM Mono, monospace', fontSize: 12,
        }}>→</button>
        <button onClick={() => setMonthOffset(0)} style={{
          background: 'transparent', border: '1px solid rgba(201,168,76,0.2)',
          color: '#C9A84C', padding: '6px 14px', cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
        }}>Today</button>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Day labels */}
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            padding: '10px 12px',
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(245,240,232,0.2)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>{d}</div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayEvents = day ? (byDay[day] || []) : [];

          return (
            <div key={i} style={{
              minHeight: 90,
              background: day ? '#0A0A17' : '#07070E',
              borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              padding: '8px 10px',
              position: 'relative',
              opacity: day ? 1 : 0.3,
            }}>
              {day && (
                <div style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 10,
                  color: isToday ? '#C9A84C' : 'rgba(245,240,232,0.25)',
                  marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {isToday ? (
                    <span style={{
                      background: '#C9A84C', color: '#07070E',
                      borderRadius: '50%', width: 18, height: 18,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>{day}</span>
                  ) : day}
                </div>
              )}
              {/* Event pills — max 3, then +N */}
              {dayEvents.slice(0, 3).map(e => {
                const color = TYPE_COLORS[e.type] || '#C9A84C';
                return (
                  <Link key={e.id} href={`/fashionevents/${e.id}`}
                    style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                    <div style={{
                      background: `${color}18`,
                      borderLeft: `2px solid ${color}`,
                      padding: '2px 6px',
                      fontSize: 9, color: '#F5F0E8',
                      fontFamily: 'system-ui, sans-serif',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={el => (el.currentTarget.style.background = `${color}30`)}
                      onMouseLeave={el => (el.currentTarget.style.background = `${color}18`)}
                    >
                      {e.title}
                    </div>
                  </Link>
                );
              })}
              {dayEvents.length > 3 && (
                <div style={{
                  fontSize: 9, color: 'rgba(245,240,232,0.3)',
                  fontFamily: 'DM Mono, monospace', marginTop: 2,
                }}>+{dayEvents.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Timetable: upcoming events this month sorted by date */}
      {Object.keys(byDay).length > 0 && (
        <div style={{ marginTop: 40 }}>
          <p style={{
            fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase',
            color: 'rgba(245,240,232,0.2)', marginBottom: 16,
          }}>
            {monthName} — Timetable
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Object.entries(byDay)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, dayEvs]) => {
                const uniqueEvs = dayEvs.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
                return uniqueEvs.map(e => {
                  const color = TYPE_COLORS[e.type] || '#C9A84C';
                  return (
                    <Link key={`${day}-${e.id}`} href={`/fashionevents/${e.id}`}
                      style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '56px 8px 1fr auto',
                        gap: 16, alignItems: 'center',
                        padding: '12px 20px',
                        background: '#0A0A17',
                        border: '1px solid rgba(255,255,255,0.04)',
                        transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={el => (el.currentTarget.style.borderColor = `${color}30`)}
                        onMouseLeave={el => (el.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
                      >
                        <div style={{
                          fontFamily: 'DM Mono, monospace', fontSize: 11,
                          color: color, textAlign: 'right',
                        }}>{String(day).padStart(2, '0')}</div>
                        <div style={{ width: 2, alignSelf: 'stretch', background: `${color}40` }} />
                        <div>
                          <div style={{
                            fontFamily: 'var(--font-serif), Georgia, serif',
                            fontSize: '0.95rem', color: '#F5F0E8',
                          }}>{e.title}</div>
                          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', marginTop: 2 }}>
                            {e.city}{e.country ? `, ${e.country}` : ''}
                            {e.venue_name ? ` · ${e.venue_name}` : ''}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 8, letterSpacing: '0.3em', textTransform: 'uppercase',
                          color, padding: '3px 8px',
                          border: `1px solid ${color}30`,
                          fontFamily: 'system-ui, sans-serif',
                          whiteSpace: 'nowrap',
                        }}>{TYPE_LABELS[e.type] || e.type}</div>
                      </div>
                    </Link>
                  );
                });
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Map View (lazy-loads Leaflet) ─────────────────────────────────────────────
function MapView({ events }: { events: FashionEvent[] }) {
  useEffect(() => {
    const withCoords = events.filter(e => e.lat && e.lng);
    if (!withCoords.length) return;

    // Dynamically load Leaflet CSS + JS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      if (L._mapInitialized) return;
      L._mapInitialized = true;

      const map = L.map('fe-map', { zoomControl: true, scrollWheelZoom: false });
      map.setView([30, 15], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Dark filter
      const pane = map.getPanes().tilePane as HTMLElement;
      pane.style.filter = 'brightness(0.45) saturate(0.35) hue-rotate(185deg)';

      withCoords.forEach(e => {
        const color = TYPE_COLORS[e.type] || '#C9A84C';
        const icon = L.divIcon({
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${color};box-shadow:0 0 0 3px ${color}30;
            border:1px solid ${color};
          "></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([e.lat!, e.lng!], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:system-ui;min-width:180px">
              <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${color};margin-bottom:4px">
                ${TYPE_LABELS[e.type] || e.type}
              </div>
              <div style="font-size:14px;font-weight:500;margin-bottom:4px">${e.title}</div>
              <div style="font-size:11px;color:#666;margin-bottom:8px">${e.city}</div>
              <a href="/fashionevents/${e.id}" style="font-size:10px;color:${color}">View event →</a>
            </div>
          `);
      });
    };
    document.head.appendChild(script);

    return () => {
      const L = (window as any).L;
      if (L?._mapInitialized) {
        L._mapInitialized = false;
      }
    };
  }, [events]);

  return (
    <div id="fe-map" style={{
      height: 520, background: '#0D0D1A',
      border: '1px solid rgba(255,255,255,0.06)',
    }} />
  );
}
