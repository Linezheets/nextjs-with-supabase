'use client';

import { useState } from 'react';
import { DEFAULT_THEME } from '@/app/dashboard/store/editor/EditorClient';
import type { Theme, Section } from '@/app/dashboard/store/editor/EditorClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type Storefront = {
  slug         : string;
  name         : string;
  tagline      : string | null;
  description  : string | null;
  accent_color : string;
  contact_email: string | null;
  instagram    : string | null;
  website      : string | null;
  theme        : Theme | null;
};

type StoreItem = {
  id            : string;
  title         : string | null;
  brand_name    : string | null;
  category      : string | null;
  season        : string | null;
  description   : string | null;
  consumer_price: number | null;
  retail_price  : number | null;
  image_url     : string | null;
  image_urls    : string[] | string | null;
  inventory_status: string | null;
  featured      : boolean;
  [key: string] : unknown;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getImages(item: StoreItem): string[] {
  const imgs: string[] = [];
  if (item.image_url) imgs.push(item.image_url);
  if (Array.isArray(item.image_urls)) imgs.push(...item.image_urls);
  else if (typeof item.image_urls === 'string' && item.image_urls) imgs.push(item.image_urls);
  return [...new Set(imgs)];
}

function fontFamily(font: string) {
  if (font === 'serif') return 'var(--font-serif), Georgia, "Times New Roman", serif';
  if (font === 'mono')  return 'var(--font-mono), monospace';
  return 'system-ui, -apple-system, sans-serif';
}

function sizeScale(t: Theme) {
  if (t.font_size_scale === 'compact') return 0.85;
  if (t.font_size_scale === 'large')   return 1.15;
  return 1;
}

function sectionPad(t: Theme) {
  if (t.section_padding === 'compact')  return 'clamp(28px,4vw,48px)';
  if (t.section_padding === 'spacious') return 'clamp(64px,10vw,120px)';
  return 'clamp(40px,6vw,80px)';
}

function horzPad(t: Theme) {
  if (t.section_padding === 'compact')  return 'clamp(16px,4vw,48px)';
  if (t.section_padding === 'spacious') return 'clamp(40px,8vw,120px)';
  return 'clamp(24px,6vw,80px)';
}

function pageMaxWidth(t: Theme) {
  if (t.page_width === 'wide') return '1440px';
  if (t.page_width === 'full') return '100%';
  return '1280px';
}

function btnRadius(t: Theme) {
  if (t.button_radius === 'small') return '4px';
  if (t.button_radius === 'full')  return '9999px';
  return '0';
}

function primaryBtn(t: Theme): React.CSSProperties {
  const bg    = t.color_button_bg   || t.color_accent;
  const color = t.color_button_text || '#ffffff';
  const r     = btnRadius(t);
  if (t.button_style === 'ghost')   return { background: 'transparent', color: bg,    border: 'none',           borderRadius: r, cursor: 'pointer' };
  if (t.button_style === 'outline') return { background: 'transparent', color: bg,    border: `1px solid ${bg}`,borderRadius: r, cursor: 'pointer' };
  return { background: bg, color, border: 'none', borderRadius: r, cursor: 'pointer' };
}

function headingCss(t: Theme, size: string): React.CSSProperties {
  return {
    fontFamily  : fontFamily(t.font_heading),
    fontSize    : size,
    fontWeight  : Number(t.heading_weight ?? 400),
    letterSpacing: t.letter_spacing === 'tight' ? '-0.02em' : t.letter_spacing === 'wide' ? '0.06em' : '0em',
    textTransform: (t.heading_transform ?? 'none') as React.CSSProperties['textTransform'],
    lineHeight  : 1.05,
  };
}

function navBg(t: Theme)   { return t.color_nav_bg   || t.color_bg; }
function navText(t: Theme) { return t.color_nav_text || t.color_text; }
function borderColor(t: Theme) { return t.color_border || '#f0f0f0'; }

// ── Enquiry modal ─────────────────────────────────────────────────────────────

function EnquiryModal({ slug, product, theme, onClose }: {
  slug   : string;
  product: StoreItem | null;
  theme  : Theme;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setErr('');
    const res = await fetch('/api/store/enquiry', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ slug, product_id: product?.id ?? null, ...form }),
    });
    setSending(false);
    if (!res.ok) { setErr('Something went wrong. Please try again.'); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md mx-4" style={{ borderTop: `2px solid ${theme.color_accent}` }}>
        <div className="px-8 pt-8 pb-5 border-b border-zinc-100">
          <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.5em', color: theme.color_accent, fontFamily: 'system-ui', marginBottom: '6px' }}>
            {product ? 'Product Enquiry' : 'Get in Touch'}
          </p>
          <h2 style={{ fontFamily: fontFamily(theme.font_heading), fontSize: '1.4rem', fontWeight: 400, color: '#111' }}>
            {product ? String(product.title ?? '') : 'Contact Us'}
          </h2>
        </div>

        {done ? (
          <div className="px-8 py-12 text-center">
            <div className="w-10 h-px mx-auto mb-6" style={{ background: theme.color_accent }} />
            <p style={{ fontFamily: fontFamily(theme.font_heading), fontSize: '1.2rem', color: '#111' }}>Thank you</p>
            <p className="mt-3 text-[12px]" style={{ color: '#888', fontFamily: 'system-ui' }}>We will be in touch shortly.</p>
            <button onClick={onClose} className="mt-6 text-[8px] uppercase tracking-[0.4em] hover:opacity-50" style={{ color: '#aaa', fontFamily: 'system-ui' }}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-8 py-6 space-y-5">
            {[
              { key: 'name',    label: 'Your Name',     type: 'text',  required: true  },
              { key: 'email',   label: 'Email Address', type: 'email', required: true  },
              { key: 'message', label: 'Message',       type: 'text',  required: false },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '6px' }}>{f.label}</label>
                <input required={f.required} type={f.type}
                       value={form[f.key as keyof typeof form]}
                       onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                       className="w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none focus:border-zinc-400 transition-colors"
                       style={{ color: '#333', fontFamily: 'system-ui' }} />
              </div>
            ))}
            {err && <p style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'system-ui' }}>{err}</p>}
            <div className="flex items-center gap-4 pt-2">
              <button type="submit" disabled={sending}
                      className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] text-white disabled:opacity-40"
                      style={{ background: '#111', fontFamily: 'system-ui' }}>
                {sending ? 'Sending…' : 'Send Enquiry'}
              </button>
              <button type="button" onClick={onClose} className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50" style={{ color: '#aaa', fontFamily: 'system-ui' }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Product drawer ────────────────────────────────────────────────────────────

function ProductDrawer({ item, theme, onEnquire, onClose }: {
  item     : StoreItem;
  theme    : Theme;
  onEnquire: () => void;
  onClose  : () => void;
}) {
  const imgs  = getImages(item);
  const [img, setImg] = useState(0);
  const price = Number(item.consumer_price ?? item.retail_price ?? 0);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-xl bg-white flex flex-col overflow-y-auto"
           style={{ borderLeft: '1px solid #f0f0f0' }}>
        <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 shrink-0">
          <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.5em', color: theme.color_accent, fontFamily: 'system-ui' }}>
            {String(item.brand_name ?? '')}
          </p>
          <button onClick={onClose} style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui' }}>Close ✕</button>
        </div>

        <div className="relative shrink-0" style={{ aspectRatio: '4/5', background: '#f4f4f4' }}>
          {imgs[img] && <img src={imgs[img]} alt={String(item.title ?? '')} className="w-full h-full object-cover" />}
        </div>
        {imgs.length > 1 && (
          <div className="flex gap-2 px-8 py-3 shrink-0 overflow-x-auto">
            {imgs.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => setImg(i)}
                   className="w-14 h-14 object-cover cursor-pointer shrink-0"
                   style={{ opacity: img === i ? 1 : 0.4, outline: img === i ? `1px solid ${theme.color_accent}` : 'none' }} />
            ))}
          </div>
        )}

        <div className="px-8 py-6 flex-1">
          {item.season && <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#ccc', fontFamily: 'system-ui', marginBottom: '8px' }}>{String(item.season)}</p>}
          <h2 style={{ fontFamily: fontFamily(theme.font_heading), fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 400, color: theme.color_text, lineHeight: 1.1 }}>{String(item.title ?? '')}</h2>
          {price > 0 && <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '18px', color: theme.color_accent, marginTop: '12px' }}>${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>}
          {item.description && <p style={{ marginTop: '20px', fontSize: '13px', lineHeight: 1.85, color: '#666', fontFamily: fontFamily(theme.font_body) }}>{String(item.description)}</p>}
          <div className="mt-8 space-y-3 border-t border-zinc-100 pt-6">
            {[['Brand',String(item.brand_name??'')],['Category',String(item.category??'')],['Season',String(item.season??'')],['Availability',String(item.inventory_status??'')]].filter(([,v])=>v&&v!=='null').map(([l,v])=>(
              <div key={l} className="flex items-center gap-4">
                <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', width: '80px', flexShrink: 0 }}>{l}</p>
                <p style={{ fontSize: '11px', color: '#555', fontFamily: 'system-ui' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-8 py-6 border-t border-zinc-100 shrink-0">
          <button onClick={onEnquire} className="w-full py-4 text-[8.5px] uppercase tracking-[0.5em] text-white" style={{ background: '#111', fontFamily: 'system-ui' }}>Enquire About This Piece →</button>
        </div>
      </div>
    </div>
  );
}

// ── Section renderers ─────────────────────────────────────────────────────────

function SectionRenderer({ section, theme, items, onEnquire, onOpen }: {
  section  : Section;
  theme    : Theme;
  items    : StoreItem[];
  onEnquire: (item: StoreItem) => void;
  onOpen   : (item: StoreItem) => void;
}) {
  if (!section.enabled) return null;

  const scale    = sizeScale(theme);
  const vPad     = sectionPad(theme);
  const hPad     = horzPad(theme);
  const mxW      = pageMaxWidth(theme);
  const btn      = primaryBtn(theme);
  const border   = borderColor(theme);

  switch (section.type) {
    case 'announcement':
      return (
        <div style={{ background: section.bg_color, color: section.text_color, textAlign: 'center', padding: '10px 24px', fontFamily: 'system-ui', fontSize: `${10 * scale}px`, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          {section.text}
        </div>
      );

    case 'hero':
      return (
        <div style={{ background: section.bg_color, color: section.text_color, padding: `${vPad} ${hPad}`, minHeight: 'clamp(300px,50vh,600px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: mxW, width: '100%', margin: '0 auto' }}>
            <p style={{ fontSize: `${8 * scale}px`, textTransform: 'uppercase', letterSpacing: '0.6em', color: theme.color_accent, fontFamily: 'system-ui', marginBottom: '20px' }}>
              {items.length} pieces available
            </p>
            <h1 style={{ ...headingCss(theme, `clamp(${2.5*scale}rem,${8*scale}vw,${6*scale}rem)`), color: section.text_color }}>
              {section.headline}
            </h1>
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${13 * scale}px`, color: section.text_color === '#ffffff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', marginTop: '20px', maxWidth: '500px', lineHeight: 1.8 }}>
              {section.subheadline}
            </p>
            {section.cta_label && (
              <div style={{ marginTop: '40px' }}>
                <a href={section.cta_link || '#collection'}
                   style={{ display: 'inline-block', padding: `${13*scale}px ${36*scale}px`, fontSize: `${8*scale}px`, textTransform: 'uppercase', letterSpacing: '0.5em', fontFamily: 'system-ui', textDecoration: 'none', ...btn }}>
                  {section.cta_label}
                </a>
              </div>
            )}
          </div>
        </div>
      );

    case 'featured_products': {
      // Group a style's colourways into one product card (keyed by style_id).
      const styleGroups = new Map<string, StoreItem[]>();
      for (const it of items) {
        const k = String((it as Record<string, unknown>).style_id || it.id);
        if (!styleGroups.has(k)) styleGroups.set(k, []);
        styleGroups.get(k)!.push(it);
      }
      const shown = Array.from(styleGroups.values()).slice(0, section.count);
      const cols  = theme.grid_columns ?? (section.layout === 'row' ? 2 : 3);
      return (
        <div id="collection" style={{ padding: `${vPad} ${hPad}`, background: theme.color_bg }}>
          <div style={{ maxWidth: mxW, margin: '0 auto' }}>
            {section.title && (
              <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.55em', color: theme.color_accent, fontFamily: 'system-ui', marginBottom: '40px' }}>{section.title}</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: `clamp(16px,3vw,${32*scale}px) clamp(12px,2vw,${28*scale}px)` }}>
              {shown.map(group => {
                const item  = group[0];
                const imgs  = getImages(item);
                const price = Number(item.consumer_price ?? item.retail_price ?? 0);
                const cardStyle = theme.product_card_style ?? 'editorial';
                return (
                  <article key={item.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(item)}>
                    <div style={{ position: 'relative', aspectRatio: '2/3', background: theme.color_surface, overflow: 'hidden', marginBottom: `${10*scale}px` }}>
                      {imgs[0] && (
                        <img src={imgs[0]} alt={String(item.title??'')}
                             style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s ease' }}
                             onMouseOver={e => { if (cardStyle !== 'minimal') e.currentTarget.style.transform = 'scale(1.04)'; }}
                             onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }} />
                      )}
                      {item.featured && (
                        <span style={{ position: 'absolute', top: '12px', left: '12px', background: theme.color_accent, color: '#fff', fontSize: `${6*scale}px`, textTransform: 'uppercase', letterSpacing: '0.3em', padding: '3px 8px', fontFamily: 'system-ui' }}>
                          Featured
                        </span>
                      )}
                      {cardStyle === 'bold' ? (
                        <div className="card-hover-overlay"
                             style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s' }}
                             onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.55)'; const b = (e.currentTarget as HTMLElement).querySelector('button'); if (b) b.style.opacity = '1'; }}
                             onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)'; const b = (e.currentTarget as HTMLElement).querySelector('button'); if (b) b.style.opacity = '0'; }}>
                          <button onClick={e => { e.stopPropagation(); onEnquire(item); }}
                                  style={{ opacity: 0, padding: '12px 28px', fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.4em', fontFamily: 'system-ui', transition: 'opacity 0.3s', ...btn }}>
                            Enquire →
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); onEnquire(item); }}
                                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.4em', fontFamily: 'system-ui', transform: 'translateY(100%)', transition: 'transform 0.3s ease', ...btn }}>
                          Enquire →
                        </button>
                      )}
                    </div>
                    {item.season && <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#ccc', fontFamily: 'system-ui', marginBottom: '3px' }}>{String(item.season)}</p>}
                    <p style={{ ...headingCss(theme, `${13*scale}px`), color: theme.color_text, marginBottom: '3px' }}>{String(item.title??'')}</p>
                    <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#bbb', fontFamily: 'system-ui' }}>{String(item.brand_name??'')}</p>
                    {price > 0 && <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: `${11*scale}px`, color: theme.color_accent, marginTop: '5px' }}>${price.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})}</p>}
                    {group.length > 1 && (
                      <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                        {group.map((cw, ci) => {
                          const hex = String((cw as Record<string, unknown>).color_hex || '') || '#ddd';
                          return (
                            <button key={ci} onClick={e => { e.stopPropagation(); onOpen(cw); }}
                              title={String((cw as Record<string, unknown>).color ?? '')}
                              aria-label={`Colour ${ci + 1}`}
                              style={{ width: '13px', height: '13px', borderRadius: '50%', background: hex, border: '1px solid rgba(0,0,0,0.18)', cursor: 'pointer', padding: 0 }} />
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    case 'about':
      return (
        <div style={{ background: theme.color_surface, padding: `${vPad} ${hPad}`, display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: mxW, margin: '0 auto', display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            {section.image_url && <img src={section.image_url} alt="" style={{ width: '280px', height: '360px', objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: '260px' }}>
              <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.55em', color: theme.color_accent, fontFamily: 'system-ui', marginBottom: '20px' }}>{section.heading}</p>
              <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${13*scale}px`, color: theme.color_text, lineHeight: 1.9, maxWidth: '520px' }}>{section.body}</p>
            </div>
          </div>
        </div>
      );

    case 'brands_bar': {
      const brands = [...new Set(items.map(i => String(i.brand_name??'')).filter(Boolean))];
      return (
        <div style={{ borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: `28px ${hPad}`, background: theme.color_bg }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'center', maxWidth: mxW, margin: '0 auto' }}>
            {brands.map(b => (
              <p key={b} style={{ ...headingCss(theme, `${10*scale}px`), textTransform: 'uppercase', color: '#bbb' }}>{b}</p>
            ))}
          </div>
        </div>
      );
    }

    case 'contact':
      return (
        <div style={{ background: theme.color_surface, padding: `${vPad} ${hPad}`, textAlign: 'center' }}>
          <div style={{ maxWidth: mxW, margin: '0 auto' }}>
            <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.55em', color: theme.color_accent, fontFamily: 'system-ui', marginBottom: '20px' }}>{section.heading}</p>
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${13*scale}px`, color: '#aaa', marginBottom: '32px' }}>We'd love to hear from you.</p>
            <button onClick={() => document.dispatchEvent(new CustomEvent('open-enquiry'))}
                    style={{ padding: `${13*scale}px ${48*scale}px`, fontSize: `${8*scale}px`, textTransform: 'uppercase', letterSpacing: '0.5em', fontFamily: 'system-ui', ...btn }}>
              Send a Message
            </button>
          </div>
        </div>
      );

    default: return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StorefrontClient({ storefront, items }: {
  storefront: Storefront;
  items     : unknown[];
}) {
  const catalog = items as StoreItem[];
  const theme: Theme = storefront.theme ?? {
    ...DEFAULT_THEME,
    color_accent: storefront.accent_color || '#c9a84c',
    sections: [
      { id: 'hero',     type: 'hero',              enabled: true, headline: storefront.name, subheadline: storefront.tagline ?? '', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#ffffff', text_color: '#111111' },
      { id: 'featured', type: 'featured_products',  enabled: true, title: 'Collection', count: 24, layout: 'grid' },
      { id: 'contact',  type: 'contact',            enabled: true, heading: 'Get in Touch' },
    ],
  };

  const [enquireItem, setEnquireItem] = useState<StoreItem | null | undefined>(undefined);
  const [detailItem,  setDetailItem]  = useState<StoreItem | null>(null);

  // Listen for contact section button
  if (typeof window !== 'undefined') {
    document.addEventListener('open-enquiry', () => setEnquireItem(null), { once: true });
  }

  const scale   = sizeScale(theme);
  const hPad    = horzPad(theme);
  const mxW     = pageMaxWidth(theme);
  const nBg     = navBg(theme);
  const nText   = navText(theme);
  const border  = borderColor(theme);
  const navPad  = `0 ${hPad}`;
  const isCentered = theme.nav_style === 'centered';
  const isBold     = theme.nav_style === 'bold';

  return (
    <div style={{ minHeight: '100vh', background: theme.color_bg, color: theme.color_text, fontFamily: fontFamily(theme.font_body) }}>

      {/* Nav */}
      <header style={{
        position     : 'fixed',
        top          : 0, left: 0, right: 0,
        zIndex       : 30,
        background   : isBold ? nBg : `${nBg}f2`,
        borderBottom : `1px solid ${border}`,
        backdropFilter: isBold ? 'none' : 'blur(8px)',
      }}>
        <div style={{ maxWidth: mxW, margin: '0 auto', padding: navPad, height: '60px', display: 'flex', alignItems: 'center', justifyContent: isCentered ? 'center' : 'space-between', position: 'relative' }}>
          {isCentered && (
            <div style={{ position: 'absolute', left: hPad, display: 'flex', alignItems: 'center', gap: '20px' }}>
              {storefront.instagram && (
                <a href={`https://instagram.com/${storefront.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: `${8*scale}px`, textTransform: 'uppercase', letterSpacing: '0.4em', color: nText, fontFamily: 'system-ui', textDecoration: 'none', opacity: 0.6 }}>
                  Instagram
                </a>
              )}
            </div>
          )}
          <h1 style={{ ...headingCss(theme, `${14*scale}px`), color: nText, letterSpacing: '0.5em' }}>
            {storefront.name.toUpperCase()}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', ...(isCentered ? { position: 'absolute', right: hPad } : {}) }}>
            {!isCentered && storefront.instagram && (
              <a href={`https://instagram.com/${storefront.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: `${8*scale}px`, textTransform: 'uppercase', letterSpacing: '0.4em', color: nText, fontFamily: 'system-ui', textDecoration: 'none', opacity: 0.6 }}>
                Instagram
              </a>
            )}
            <button onClick={() => setEnquireItem(null)}
                    style={{ fontSize: `${8*scale}px`, textTransform: 'uppercase', letterSpacing: '0.4em', color: nText, fontFamily: 'system-ui', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
              Contact
            </button>
          </div>
        </div>
      </header>

      {/* Sections */}
      <main style={{ paddingTop: '60px' }}>
        {theme.sections.map(section => (
          <SectionRenderer key={section.id} section={section} theme={theme} items={catalog}
                           onEnquire={setEnquireItem} onOpen={setDetailItem} />
        ))}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: `clamp(24px,4vw,48px) ${hPad}`, background: theme.color_bg }}>
        <div style={{ maxWidth: mxW, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ ...headingCss(theme, `${12*scale}px`), color: theme.color_text, letterSpacing: '0.5em', marginBottom: '5px' }}>
              {storefront.name.toUpperCase()}
            </p>
            {storefront.contact_email && (
              <a href={`mailto:${storefront.contact_email}`} style={{ fontSize: `${9*scale}px`, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#aaa', fontFamily: 'system-ui', textDecoration: 'none' }}>
                {storefront.contact_email}
              </a>
            )}
          </div>
          <p style={{ fontSize: `${7*scale}px`, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#ddd', fontFamily: 'system-ui' }}>
            Powered by <span style={{ color: theme.color_accent }}>Linezheets</span>
          </p>
        </div>
      </footer>

      {/* Modals */}
      {detailItem && (
        <ProductDrawer item={detailItem} theme={theme}
                       onEnquire={() => { setEnquireItem(detailItem); setDetailItem(null); }}
                       onClose={() => setDetailItem(null)} />
      )}

      {enquireItem !== undefined && (
        <EnquiryModal slug={storefront.slug} product={enquireItem} theme={theme}
                      onClose={() => setEnquireItem(undefined)} />
      )}
    </div>
  );
}
