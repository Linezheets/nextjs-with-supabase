'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

function safeNum(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') { const n = parseFloat(raw); return isNaN(n) ? null : n; }
  return null;
}

type Item = {
  brand_name?: unknown;
  category?: unknown;
  title?: unknown;
  image_url?: unknown;
  wholesale_price?: unknown;
  retail_price?: unknown;
  season?: unknown;
};

export function FeaturedCollectionsClient({ items }: { items: Item[] }) {
  const categories = [...new Set(items.map(i => safeStr(i.category)).filter(Boolean))].slice(0, 6);
  const brands     = [...new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))].sort().slice(0, 8);

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/marketplace" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← Marketplace
        </Link>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4rem 2.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
            Featured Collections
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4.5vw,3.75rem)', fontWeight: 400, color: 'white', marginBottom: '1rem', lineHeight: 1.05 }}>
            Curated picks<br />this season.
          </h1>
          <p style={{ fontSize: 16, color: MUTED, maxWidth: 480, lineHeight: 1.75 }}>
            {items.length > 0
              ? `${items.length} pieces from ${brands.length} brands across ${categories.length} categories — selected by our editorial team.`
              : 'Our editorial team curates the best of each season from across the Linezheets brand network.'}
          </p>
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: MONO, padding: '5px 14px', background: GOLD, color: '#000', fontWeight: 600 }}>
              All
            </span>
            {categories.map(cat => (
              <span key={cat} style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: MONO, padding: '5px 14px', border: '1px solid rgba(255,255,255,0.12)', color: MUTED }}>
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Product grid */}
        {items.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '4rem' }}>
            {items.map((item, idx) => {
              const imgUrl = safeStr(item.image_url);
              const title  = safeStr(item.title, 'Untitled');
              const brand  = safeStr(item.brand_name, 'Brand');
              const wPrice = safeNum(item.wholesale_price);
              const season = safeStr(item.season);

              return (
                <div key={idx} style={{ background: '#000', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.03)', position: 'relative', overflow: 'hidden' }}>
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.08)' }}>◈</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0')}>
                      <Link href="/join" style={{
                        fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase',
                        color: '#000', background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
                        padding: '0.6rem 1.25rem', textDecoration: 'none',
                        fontFamily: MONO, fontWeight: 600,
                      }}>
                        View Details
                      </Link>
                    </div>
                  </div>

                  <div style={{ padding: '1rem' }}>
                    <p style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '0.35rem' }}>{brand}</p>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: '0.4rem', lineHeight: 1.4 }}>{title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {wPrice !== null ? (
                        <span style={{ fontSize: 13, fontFamily: MONO, color: MUTED }}>WS ${wPrice.toLocaleString()}</span>
                      ) : (
                        <span style={{ fontSize: 12, fontFamily: MONO, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em' }}>••••</span>
                      )}
                      {season && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: MONO, letterSpacing: '0.2em' }}>{season}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ background: '#000', aspectRatio: '3/4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.06)' }}>◈</span>
                  <span style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.12)', fontFamily: MONO }}>Approved buyers only</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auth gate CTA */}
        <div style={{ padding: '3rem', border: `1px solid rgba(201,168,76,0.2)`, background: 'rgba(201,168,76,0.03)', textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 400, color: 'white', marginBottom: '0.75rem' }}>
            See prices and full collection details.
          </p>
          <p style={{ fontSize: 16, color: MUTED, marginBottom: '2rem' }}>
            Linezheets is a verified buyer platform. Apply for access to unlock wholesale pricing and direct brand ordering.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/join" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
              color: '#000', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO, fontWeight: 600,
            }}>
              Apply for Access
            </Link>
            <Link href="/login" style={{
              display: 'inline-block', padding: '0.9rem 2.25rem',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
              fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
              fontFamily: MONO,
            }}>
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
