'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id        : number;
  title     : string | null;
  brand_name: string;
  srp       : number | null;
  srp_usd   : number | null;
  image_urls: string[] | null;
  category  : string | null;
  season    : string | null;
};

type Campaign = {
  id         : string;
  name       : string;
  subject    : string;
  message    : string | null;
  product_ids: number[];
  targeting  : Targeting;
  status     : 'draft' | 'sent';
  sent_at    : string | null;
  total_sent : number;
  created_at : string;
};

type Targeting = {
  categories?      : string[];
  market_segments? : string[];
  price_max?       : number;
  all_buyers?      : boolean;
};

type MatchedBuyer = {
  id           : string;
  email        : string;
  store_name   : string;
  city         : string | null;
  country      : string;
  match_score  : number;
  match_reasons: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const gold = '#c9a84c';

const MARKET_SEGMENTS = ['luxury', 'premium', 'contemporary', 'streetwear', 'fast-fashion'];

function thumb(item: InventoryItem): string | null {
  if (Array.isArray(item.image_urls) && item.image_urls[0]) return item.image_urls[0];
  return null;
}

function price(item: InventoryItem): number {
  return Number(item.srp ?? item.srp_usd ?? 0);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#52b788' : score >= 40 ? gold : '#ddd';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '3px', background: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono), monospace', color, width: '28px', textAlign: 'right' }}>{score}</span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.5em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '14px' }}>{children}</p>;
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding    : '5px 12px',
        fontSize   : '8.5px',
        textTransform: 'uppercase',
        letterSpacing: '0.3em',
        fontFamily : 'system-ui',
        border     : `1px solid ${active ? gold : '#ddd'}`,
        background : active ? '#fffbf0' : 'transparent',
        color      : active ? gold : '#aaa',
        cursor     : onClick ? 'pointer' : 'default',
        transition : 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

const inputCls = 'border-b border-zinc-200 w-full py-2 text-[12px] outline-none focus:border-zinc-500 bg-transparent transition-colors placeholder:text-zinc-300';

// ── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({ inventory, selected, onChange }: {
  inventory: InventoryItem[];
  selected : number[];
  onChange : (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const filtered  = inventory.filter(i =>
    !q || [i.title, i.brand_name, i.category].some(v => v?.toLowerCase().includes(q.toLowerCase()))
  );

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div>
      <input
        className={inputCls}
        placeholder="Search products…"
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ marginBottom: '12px' }}
      />

      {selected.length > 0 && (
        <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {selected.map(id => {
            const item = inventory.find(i => i.id === id);
            if (!item) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: `1px solid ${gold}`, background: '#fffbf0' }}>
                {thumb(item) && <img src={thumb(item)!} alt="" style={{ width: 20, height: 27, objectFit: 'cover' }} />}
                <span style={{ fontSize: '9px', color: '#555', fontFamily: 'system-ui', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <button onClick={() => toggle(id)} style={{ fontSize: '9px', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #f0f0f0' }}>
        {filtered.length === 0 && (
          <p style={{ padding: '20px', textAlign: 'center', fontSize: '10px', color: '#ccc', fontFamily: 'system-ui' }}>No products found</p>
        )}
        {filtered.map(item => {
          const isSelected = selected.includes(item.id);
          const img = thumb(item);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', textAlign: 'left',
                background: isSelected ? '#fffbf0' : 'white',
                borderBottom: '1px solid #f8f8f8',
                border: 'none', borderLeft: `3px solid ${isSelected ? gold : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 32, height: 42, background: '#f4f4f4', flexShrink: 0, overflow: 'hidden' }}>
                {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#333', fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#bbb', fontFamily: 'system-ui' }}>{item.category}</p>
              </div>
              {price(item) > 0 && (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono), monospace', color: gold, flexShrink: 0 }}>${price(item).toLocaleString()}</span>
              )}
              {isSelected && <span style={{ fontSize: '10px', color: gold }}>✓</span>}
            </button>
          );
        })}
      </div>
      <p style={{ marginTop: '8px', fontSize: '8.5px', color: '#bbb', fontFamily: 'system-ui' }}>
        {selected.length} selected
      </p>
    </div>
  );
}

// ── Compose panel ─────────────────────────────────────────────────────────────

function ComposePanel({ inventory, onCreated }: {
  inventory: InventoryItem[];
  onCreated: (c: Campaign) => void;
}) {
  const [step, setStep]   = useState<'details' | 'products' | 'targeting'>('details');
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

  const [form, setForm] = useState({
    name       : '',
    subject    : '',
    message    : '',
    product_ids: [] as number[],
    targeting  : {
      categories     : [] as string[],
      market_segments: [] as string[],
      all_buyers     : false,
    } as Targeting,
  });

  const categories = [...new Set(inventory.map(i => i.category).filter(Boolean))] as string[];

  function setT<K extends keyof typeof form.targeting>(key: K, val: typeof form.targeting[K]) {
    setForm(f => ({ ...f, targeting: { ...f.targeting, [key]: val } }));
  }

  function toggleSegment(seg: string) {
    const cur = form.targeting.market_segments ?? [];
    setT('market_segments', cur.includes(seg) ? cur.filter(s => s !== seg) : [...cur, seg]);
  }

  function toggleCategory(cat: string) {
    const cur = form.targeting.categories ?? [];
    setT('categories', cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat]);
  }

  async function save() {
    setErr('');
    if (!form.name.trim())    { setErr('Campaign name required');    return; }
    if (!form.subject.trim()) { setErr('Email subject required');    return; }
    if (!form.product_ids.length) { setErr('Select at least one product'); return; }
    setSaving(true);
    const res = await fetch('/api/brand/recommendations', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        name       : form.name,
        subject    : form.subject,
        message    : form.message || undefined,
        product_ids: form.product_ids,
        targeting  : form.targeting,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json(); setErr(j.error ?? 'Error'); return; }
    const { campaign } = await res.json();
    onCreated(campaign);
  }

  const stepStyle = (s: string) => ({
    fontSize     : '8px' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.35em',
    fontFamily   : 'system-ui',
    padding      : '8px 0',
    borderBottom : `2px solid ${step === s ? '#111' : 'transparent'}`,
    color        : step === s ? '#111' : '#bbb',
    background   : 'transparent',
    cursor       : 'pointer',
    flex         : 1,
  });

  return (
    <div>
      {/* Step tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '24px', gap: '4px' }}>
        {(['details','products','targeting'] as const).map(s => (
          <button key={s} style={stepStyle(s)} onClick={() => setStep(s)}>
            {s === 'details' ? '1. Message' : s === 'products' ? '2. Products' : '3. Audience'}
          </button>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <SectionHead>Campaign Name</SectionHead>
            <input className={inputCls} placeholder="e.g. SS27 Outerwear Drop" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ color: '#333' }} />
            <p style={{ fontSize: '8.5px', color: '#bbb', fontFamily: 'system-ui', marginTop: '5px' }}>Internal label — buyers don't see this.</p>
          </div>
          <div>
            <SectionHead>Email Subject</SectionHead>
            <input className={inputCls} placeholder="e.g. New arrivals selected for your store" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={{ color: '#333' }} />
          </div>
          <div>
            <SectionHead>Personal Message <span style={{ color: '#ddd' }}>(optional)</span></SectionHead>
            <textarea
              className="border-b border-zinc-200 w-full py-2 text-[12px] outline-none focus:border-zinc-500 bg-transparent resize-none"
              style={{ color: '#333', fontFamily: 'system-ui', fontStyle: 'italic' }}
              rows={4}
              placeholder={`"We hand-picked these pieces with your store's aesthetic in mind…"`}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            />
            <p style={{ fontSize: '8.5px', color: '#bbb', fontFamily: 'system-ui', marginTop: '5px' }}>Appears as a quote at the top of the email.</p>
          </div>
          <button onClick={() => setStep('products')} style={{ alignSelf: 'flex-start', padding: '10px 28px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', background: '#111', color: '#fff', fontFamily: 'system-ui', border: 'none', cursor: 'pointer' }}>
            Next: Products →
          </button>
        </div>
      )}

      {/* Step 2: Products */}
      {step === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ProductPicker
            inventory={inventory}
            selected={form.product_ids}
            onChange={ids => setForm(f => ({ ...f, product_ids: ids }))}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('details')} style={{ padding: '10px 20px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.35em', background: 'transparent', color: '#aaa', fontFamily: 'system-ui', border: '1px solid #ddd', cursor: 'pointer' }}>← Back</button>
            <button onClick={() => setStep('targeting')} disabled={!form.product_ids.length} style={{ padding: '10px 28px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', background: '#111', color: '#fff', fontFamily: 'system-ui', border: 'none', cursor: 'pointer', opacity: form.product_ids.length ? 1 : 0.4 }}>Next: Audience →</button>
          </div>
        </div>
      )}

      {/* Step 3: Targeting */}
      {step === 'targeting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <SectionHead>Buyer Categories</SectionHead>
            <p style={{ fontSize: '9px', color: '#bbb', fontFamily: 'system-ui', marginBottom: '10px' }}>Send to buyers who carry these categories in their store.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {categories.map(cat => (
                <Pill key={cat} active={(form.targeting.categories ?? []).includes(cat)} onClick={() => toggleCategory(cat)}>
                  {cat}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <SectionHead>Market Segment</SectionHead>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MARKET_SEGMENTS.map(seg => (
                <Pill key={seg} active={(form.targeting.market_segments ?? []).includes(seg)} onClick={() => toggleSegment(seg)}>
                  {seg}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <SectionHead>Send to all active buyers</SectionHead>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <button
                onClick={() => setT('all_buyers', !form.targeting.all_buyers)}
                style={{ width: 40, height: 20, borderRadius: 10, background: form.targeting.all_buyers ? gold : '#e0e0e0', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: form.targeting.all_buyers ? 22 : 2, width: 16, height: 16, borderRadius: 8, background: 'white', transition: 'left 0.2s' }} />
              </button>
              <span style={{ fontSize: '11px', color: '#555', fontFamily: 'system-ui' }}>
                Override filters — send to everyone
              </span>
            </label>
            <p style={{ marginTop: '6px', fontSize: '8.5px', color: '#bbb', fontFamily: 'system-ui' }}>Ignores category and segment filters above.</p>
          </div>

          {err && <p style={{ fontSize: '10px', color: '#e57373', fontFamily: 'system-ui' }}>{err}</p>}

          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => setStep('products')} style={{ padding: '10px 20px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.35em', background: 'transparent', color: '#aaa', fontFamily: 'system-ui', border: '1px solid #ddd', cursor: 'pointer' }}>← Back</button>
            <button onClick={save} disabled={saving} style={{ padding: '10px 32px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', background: gold, color: '#fff', fontFamily: 'system-ui', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save Campaign →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Audience preview panel ────────────────────────────────────────────────────

function AudiencePanel({ campaign, onSent }: { campaign: Campaign; onSent: () => void }) {
  const [buyers,  setBuyers]  = useState<MatchedBuyer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/brand/recommendations/${campaign.id}/buyers`)
      .then(r => r.json())
      .then(j => { setBuyers(j.buyers ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [campaign.id]);

  async function send() {
    setErr('');
    setSending(true);
    const res = await fetch(`/api/brand/recommendations/${campaign.id}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    setSending(false);
    if (!res.ok) { const j = await res.json(); setErr(j.error ?? 'Send failed'); return; }
    setSent(true);
    onSent();
  }

  if (campaign.status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ width: 40, height: 1, background: gold, margin: '0 auto 24px' }} />
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#111', fontWeight: 400, marginBottom: '8px' }}>Campaign Sent</p>
        <p style={{ fontSize: '11px', color: '#aaa', fontFamily: 'system-ui', marginBottom: '4px' }}>{campaign.total_sent} buyers received this</p>
        {campaign.sent_at && <p style={{ fontSize: '9px', color: '#ccc', fontFamily: 'system-ui' }}>{fmtDate(campaign.sent_at)}</p>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <SectionHead>Matched Audience</SectionHead>
          {!loading && buyers && (
            <p style={{ fontSize: '11px', color: '#555', fontFamily: 'system-ui', marginTop: '-8px' }}>
              <strong style={{ color: '#111' }}>{buyers.length}</strong> buyers match your criteria
            </p>
          )}
        </div>
        {!sent && buyers && buyers.length > 0 && (
          <button
            onClick={send}
            disabled={sending || loading}
            style={{ padding: '11px 32px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.45em', background: '#111', color: '#fff', fontFamily: 'system-ui', border: 'none', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}
          >
            {sending ? 'Sending…' : `Send to ${buyers.length}`}
          </button>
        )}
      </div>

      {err && <p style={{ fontSize: '10px', color: '#e57373', fontFamily: 'system-ui', marginBottom: '12px' }}>{err}</p>}

      {sent && (
        <div style={{ padding: '14px 20px', background: '#f0faf4', border: '1px solid #b7e4c7', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#2d6a4f', fontFamily: 'system-ui' }}>
            ✓ Sent to {buyers?.length ?? campaign.total_sent} buyers
          </p>
        </div>
      )}

      {loading && <p style={{ fontSize: '10px', color: '#ccc', fontFamily: 'system-ui', textAlign: 'center', padding: '32px' }}>Scoring buyers…</p>}

      {!loading && buyers && buyers.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed #e0e0e0' }}>
          <p style={{ fontSize: '10px', color: '#bbb', fontFamily: 'system-ui', marginBottom: '8px' }}>No buyers matched your filters.</p>
          <p style={{ fontSize: '9px', color: '#ccc', fontFamily: 'system-ui' }}>Try broadening the audience or enabling "Send to all active buyers".</p>
        </div>
      )}

      {!loading && buyers && buyers.length > 0 && (
        <div style={{ border: '1px solid #f0f0f0', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '16px', padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui' }}>Buyer</span>
            <span style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', textAlign: 'right' }}>Match</span>
          </div>
          {buyers.map(b => (
            <div key={b.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8f8f8', display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#111', fontFamily: 'system-ui', fontWeight: 500 }}>{b.store_name}</p>
                <p style={{ margin: '0 0 4px', fontSize: '9px', color: '#bbb', fontFamily: 'system-ui' }}>{b.city ? `${b.city}, ` : ''}{b.country}</p>
                {b.match_reasons.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {b.match_reasons.slice(0, 3).map((r, i) => (
                      <span key={i} style={{ fontSize: '7.5px', padding: '2px 7px', background: '#fafafa', border: '1px solid #eee', color: '#888', fontFamily: 'system-ui' }}>{r}</span>
                    ))}
                  </div>
                )}
              </div>
              <ScoreBar score={b.match_score} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign history ──────────────────────────────────────────────────────────

function HistoryPanel({ campaigns, inventory, onSelect }: {
  campaigns: Campaign[];
  inventory: InventoryItem[];
  onSelect : (c: Campaign) => void;
}) {
  if (campaigns.length === 0) {
    return <p style={{ fontSize: '10px', color: '#ccc', fontFamily: 'system-ui', padding: '24px 0' }}>No campaigns yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {campaigns.map(c => {
        const thumbs = c.product_ids.slice(0, 4).map(id => {
          const item = inventory.find(i => i.id === id);
          return item ? thumb(item) : null;
        }).filter(Boolean) as string[];

        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', textAlign: 'left', border: '1px solid #f0f0f0', background: 'white', cursor: 'pointer', width: '100%', transition: 'border-color 0.15s' }}
            onMouseOver={e => (e.currentTarget.style.borderColor = '#ddd')}
            onMouseOut={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
          >
            {/* Product thumbs */}
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              {thumbs.slice(0, 3).map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: 28, height: 37, objectFit: 'cover' }} />
              ))}
              {thumbs.length === 0 && <div style={{ width: 28, height: 37, background: '#f4f4f4' }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#111', fontFamily: 'system-ui', fontWeight: 500 }}>{c.name}</p>
              <p style={{ margin: 0, fontSize: '9px', color: '#aaa', fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</p>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                display: 'inline-block', padding: '3px 9px',
                fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.3em',
                fontFamily: 'system-ui',
                background: c.status === 'sent' ? '#f0faf4' : '#fafafa',
                color     : c.status === 'sent' ? '#2d6a4f' : '#999',
                border    : `1px solid ${c.status === 'sent' ? '#b7e4c7' : '#e8e8e8'}`,
              }}>
                {c.status === 'sent' ? `✓ ${c.total_sent} sent` : 'Draft'}
              </span>
              {c.sent_at && <p style={{ margin: '4px 0 0', fontSize: '8px', color: '#ccc', fontFamily: 'system-ui' }}>{fmtDate(c.sent_at)}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selected,  setSelected]  = useState<Campaign | null>(null);
  const [loading,   setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    const [campRes, invRes] = await Promise.all([
      fetch('/api/brand/recommendations').then(r => r.json()),
      fetch('/api/brand/recommendations/inventory').then(r => r.json()).catch(() => ({ items: [] })),
    ]);
    setCampaigns(campRes.campaigns ?? []);
    setInventory(invRes.items ?? invRes.inventory ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleCreated(campaign: Campaign) {
    setCampaigns(cs => [campaign, ...cs]);
    setSelected(campaign);
    setTab('history');
  }

  function handleSent() {
    loadData();
  }

  const tabStyle = (t: string) => ({
    fontSize     : '7.5px' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4em',
    fontFamily   : 'system-ui',
    padding      : '10px 0',
    borderBottom : `2px solid ${tab === t ? '#111' : 'transparent'}`,
    color        : tab === t ? '#111' : '#bbb',
    background   : 'transparent',
    cursor       : 'pointer',
    flex         : 1,
  });

  if (loading) {
    return (
      <div style={{ padding: '48px', fontFamily: 'system-ui', fontSize: '10px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.6em', color: gold, fontFamily: 'system-ui' }}>
            Brand Tools
          </p>
          <h1 style={{ margin: '0 0 10px', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 400, color: '#0a0a0a', lineHeight: 1.1 }}>
            Buying Recommendations
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#888', lineHeight: 1.7, maxWidth: '520px' }}>
            Send hand-picked product selections straight to a buyer's inbox — matched to their store's categories, market segment, and buying history.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '560px 1fr', gap: '40px', alignItems: 'start' }}>

          {/* Left: tabs + content */}
          <div>
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '28px', gap: '4px' }}>
              <button style={tabStyle('compose')} onClick={() => { setTab('compose'); setSelected(null); }}>New Campaign</button>
              <button style={tabStyle('history')} onClick={() => setTab('history')}>
                History {campaigns.length > 0 && `(${campaigns.length})`}
              </button>
            </div>

            {tab === 'compose' && (
              <ComposePanel inventory={inventory} onCreated={handleCreated} />
            )}

            {tab === 'history' && (
              <HistoryPanel
                campaigns={campaigns}
                inventory={inventory}
                onSelect={c => setSelected(c)}
              />
            )}
          </div>

          {/* Right: audience preview */}
          {selected && (
            <div style={{ border: '1px solid #f0f0f0', padding: '24px' }}>
              <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f8f8f8' }}>
                <p style={{ margin: '0 0 4px', fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui' }}>Campaign</p>
                <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#111', fontFamily: 'system-ui', fontWeight: 500 }}>{selected.name}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#aaa', fontFamily: 'system-ui' }}>{selected.subject}</p>
              </div>

              {/* Selected products */}
              {selected.product_ids.length > 0 && (
                <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f8f8f8' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui' }}>
                    {selected.product_ids.length} products
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selected.product_ids.slice(0, 6).map(id => {
                      const item = inventory.find(i => i.id === id);
                      if (!item) return null;
                      const img = thumb(item);
                      return (
                        <div key={id} style={{ position: 'relative' }}>
                          <div style={{ width: 44, height: 58, background: '#f4f4f4', overflow: 'hidden' }}>
                            {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                        </div>
                      );
                    })}
                    {selected.product_ids.length > 6 && (
                      <div style={{ width: 44, height: 58, background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#aaa', fontFamily: 'system-ui' }}>+{selected.product_ids.length - 6}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <AudiencePanel campaign={selected} onSent={handleSent} />
            </div>
          )}

          {/* Right: empty state when no campaign selected */}
          {!selected && tab === 'compose' && (
            <div style={{ border: '1px dashed #e8e8e8', padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#ccc', fontFamily: 'system-ui' }}>Audience Preview</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#ccc', fontFamily: 'system-ui', lineHeight: 1.6 }}>
                Save a campaign to see which buyers match and preview the send list.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
