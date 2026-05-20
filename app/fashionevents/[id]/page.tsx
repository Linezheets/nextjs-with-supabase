import { createClient } from '@/lib/supabase/server';
import { notFound }     from 'next/navigation';
import { format }       from 'date-fns';
import RSVPSection      from './RSVPSection';

const TYPE_LABELS: Record<string, string> = {
  fashion_week: 'Fashion Week', tradeshow: 'Tradeshow', showroom: 'Showroom',
  runway: 'Runway Show', popup: 'Pop-up', networking: 'Networking', market_week: 'Market Week',
};
const TYPE_COLORS: Record<string, string> = {
  fashion_week: '#C9A84C', runway: '#B87EAA', tradeshow: '#7EB8C4',
  showroom: '#A4C47E', popup: '#C4977E', networking: '#7E9BC4', market_week: '#C4BC7E',
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/events/${id}`,
    { cache: 'no-store' }
  );
  if (!res.ok) notFound();
  const { event, can_manage } = await res.json();

  const color = TYPE_COLORS[event.type] || '#C9A84C';

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 32px 80px' }}>

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <a href="/fashionevents" style={{
        fontFamily: 'system-ui, sans-serif', fontSize: 9,
        letterSpacing: '0.35em', textTransform: 'uppercase',
        color: 'rgba(245,240,232,0.3)', textDecoration: 'none',
        display: 'inline-block', marginBottom: 40,
      }}>
        ← All Events
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div>
          {/* Type + featured badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 8,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color, border: `1px solid ${color}40`, padding: '4px 12px',
            }}>
              {TYPE_LABELS[event.type] || event.type}
            </span>
            {event.featured && (
              <span style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 8,
                letterSpacing: '0.3em', textTransform: 'uppercase',
                color: '#C9A84C', background: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.3)', padding: '4px 12px',
              }}>
                ✦ Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 400,
            lineHeight: 1.05, color: '#F5F0E8', marginBottom: 16,
          }}>
            {event.title}
          </h1>

          {/* Host */}
          {event.host_name && (
            <p style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 12,
              color: 'rgba(245,240,232,0.4)', marginBottom: 32,
            }}>
              Hosted by {event.host_name}
            </p>
          )}

          {/* Cover image */}
          {event.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.cover_image_url} alt={event.title}
              style={{
                width: '100%', maxHeight: 400, objectFit: 'cover',
                marginBottom: 40, filter: 'brightness(0.85)',
              }} />
          )}

          {/* Description */}
          {event.description && (
            <div style={{ marginBottom: 40 }}>
              <p style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.4em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.25)', marginBottom: 16,
              }}>
                About
              </p>
              <p style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 14,
                lineHeight: 1.9, color: 'rgba(245,240,232,0.65)',
                whiteSpace: 'pre-wrap',
              }}>
                {event.description}
              </p>
            </div>
          )}

          {/* Website */}
          {event.website_url && (
            <a href={event.website_url} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.3em', textTransform: 'uppercase',
              color: '#C9A84C', textDecoration: 'none',
              borderBottom: '1px solid rgba(201,168,76,0.3)',
              paddingBottom: 2,
            }}>
              Visit Website →
            </a>
          )}

          {/* Manage link for owner/agency */}
          {can_manage && (
            <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <a href="/fashionevents/manage" style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.3em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.3)', textDecoration: 'none',
              }}>
                ⚙ Manage this event →
              </a>
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Info card */}
          <div style={{
            background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.07)',
            padding: '28px 28px',
          }}>
            <InfoRow label="Date" value={
              format(new Date(event.date_start), 'EEEE, MMMM d, yyyy') +
              (event.date_end && event.date_end !== event.date_start
                ? ` – ${format(new Date(event.date_end), 'MMMM d, yyyy')}`
                : '')
            } />
            {event.time_start && <InfoRow label="Time" value={
              event.time_start + (event.time_end ? ` – ${event.time_end}` : '')
            } />}
            <InfoRow label="Location" value={[event.venue_name, event.city, event.country].filter(Boolean).join(', ')} />
            {event.address && <InfoRow label="Address" value={event.address} />}
            {event.capacity && <InfoRow label="Capacity" value={`${event.rsvp_count ?? 0} / ${event.capacity}`} />}
            <InfoRow label="Access" value={event.is_public ? 'Open — Anyone can RSVP' : 'Invite Only — Request required'} />
            {event.event_tag && <InfoRow label="Season" value={event.event_tag} />}
          </div>

          {/* Stats */}
          <div style={{
            background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.07)',
            padding: '20px 28px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, color }}>
                {event.interest_count || 0}
              </div>
              <div style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 8,
                letterSpacing: '0.3em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.3)', marginTop: 4,
              }}>Interested</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, color: '#A4C47E' }}>
                {event.rsvp_count || 0}
              </div>
              <div style={{
                fontFamily: 'system-ui, sans-serif', fontSize: 8,
                letterSpacing: '0.3em', textTransform: 'uppercase',
                color: 'rgba(245,240,232,0.3)', marginTop: 4,
              }}>Attending</div>
            </div>
          </div>

          {/* RSVP section (client) */}
          <RSVPSection event={event} userId={user?.id || null} userEmail={user?.email || null} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        fontFamily: 'system-ui, sans-serif', fontSize: 8,
        letterSpacing: '0.35em', textTransform: 'uppercase',
        color: 'rgba(245,240,232,0.25)', marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'system-ui, sans-serif', fontSize: 13,
        color: 'rgba(245,240,232,0.75)', lineHeight: 1.5,
      }}>
        {value}
      </div>
    </div>
  );
}
