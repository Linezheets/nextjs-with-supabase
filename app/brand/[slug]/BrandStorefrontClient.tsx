'use client';

import { useState } from 'react';
import type { Theme, Section } from '@/app/dashboard/store/editor/EditorClient';
import { DEFAULT_THEME } from '@/app/dashboard/store/editor/EditorClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type BrandStorefront = {
  slug           : string;
  display_name   : string;
  brand_name     : string;
  tagline        : string | null;
  description    : string | null;
  contact_email  : string | null;
  instagram      : string | null;
  website        : string | null;
  theme          : Theme | null;
};

type StoreItem = {
  id            : number;
  title         : string | null;
  brand_name    : string;
  category      : string | null;
  color         : string | null;
  season        : string | null;
  description   : string | null;
  consumer_price: number | null;
  image_urls    : string[] | null;
  material      : string | null;
  gender        : string;
  featured      : boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fontFamily(font: string) {
  if (font === 'serif') return 'var(--font-serif), Georgia, "Times New Roman", serif';
  if (font === 'mono')  return 'var(--font-mono), monospace';
  return 'system-ui, -apple-system, sans-serif';
}

function getImages(item: StoreItem): string[] {
  return item.image_urls?.filter(Boolean) ?? [];
}

// ── Enquiry modal ─────────────────────────────────────────────────────────────

function EnquiryModal({ slug, product, theme, onClose }: {
  slug   : string;
  product: StoreItem | null;
  theme  : Theme;
  onClose: () => void;
}) {
  const [form, setForm]   = useState({ name: '', email: '', message: '' });
  const [sent, setSent]   = useState(false);
  const [error, setError] = useState('');
  const accent = theme.color_accent;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/brand-store/enquiry', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ slug, inventory_id: product?.id ?? null, ...form }),
    });
    if (res.ok) setSent(true);
    else setError('Something went wrong. Please try again.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div className="bg-white w-full max-w-md p-8 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[10px]" style={{ color: '#bbb' }}>✕</button>
        {sent ? (
          <div className="text-center py-8">
            <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5em', color: accent, fontFamily: 'system-ui', marginBottom: '12px' }}>Thank You</p>
            <p style={{ fontSize: '13px', color: '#333', fontFamily: fontFamily(theme.font_heading) }}>Your message has been sent.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5em', color: accent, fontFamily: 'system-ui', marginBottom: '4px' }}>Get in Touch</p>
              {product && <p style={{ fontSize: '12px', color: '#888', fontFamily: 'system-ui' }}>Re: {product.title}</p>}
            </div>
            {(['name','email','message'] as const).map(k => (
              <div key={k}>
                <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '6px' }}>{k}</p>
                {k === 'message' ? (
                  <textarea required rows={4} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                            className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none resize-none"
                            style={{ color: '#333', fontFamily: 'system-ui' }} />
                ) : (
                  <input required type={k === 'email' ? 'email' : 'text'} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                         className="w-full border-b border-zinc-200 pb-2 text-[13px] bg-transparent outline-none"
                         style={{ color: '#333', fontFamily: 'system-ui' }} />
                )}
              </div>
            ))}
            {error && <p style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'system-ui' }}>{error}</p>}
            <button type="submit" className="w-full py-3 text-[8.5px] uppercase tracking-[0.5em] text-white"
                    style={{ background: accent, fontFamily: 'system-ui' }}>
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Product drawer ────────────────────────────────────────────────────────────

function ProductDrawer({ item, theme, slug, onClose, onEnquire }: {
  item     : StoreItem;
  theme    : Theme;
  slug     : string;
  onClose  : () => void;
  onEnquire: (item: StoreItem) => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = getImages(item);
  const accent = theme.color_accent;
  const price = item.consumer_price ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
           onClick={e => e.stopPropagation()}>

        {/* Image */}
        <div className="relative aspect-[2/3] bg-zinc-50 shrink-0">
          {images[imgIdx] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[imgIdx]} alt={item.title ?? ''} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-px bg-zinc-200" />
            </div>
          )}
          <button onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 bg-white flex items-center justify-center"
                  style={{ fontSize: '10px', color: '#888' }}>✕</button>
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                        className="w-1.5 h-1.5 rounded-full transition-colors"
                        style={{ background: i === imgIdx ? accent : '#ddd' }} />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-8 flex-1">
          <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '8px' }}>
            {item.brand_name}
          </p>
          <h2 style={{ fontFamily: fontFamily(theme.font_heading), fontSize: '22px', fontWeight: 400, color: theme.color_text, marginBottom: '12px' }}>
            {item.title}
          </h2>
          {price > 0 && (
            <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '16px', color: accent, marginBottom: '20px' }}>
              ${price.toLocaleString()}
            </p>
          )}

          {item.description && (
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: '13px', color: '#666', lineHeight: 1.8, marginBottom: '20px' }}>
              {item.description}
            </p>
          )}

          <div className="space-y-2 mb-8">
            {[['Category', item.category],['Color', item.color],['Material', item.material],['Season', item.season],['Gender', item.gender]].map(([label, val]) =>
              val ? (
                <div key={String(label)} className="flex gap-4">
                  <span style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#bbb', fontFamily: 'system-ui', width: '64px', flexShrink: 0, paddingTop: '2px' }}>{label}</span>
                  <span style={{ fontSize: '12px', color: '#555', fontFamily: 'system-ui' }}>{String(val)}</span>
                </div>
              ) : null
            )}
          </div>

          <button onClick={() => onEnquire(item)}
                  className="w-full py-4 text-[8.5px] uppercase tracking-[0.5em] text-white transition-opacity hover:opacity-80"
                  style={{ background: accent, fontFamily: 'system-ui' }}>
            Enquire About This Piece
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────

function SectionRenderer({
  section,
  storefront,
  theme,
  items,
  onOpenProduct,
  onOpenEnquiry,
}: {
  section      : Section;
  storefront   : BrandStorefront;
  theme        : Theme;
  items        : StoreItem[];
  onOpenProduct: (item: StoreItem) => void;
  onOpenEnquiry: () => void;
}) {
  if (!section.enabled) return null;
  const accent  = theme.color_accent;
  const headingFont = fontFamily(theme.font_heading);

  switch (section.type) {
    case 'announcement':
      return (
        <div style={{ background: section.bg_color, color: section.text_color, padding: '10px 32px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase', fontFamily: 'system-ui' }}>
          {section.text}
        </div>
      );

    case 'hero':
      return (
        <div style={{ background: section.bg_color, color: section.text_color, padding: '120px 64px 80px', minHeight: '600px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {storefront.tagline && (
            <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6em', color: accent, fontFamily: 'system-ui', marginBottom: '16px' }}>
              {storefront.tagline}
            </p>
          )}
          <h1 style={{ fontFamily: headingFont, fontSize: 'clamp(2.5rem, 7vw, 6rem)', fontWeight: 400, lineHeight: 1, color: section.text_color }}>
            {section.headline}
          </h1>
          <p style={{ fontFamily: 'system-ui', fontSize: '14px', color: section.text_color === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', marginTop: '20px', maxWidth: '520px', lineHeight: 1.8 }}>
            {section.subheadline}
          </p>
          {section.cta_label && (
            <button onClick={onOpenEnquiry}
                    className="mt-10 inline-block transition-opacity hover:opacity-80"
                    style={{ padding: '14px 40px', background: accent, color: '#fff', fontFamily: 'system-ui', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.5em' }}>
              {section.cta_label}
            </button>
          )}
        </div>
      );

    case 'featured_products': {
      const featured = items.filter(i => i.featured);
      const shown    = featured.length ? featured.slice(0, section.count) : items.slice(0, section.count);
      const cols     = section.layout === 'row' ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(220px,1fr))';
      return (
        <div id="collection" style={{ padding: '80px 48px', background: theme.color_bg }}>
          {section.title && (
            <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.6em', color: accent, fontFamily: 'system-ui', marginBottom: '40px' }}>
              {section.title}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '24px' }}>
            {shown.map(item => {
              const imgs = getImages(item);
              const price = item.consumer_price ?? 0;
              return (
                <div key={item.id} className="group cursor-pointer" onClick={() => onOpenProduct(item)}>
                  <div style={{ aspectRatio: '2/3', background: '#f4f4f4', overflow: 'hidden', marginBottom: '12px', position: 'relative' }}>
                    {imgs[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgs[0]} alt={item.title ?? ''} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    )}
                    {imgs[1] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgs[1]} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                  <p style={{ fontFamily: headingFont, fontSize: '14px', fontWeight: 400, color: theme.color_text, marginBottom: '4px' }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '6px' }}>
                    {item.color ?? item.category ?? ''}
                  </p>
                  {price > 0 && (
                    <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '12px', color: accent }}>
                      ${price.toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'about':
      return (
        <div style={{ padding: '80px 48px', background: theme.color_surface, display: 'flex', gap: '60px', alignItems: 'center' }}>
          {section.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.image_url} alt="" style={{ width: '320px', height: '420px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div>
            <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.6em', color: accent, fontFamily: 'system-ui', marginBottom: '20px' }}>
              {section.heading}
            </p>
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: '15px', color: theme.color_text, lineHeight: 1.9, maxWidth: '520px' }}>
              {section.body}
            </p>
          </div>
        </div>
      );

    case 'contact':
      return (
        <div style={{ padding: '80px 48px', textAlign: 'center', background: theme.color_surface }}>
          <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.6em', color: accent, fontFamily: 'system-ui', marginBottom: '20px' }}>
            {section.heading}
          </p>
          {storefront.contact_email && (
            <p style={{ fontFamily: 'system-ui', fontSize: '14px', color: '#888', marginBottom: '32px' }}>
              {storefront.contact_email}
            </p>
          )}
          <button onClick={onOpenEnquiry}
                  className="transition-opacity hover:opacity-70"
                  style={{ padding: '14px 48px', border: `1px solid ${accent}`, color: accent, fontFamily: 'system-ui', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.5em', background: 'transparent', cursor: 'pointer' }}>
            Send a Message
          </button>
        </div>
      );

    default: return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BrandStorefrontClient({
  storefront,
  items,
}: {
  storefront: BrandStorefront;
  items     : StoreItem[];
}) {
  const [openProduct, setOpenProduct] = useState<StoreItem | null>(null);
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryItem, setEnquiryItem] = useState<StoreItem | null>(null);
  const [menuOpen,    setMenuOpen]    = useState(false);

  const defaultTheme: Theme = {
    ...DEFAULT_THEME,
    color_accent: '#111111',
    sections: [
      { id: 'hero',     type: 'hero',             enabled: true,  headline: storefront.display_name, subheadline: storefront.tagline ?? 'Explore our latest collection.', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#ffffff', text_color: '#111111' },
      { id: 'featured', type: 'featured_products', enabled: true,  title: 'Collection', count: 12, layout: 'grid' },
      { id: 'contact',  type: 'contact',           enabled: true,  heading: 'Get in Touch' },
    ],
  };

  const theme  = (storefront.theme ?? defaultTheme) as Theme;
  const accent = theme.color_accent;
  const headingFont = fontFamily(theme.font_heading);

  function openEnquiry(item?: StoreItem) {
    setEnquiryItem(item ?? null);
    setShowEnquiry(true);
  }

  return (
    <div style={{ background: theme.color_bg, color: theme.color_text, minHeight: '100vh', fontFamily: fontFamily(theme.font_body) }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: theme.color_bg, borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '0 48px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: headingFont, fontSize: '14px', letterSpacing: '0.4em', color: theme.color_text }}>
          {storefront.display_name.toUpperCase()}
        </span>
        <div className="hidden sm:flex items-center gap-8">
          <a href="#collection" style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#888', fontFamily: 'system-ui', textDecoration: 'none' }}>
            Collection
          </a>
          {storefront.instagram && (
            <a href={`https://instagram.com/${storefront.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#888', fontFamily: 'system-ui', textDecoration: 'none' }}>
              Instagram
            </a>
          )}
          <button onClick={() => openEnquiry()}
                  style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#888', fontFamily: 'system-ui', background: 'none', border: 'none', cursor: 'pointer' }}>
            Contact
          </button>
        </div>
        <button className="sm:hidden" onClick={() => setMenuOpen(m => !m)}
                style={{ fontSize: '18px', color: theme.color_text, background: 'none', border: 'none', cursor: 'pointer' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: theme.color_bg, borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '20px 48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <a href="#collection" onClick={() => setMenuOpen(false)} style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#888', fontFamily: 'system-ui', textDecoration: 'none' }}>Collection</a>
          <button onClick={() => { openEnquiry(); setMenuOpen(false); }} style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#888', fontFamily: 'system-ui', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Contact</button>
        </div>
      )}

      {/* Sections */}
      {theme.sections.map(section => (
        <SectionRenderer
          key={section.id}
          section={section}
          storefront={storefront}
          theme={theme}
          items={items}
          onOpenProduct={item => setOpenProduct(item)}
          onOpenEnquiry={() => openEnquiry()}
        />
      ))}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <span style={{ fontFamily: headingFont, fontSize: '12px', letterSpacing: '0.4em', color: theme.color_text }}>
          {storefront.display_name.toUpperCase()}
        </span>
        <div className="flex items-center gap-6">
          {storefront.website && (
            <a href={storefront.website} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#bbb', fontFamily: 'system-ui', textDecoration: 'none' }}>
              Website ↗
            </a>
          )}
          <span style={{ fontSize: '8px', color: '#ddd', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'system-ui' }}>
            Powered by <span style={{ color: accent }}>Linezheets</span>
          </span>
        </div>
      </footer>

      {/* Product drawer */}
      {openProduct && (
        <ProductDrawer
          item={openProduct}
          theme={theme}
          slug={storefront.slug}
          onClose={() => setOpenProduct(null)}
          onEnquire={item => { setOpenProduct(null); openEnquiry(item); }}
        />
      )}

      {/* Enquiry modal */}
      {showEnquiry && (
        <EnquiryModal
          slug={storefront.slug}
          product={enquiryItem}
          theme={theme}
          onClose={() => { setShowEnquiry(false); setEnquiryItem(null); }}
        />
      )}
    </div>
  );
}
