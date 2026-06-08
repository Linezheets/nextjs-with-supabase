'use client';
import Link from 'next/link';

const SERIF = 'var(--font-serif), Georgia, serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const GOLD  = '#c9a84c';
const MUTED = 'rgba(255,255,255,0.55)';

const ENDPOINTS = [
  { method: 'GET',    path: '/v1/products',          desc: 'List all products in your catalogue' },
  { method: 'POST',   path: '/v1/products',          desc: 'Create a new product' },
  { method: 'GET',    path: '/v1/products/:id',      desc: 'Retrieve a single product' },
  { method: 'PATCH',  path: '/v1/products/:id',      desc: 'Update product details or inventory' },
  { method: 'GET',    path: '/v1/orders',            desc: 'List all wholesale orders' },
  { method: 'GET',    path: '/v1/orders/:id',        desc: 'Retrieve a single order with line items' },
  { method: 'POST',   path: '/v1/orders/:id/confirm',desc: 'Confirm a pending order' },
  { method: 'GET',    path: '/v1/buyers',            desc: 'List connected buyers' },
  { method: 'GET',    path: '/v1/linesheets',        desc: 'List all linesheets' },
  { method: 'POST',   path: '/v1/linesheets',        desc: 'Create a new linesheet' },
];

const WEBHOOK_EVENTS = [
  { event: 'order.created',        desc: 'A new wholesale order has been placed' },
  { event: 'order.confirmed',      desc: 'An order has been confirmed by the brand' },
  { event: 'order.cancelled',      desc: 'An order has been cancelled' },
  { event: 'payment.received',     desc: 'A payment has been successfully processed' },
  { event: 'inventory.updated',    desc: 'Stock levels have changed for one or more products' },
  { event: 'buyer.connected',      desc: 'A new buyer has connected with your brand' },
  { event: 'linesheet.viewed',     desc: 'A buyer has viewed your linesheet' },
];

const METHOD_COLORS: Record<string, string> = {
  GET:   'rgba(76,175,130,0.9)',
  POST:  'rgba(201,168,76,0.9)',
  PATCH: 'rgba(100,160,255,0.9)',
  DELETE:'rgba(230,80,80,0.9)',
};

export default function APIIntegrationsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white', fontFamily: 'system-ui, sans-serif', paddingTop: 80 }}>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 0' }}>
        <Link href="/integrations" style={{ fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontFamily: MONO }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = GOLD)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}>
          ← All Integrations
        </Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 2.5rem' }}>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', marginBottom: '5rem', alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: '0.6em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '1.25rem' }}>
              API & Webhooks
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.2rem,4.5vw,3.75rem)', fontWeight: 400, color: 'white', marginBottom: '1.25rem', lineHeight: 1.05 }}>
              Build anything<br />on top of Linezheets.
            </h1>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.75, marginBottom: '2rem' }}>
              The Linezheets REST API gives you full programmatic access to products, orders, buyers, and linesheets. Build custom integrations, automate workflows, or connect any platform your team uses.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                'RESTful JSON API — standard HTTP verbs',
                'Bearer token authentication (API keys from dashboard)',
                'Rate limit: 1,000 requests / minute on Brand; 10,000 on Enterprise',
                'Sandbox environment available for development',
                'Versioned endpoints — no breaking changes without notice',
              ].map(point => (
                <div key={point} style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ color: GOLD, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code snippet */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', fontFamily: MONO }}>
            <p style={{ fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '1rem' }}>Example request</p>
            <pre style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`curl https://api.linezheets.com/v1/orders \\
  -H "Authorization: Bearer lz_live_••••••••" \\
  -H "Content-Type: application/json"`}
            </pre>
            <div style={{ marginTop: '1.25rem', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <p style={{ fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: '1rem 0' }}>Response</p>
            <pre style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
{`{
  "data": [
    {
      "id": "ord_01abc123",
      "status": "confirmed",
      "buyer": { "name": "Le Marais Boutique" },
      "total": 4850.00,
      "currency": "EUR"
    }
  ],
  "meta": { "total": 142, "page": 1 }
}`}
            </pre>
          </div>
        </div>

        {/* Endpoints */}
        <div style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Core Endpoints
          </p>
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {ENDPOINTS.map(({ method, path, desc }, i) => (
              <div key={`${method}-${path}`} style={{
                display: 'grid', gridTemplateColumns: '80px 260px 1fr',
                alignItems: 'center', gap: '1.5rem',
                padding: '0.85rem 1.25rem',
                borderBottom: i < ENDPOINTS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 11, letterSpacing: '0.1em', fontFamily: MONO, color: METHOD_COLORS[method] ?? 'white', fontWeight: 600 }}>{method}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, color: 'rgba(255,255,255,0.75)' }}>{path}</span>
                <span style={{ fontSize: 13, color: MUTED }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Webhooks */}
        <div style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, fontFamily: MONO, marginBottom: '2rem' }}>
            Webhook Events
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
            {WEBHOOK_EVENTS.map(({ event, desc }) => (
              <div key={event} style={{ background: '#000', padding: '1.25rem 1.5rem' }}>
                <p style={{ fontSize: 13, fontFamily: MONO, color: GOLD, marginBottom: '0.35rem' }}>{event}</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/contact" style={{
            display: 'inline-block', padding: '0.9rem 2.25rem',
            background: `linear-gradient(135deg,#e8c56b,${GOLD})`,
            color: '#000', textDecoration: 'none',
            fontSize: 12, letterSpacing: '0.4em', textTransform: 'uppercase',
            fontFamily: MONO, fontWeight: 600,
          }}>
            Request API Access
          </Link>
        </div>
      </div>
    </div>
  );
}
