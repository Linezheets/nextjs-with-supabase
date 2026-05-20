'use client';

import { useState, useCallback, useRef } from 'react';
import type { CatalogItem } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Section =
  | { id: string; type: 'hero';             enabled: boolean; headline: string; subheadline: string; cta_label: string; cta_link: string; bg_color: string; text_color: string }
  | { id: string; type: 'announcement';     enabled: boolean; text: string; bg_color: string; text_color: string }
  | { id: string; type: 'featured_products';enabled: boolean; title: string; count: number; layout: 'grid' | 'row' }
  | { id: string; type: 'about';            enabled: boolean; heading: string; body: string; image_url?: string }
  | { id: string; type: 'brands_bar';       enabled: boolean }
  | { id: string; type: 'contact';          enabled: boolean; heading: string };

export type Theme = {
  // ── Typography ──────────────────────────────────────────────────────────────
  font_heading       : string;                                // serif | sans | mono
  font_body          : string;
  font_size_scale    : 'compact' | 'default' | 'large';      // 0.85× | 1× | 1.15×
  heading_weight     : '300' | '400' | '500' | '700';
  heading_transform  : 'none' | 'uppercase' | 'capitalize';
  letter_spacing     : 'tight' | 'normal' | 'wide';

  // ── Colours ──────────────────────────────────────────────────────────────────
  color_accent       : string;
  color_bg           : string;
  color_text         : string;
  color_surface      : string;
  color_nav_bg       : string;    // nav background ('' = transparent/same as bg)
  color_nav_text     : string;    // nav text ('' = same as color_text)
  color_button_bg    : string;    // primary button fill ('' = same as accent)
  color_button_text  : string;    // primary button label
  color_border       : string;    // divider / border colour

  // ── Layout ───────────────────────────────────────────────────────────────────
  nav_style          : 'minimal' | 'centered' | 'bold';
  page_width         : 'contained' | 'wide' | 'full';        // 1280 | 1440 | 100%
  section_padding    : 'compact' | 'standard' | 'spacious';
  grid_columns       : 2 | 3 | 4;
  product_card_style : 'minimal' | 'editorial' | 'bold';

  // ── Buttons ──────────────────────────────────────────────────────────────────
  button_style       : 'solid' | 'outline' | 'ghost';
  button_radius      : 'none' | 'small' | 'full';

  sections           : Section[];
};

export type Storefront = {
  id           : string;
  slug         : string;
  name         : string;
  tagline      : string | null;
  description  : string | null;
  accent_color : string;
  contact_email: string | null;
  instagram    : string | null;
  website      : string | null;
  published    : boolean;
  custom_domain: string | null;
  domain_verified: boolean;
  theme        : Theme;
};

// ── Theme defaults & presets ──────────────────────────────────────────────────

export const DEFAULT_THEME: Omit<Theme, 'sections'> = {
  font_heading      : 'serif',
  font_body         : 'sans',
  font_size_scale   : 'default',
  heading_weight    : '400',
  heading_transform : 'none',
  letter_spacing    : 'normal',
  color_accent      : '#c9a84c',
  color_bg          : '#ffffff',
  color_text        : '#111111',
  color_surface     : '#f9f9f9',
  color_nav_bg      : '',
  color_nav_text    : '',
  color_button_bg   : '',
  color_button_text : '#ffffff',
  color_border      : '#f0f0f0',
  nav_style         : 'minimal',
  page_width        : 'contained',
  section_padding   : 'standard',
  grid_columns      : 3,
  product_card_style: 'editorial',
  button_style      : 'solid',
  button_radius     : 'none',
};

type Preset = { label: string; description: string; values: Partial<Omit<Theme,'sections'>> };

export const THEME_PRESETS: Preset[] = [
  {
    label: 'Maison',
    description: 'Serif elegance, gold accent',
    values: { font_heading: 'serif', font_body: 'sans', heading_weight: '400', font_size_scale: 'default', letter_spacing: 'normal', heading_transform: 'none', color_accent: '#c9a84c', color_bg: '#ffffff', color_text: '#111111', color_surface: '#f9f9f9', color_border: '#f0f0f0', color_nav_bg: '', color_nav_text: '', color_button_bg: '', color_button_text: '#ffffff', nav_style: 'minimal', page_width: 'contained', section_padding: 'standard', grid_columns: 3, product_card_style: 'editorial', button_style: 'solid', button_radius: 'none' },
  },
  {
    label: 'Noir',
    description: 'Dark luxury, high contrast',
    values: { font_heading: 'serif', font_body: 'sans', heading_weight: '300', font_size_scale: 'large', letter_spacing: 'wide', heading_transform: 'uppercase', color_accent: '#e8d5a0', color_bg: '#0a0a0a', color_text: '#f0f0f0', color_surface: '#151515', color_border: '#222222', color_nav_bg: '#0a0a0a', color_nav_text: '#f0f0f0', color_button_bg: '#e8d5a0', color_button_text: '#0a0a0a', nav_style: 'bold', page_width: 'wide', section_padding: 'spacious', grid_columns: 3, product_card_style: 'bold', button_style: 'solid', button_radius: 'none' },
  },
  {
    label: 'Minimal',
    description: 'Clean, typographic, Swiss',
    values: { font_heading: 'sans', font_body: 'sans', heading_weight: '500', font_size_scale: 'default', letter_spacing: 'tight', heading_transform: 'uppercase', color_accent: '#111111', color_bg: '#ffffff', color_text: '#111111', color_surface: '#ffffff', color_border: '#e8e8e8', color_nav_bg: '', color_nav_text: '', color_button_bg: '#111111', color_button_text: '#ffffff', nav_style: 'minimal', page_width: 'contained', section_padding: 'compact', grid_columns: 4, product_card_style: 'minimal', button_style: 'outline', button_radius: 'none' },
  },
  {
    label: 'Editorial',
    description: 'Wide, generous, magazine-like',
    values: { font_heading: 'serif', font_body: 'serif', heading_weight: '400', font_size_scale: 'large', letter_spacing: 'normal', heading_transform: 'none', color_accent: '#8b6f4e', color_bg: '#faf8f5', color_text: '#2c2c2c', color_surface: '#f2ede6', color_border: '#e8e0d4', color_nav_bg: '#faf8f5', color_nav_text: '#2c2c2c', color_button_bg: '#2c2c2c', color_button_text: '#faf8f5', nav_style: 'centered', page_width: 'wide', section_padding: 'spacious', grid_columns: 2, product_card_style: 'editorial', button_style: 'solid', button_radius: 'none' },
  },
  {
    label: 'Studio',
    description: 'Mono type, architectural grid',
    values: { font_heading: 'mono', font_body: 'mono', heading_weight: '400', font_size_scale: 'compact', letter_spacing: 'wide', heading_transform: 'uppercase', color_accent: '#0066ff', color_bg: '#ffffff', color_text: '#000000', color_surface: '#f5f5f5', color_border: '#dddddd', color_nav_bg: '#000000', color_nav_text: '#ffffff', color_button_bg: '#0066ff', color_button_text: '#ffffff', nav_style: 'bold', page_width: 'full', section_padding: 'compact', grid_columns: 4, product_card_style: 'minimal', button_style: 'solid', button_radius: 'small' },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hero             : 'Hero Banner',
  announcement     : 'Announcement Bar',
  featured_products: 'Product Grid',
  about            : 'About / Story',
  brands_bar       : 'Brands Showcase',
  contact          : 'Contact',
};

const SECTION_ICONS: Record<string, string> = {
  hero             : '▬',
  announcement     : '📢',
  featured_products: '⊞',
  about            : '◧',
  brands_bar       : '◈',
  contact          : '✉',
};

const ADD_SECTION_OPTIONS: { type: Section['type']; label: string }[] = [
  { type: 'announcement',      label: 'Announcement Bar' },
  { type: 'hero',              label: 'Hero Banner' },
  { type: 'featured_products', label: 'Product Grid' },
  { type: 'about',             label: 'About / Story' },
  { type: 'brands_bar',        label: 'Brands Showcase' },
  { type: 'contact',           label: 'Contact' },
];

function newSection(type: Section['type']): Section {
  const id = `${type}-${Date.now()}`;
  switch (type) {
    case 'announcement':      return { id, type, enabled: true, text: 'Free shipping on orders over $500', bg_color: '#111', text_color: '#fff' };
    case 'hero':              return { id, type, enabled: true, headline: 'New Collection', subheadline: 'Discover curated pieces from the finest houses.', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#0a0a0a', text_color: '#ffffff' };
    case 'featured_products': return { id, type, enabled: true, title: 'Featured', count: 8, layout: 'grid' };
    case 'about':             return { id, type, enabled: true, heading: 'Our Story', body: 'Tell your customers who you are.' };
    case 'brands_bar':        return { id, type, enabled: true };
    case 'contact':           return { id, type, enabled: true, heading: 'Get in Touch' };
  }
}

// ── Theme CSS helpers ─────────────────────────────────────────────────────────

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

function letterSpacingVal(t: Theme) {
  if (t.letter_spacing === 'tight') return '-0.02em';
  if (t.letter_spacing === 'wide')  return '0.06em';
  return '0em';
}

function sectionPad(t: Theme) {
  if (t.section_padding === 'compact')   return 'clamp(28px,4vw,48px)';
  if (t.section_padding === 'spacious')  return 'clamp(64px,10vw,120px)';
  return 'clamp(40px,6vw,80px)';
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

function btnStyle(t: Theme) {
  const bg    = t.color_button_bg   || t.color_accent;
  const color = t.color_button_text || '#ffffff';
  const r     = btnRadius(t);
  if (t.button_style === 'ghost')   return { background: 'transparent', color: bg, border: 'none',              borderRadius: r } as React.CSSProperties;
  if (t.button_style === 'outline') return { background: 'transparent', color: bg, border: `1px solid ${bg}`,   borderRadius: r } as React.CSSProperties;
  return { background: bg, color, border: 'none', borderRadius: r } as React.CSSProperties;
}

function navBg(t: Theme) { return t.color_nav_bg   || t.color_bg; }
function navText(t: Theme) { return t.color_nav_text || t.color_text; }

// ── Live preview (server-rendered substitute) ─────────────────────────────────

function LivePreview({ storefront, theme, items }: { storefront: Storefront; theme: Theme; items: CatalogItem[] }) {
  const accent    = theme.color_accent;
  const scale     = sizeScale(theme);
  const hTracking = letterSpacingVal(theme);

  const headingStyle = (size: number): React.CSSProperties => ({
    fontFamily    : fontFamily(theme.font_heading),
    fontSize      : `${size * scale}rem`,
    fontWeight    : Number(theme.heading_weight ?? 400),
    letterSpacing : hTracking,
    textTransform : (theme.heading_transform ?? 'none') as React.CSSProperties['textTransform'],
    lineHeight    : 1.05,
  });

  const pad   = sectionPad(theme);
  const mxAuto = { maxWidth: pageMaxWidth(theme), margin: '0 auto', padding: `0 clamp(20px,4vw,48px)` };
  const btnCss = btnStyle(theme);
  const nBg   = navBg(theme);
  const nText = navText(theme);

  function renderSection(s: Section) {
    if (!s.enabled) return null;

    switch (s.type) {
      case 'announcement':
        return (
          <div key={s.id} style={{ background: s.bg_color, color: s.text_color, fontFamily: 'system-ui', fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', textAlign: 'center', padding: '9px 24px' }}>
            {s.text}
          </div>
        );

      case 'hero':
        return (
          <div key={s.id} style={{ background: s.bg_color, color: s.text_color, padding: `${pad} clamp(20px,4vw,48px)`, minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {storefront.tagline && (
              <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.6em', color: accent, fontFamily: 'system-ui', marginBottom: '10px' }}>
                {storefront.tagline}
              </p>
            )}
            <h1 style={{ ...headingStyle(2.6 * scale), color: s.text_color }}>{s.headline}</h1>
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${11 * scale}px`, color: s.text_color === '#ffffff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', marginTop: '10px', maxWidth: '400px', lineHeight: 1.7 }}>
              {s.subheadline}
            </p>
            {s.cta_label && (
              <div style={{ marginTop: '24px', display: 'inline-block', padding: '10px 28px', fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.45em', fontFamily: 'system-ui', ...btnCss }}>
                {s.cta_label}
              </div>
            )}
          </div>
        );

      case 'featured_products': {
        const shown = items.slice(0, s.count);
        const cols  = theme.grid_columns ?? (s.layout === 'row' ? 2 : 3);
        return (
          <div key={s.id} style={{ background: theme.color_bg, padding: `${pad} clamp(20px,4vw,48px)` }}>
            {s.title && (
              <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '22px' }}>
                {s.title}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: '14px' }}>
              {shown.map(item => {
                const img   = String(item.image_url ?? (Array.isArray(item.image_urls) ? item.image_urls[0] : '') ?? '');
                const price = Number(item.retail_price ?? 0);
                return (
                  <div key={String(item.id)}>
                    <div style={{ aspectRatio: '2/3', background: theme.color_surface, overflow: 'hidden', marginBottom: '8px' }}>
                      {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <p style={{ ...headingStyle(0.75), color: theme.color_text, marginBottom: '2px', lineHeight: 1.3 }}>
                      {String(item.title ?? '')}
                    </p>
                    <p style={{ fontFamily: 'system-ui', fontSize: '8px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                      {String(item.brand_name ?? '')}
                    </p>
                    {price > 0 && (
                      <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: `${10 * scale}px`, color: accent, marginTop: '3px' }}>
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
          <div key={s.id} style={{ background: theme.color_surface, padding: `${pad} clamp(20px,4vw,48px)`, display: 'flex', gap: '32px', alignItems: 'center' }}>
            {s.image_url && (
              <img src={s.image_url} alt="" style={{ width: '160px', height: '210px', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '12px' }}>{s.heading}</p>
              <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${12 * scale}px`, color: theme.color_text, lineHeight: 1.85, maxWidth: '440px' }}>
                {s.body}
              </p>
            </div>
          </div>
        );

      case 'brands_bar': {
        const brands = [...new Set(items.map(i => String(i.brand_name ?? '')).filter(Boolean))];
        return (
          <div key={s.id} style={{ borderTop: `1px solid ${theme.color_border ?? '#f0f0f0'}`, borderBottom: `1px solid ${theme.color_border ?? '#f0f0f0'}`, padding: `20px clamp(20px,4vw,48px)`, background: theme.color_bg }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
              {brands.map(b => (
                <p key={b} style={{ ...headingStyle(0.65), textTransform: 'uppercase', color: '#bbb' }}>{b}</p>
              ))}
            </div>
          </div>
        );
      }

      case 'contact':
        return (
          <div key={s.id} style={{ background: theme.color_surface, padding: `${pad} clamp(20px,4vw,48px)`, textAlign: 'center' }}>
            <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '12px' }}>{s.heading}</p>
            <p style={{ fontFamily: fontFamily(theme.font_body), fontSize: `${11 * scale}px`, color: '#aaa', marginBottom: '20px' }}>
              {storefront.contact_email ?? 'Add your contact email in settings'}
            </p>
            <div style={{ display: 'inline-block', padding: '10px 28px', fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.45em', fontFamily: 'system-ui', ...btnCss }}>
              Send Message
            </div>
          </div>
        );

      default: return null;
    }
  }

  return (
    <div style={{ background: theme.color_bg, minHeight: '100%', fontFamily: fontFamily(theme.font_body) }}>
      {/* Preview nav */}
      <div style={{
        borderBottom: `1px solid ${theme.color_border ?? '#f0f0f0'}`,
        padding     : '0 32px',
        height      : '44px',
        display     : 'flex',
        alignItems  : 'center',
        justifyContent: theme.nav_style === 'centered' ? 'center' : 'space-between',
        background  : nBg,
        position    : 'relative',
      }}>
        {theme.nav_style === 'centered' ? (
          <>
            <span style={{ position: 'absolute', left: '32px', fontSize: '7.5px', color: nText, textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: 'system-ui', opacity: 0.5 }}>Shop · About</span>
            <span style={{ ...headingStyle(0.72), color: nText }}>{storefront.name.toUpperCase()}</span>
            <span style={{ position: 'absolute', right: '32px', fontSize: '7.5px', color: nText, textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: 'system-ui', opacity: 0.5 }}>Contact</span>
          </>
        ) : (
          <>
            <span style={{ ...headingStyle(0.72), color: nText }}>{storefront.name.toUpperCase()}</span>
            <span style={{ fontSize: '7.5px', color: nText, textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: 'system-ui', opacity: 0.5 }}>Shop · About · Contact</span>
          </>
        )}
      </div>

      {theme.sections.map(renderSection)}

      {/* Preview footer */}
      <div style={{ borderTop: `1px solid ${theme.color_border ?? '#f0f0f0'}`, padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...headingStyle(0.65), color: theme.color_text }}>{storefront.name.toUpperCase()}</span>
        <span style={{ fontSize: '7px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'system-ui' }}>
          Powered by <span style={{ color: accent }}>Linezheets</span>
        </span>
      </div>
    </div>
  );
}

// ── Section settings panel ────────────────────────────────────────────────────

function SectionSettings({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  function set<K extends keyof Section>(key: K, value: Section[K]) {
    onChange({ ...section, [key]: value } as Section);
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between cursor-pointer">
        <span style={{ fontSize: '11px', color: '#555', fontFamily: 'system-ui' }}>Visible</span>
        <button onClick={() => set('enabled', !section.enabled)}
                className="w-10 h-5 relative transition-colors"
                style={{ background: section.enabled ? '#c9a84c' : '#e0e0e0', borderRadius: '10px' }}>
          <span className="absolute top-0.5 w-4 h-4 bg-white transition-all"
                style={{ left: section.enabled ? '22px' : '2px', borderRadius: '8px' }} />
        </button>
      </label>

      {section.type === 'hero' && (
        <>
          <EditorField label="Headline"><input value={section.headline} onChange={e => set('headline' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Subheadline"><input value={section.subheadline} onChange={e => set('subheadline' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Button Label"><input value={section.cta_label} onChange={e => set('cta_label' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Background Color"><input type="color" value={section.bg_color} onChange={e => set('bg_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
          <EditorField label="Text Color"><input type="color" value={section.text_color} onChange={e => set('text_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
        </>
      )}

      {section.type === 'announcement' && (
        <>
          <EditorField label="Text"><input value={section.text} onChange={e => set('text' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Background"><input type="color" value={section.bg_color} onChange={e => set('bg_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
          <EditorField label="Text Color"><input type="color" value={section.text_color} onChange={e => set('text_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
        </>
      )}

      {section.type === 'featured_products' && (
        <>
          <EditorField label="Section Title"><input value={section.title} onChange={e => set('title' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Product Count">
            <input type="number" min={1} max={24} value={section.count} onChange={e => set('count' as never, Number(e.target.value) as never)} />
          </EditorField>
          <EditorField label="Layout">
            <select value={section.layout} onChange={e => set('layout' as never, e.target.value as never)}
                    className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none" style={{ color: '#333', fontFamily: 'system-ui' }}>
              <option value="grid">Grid (3 columns)</option>
              <option value="row">Row (2 columns)</option>
            </select>
          </EditorField>
        </>
      )}

      {section.type === 'about' && (
        <>
          <EditorField label="Heading"><input value={section.heading} onChange={e => set('heading' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Body Text">
            <textarea value={section.body} rows={4} onChange={e => set('body' as never, e.target.value as never)}
                      className="w-full border-b border-zinc-200 pb-2 text-[12px] bg-transparent outline-none resize-none placeholder:text-zinc-300"
                      style={{ color: '#333', fontFamily: 'system-ui' }} />
          </EditorField>
          <EditorField label="Image URL (optional)">
            <input value={section.image_url ?? ''} onChange={e => set('image_url' as never, e.target.value as never)} placeholder="https://…" />
          </EditorField>
        </>
      )}

      {section.type === 'contact' && (
        <EditorField label="Heading"><input value={section.heading} onChange={e => set('heading' as never, e.target.value as never)} /></EditorField>
      )}

      {section.type === 'brands_bar' && (
        <p style={{ fontSize: '11px', color: '#aaa', fontFamily: 'system-ui' }}>
          Automatically shows all brands from your published products.
        </p>
      )}
    </div>
  );
}

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', marginBottom: '6px', fontFamily: 'system-ui' }}>{label}</p>
      <div style={{ borderBottom: '1px solid #e8e8e8' }}>
        {Array.isArray(children) ? children : (
          typeof children === 'object' && children !== null && 'type' in (children as React.ReactElement) &&
          ((children as React.ReactElement).type === 'input' || (children as React.ReactElement).type === 'textarea' || (children as React.ReactElement).type === 'select')
            ? <>{children}</>
            : children
        )}
      </div>
    </div>
  );
}

// ── Domain panel ──────────────────────────────────────────────────────────────

function DomainPanel({ storefront, slug, onSave }: {
  storefront: Storefront;
  slug      : string;
  onSave    : (updated: Partial<Storefront>) => void;
}) {
  const [customDomain, setCustomDomain] = useState(storefront.custom_domain ?? '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  async function saveDomain() {
    setSaving(true); setError('');
    const domain = customDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const res = await fetch('/api/store', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        slug         : storefront.slug,
        name         : storefront.name,
        custom_domain: domain || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
    setSaved(true);
    onSave({ custom_domain: domain || null });
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Platform domain */}
      <div className="p-4 border border-zinc-100 bg-zinc-50">
        <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#c9a84c', fontFamily: 'system-ui', marginBottom: '6px' }}>
          Platform URL
        </p>
        <p style={{ fontFamily: 'system-ui', fontSize: '12px', color: '#333' }}>
          linezheets.com/store/<strong>{slug}</strong>
        </p>
        <p style={{ fontSize: '9px', color: '#bbb', fontFamily: 'system-ui', marginTop: '4px' }}>
          Always available. No setup needed.
        </p>
      </div>

      {/* Custom domain */}
      <div>
        <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '8px' }}>
          Custom Domain
        </p>
        <input
          value={customDomain}
          onChange={e => setCustomDomain(e.target.value)}
          placeholder="shop.yourboutique.com"
          className="w-full border-b border-zinc-200 pb-2 text-[12px] outline-none focus:border-black transition-colors placeholder:text-zinc-300"
          style={{ color: '#333', fontFamily: 'system-ui' }}
        />
        {error && <p style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'system-ui', marginTop: '6px' }}>{error}</p>}
        <button onClick={saveDomain} disabled={saving}
                className="mt-4 px-6 py-2 text-[8px] uppercase tracking-[0.4em] text-white disabled:opacity-40 transition-opacity"
                style={{ background: '#111', fontFamily: 'system-ui' }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Domain'}
        </button>
      </div>

      {/* DNS instructions */}
      {(customDomain || storefront.custom_domain) && (
        <div className="p-4 border border-zinc-200 space-y-3">
          <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui' }}>
            DNS Configuration
          </p>
          <p style={{ fontSize: '11px', color: '#555', fontFamily: 'system-ui', lineHeight: 1.7 }}>
            Point your domain to Linezheets by adding a <strong>CNAME</strong> record in your DNS provider:
          </p>
          <div className="font-mono text-[10px] p-3 bg-zinc-50 border border-zinc-100 space-y-1">
            <p style={{ color: '#888' }}>Type &nbsp;→ <span style={{ color: '#333' }}>CNAME</span></p>
            <p style={{ color: '#888' }}>Name &nbsp;→ <span style={{ color: '#333' }}>{(customDomain || (storefront.custom_domain ?? '')).split('.')[0]}</span></p>
            <p style={{ color: '#888' }}>Value → <span style={{ color: '#c9a84c' }}>stores.linezheets.com</span></p>
            <p style={{ color: '#888' }}>TTL &nbsp;→ <span style={{ color: '#333' }}>3600</span></p>
          </div>
          <p style={{ fontSize: '9px', color: '#bbb', fontFamily: 'system-ui' }}>
            DNS changes can take up to 48 hours to propagate. Verification is automatic once propagated.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: storefront.domain_verified ? '#52b788' : '#e0e0e0' }} />
            <p style={{ fontSize: '9px', color: storefront.domain_verified ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
              {storefront.domain_verified ? 'Domain verified ✓' : 'Awaiting verification'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Theme panel ───────────────────────────────────────────────────────────────

function ThemeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 pb-5 mb-5">
      <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.5em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '14px' }}>{title}</p>
      {children}
    </div>
  );
}

function ThemeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '5px' }}>{label}</p>
      {children}
    </div>
  );
}

function ThemeSelect({ value, onChange, options }: {
  value   : string;
  onChange: (v: string) => void;
  options : { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none"
            style={{ color: '#333', fontFamily: 'system-ui' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ColorRow({ label, value, onChange, optional }: {
  label   : string;
  value   : string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const effectiveValue = value || '#ffffff';
  return (
    <div className="flex items-center justify-between mb-2.5">
      <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui' }}>
        {label}{optional && <span style={{ color: '#ddd' }}> (opt)</span>}
      </p>
      <div className="flex items-center gap-2">
        {optional && value && (
          <button onClick={() => onChange('')} style={{ fontSize: '8px', color: '#ccc', fontFamily: 'system-ui' }}>✕</button>
        )}
        <span style={{ fontSize: '9px', color: '#bbb', fontFamily: 'var(--font-mono), monospace' }}>{value || 'auto'}</span>
        <input type="color" value={effectiveValue} onChange={e => onChange(e.target.value)}
               className="w-8 h-8 border-0 bg-transparent cursor-pointer"
               style={{ opacity: value ? 1 : 0.35 }} />
      </div>
    </div>
  );
}

function ThemePanel({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  function set<K extends keyof Theme>(key: K, value: Theme[K]) {
    onChange({ ...theme, [key]: value });
  }

  const [themeTab, setThemeTab] = useState<'presets' | 'type' | 'color' | 'layout' | 'buttons'>('presets');

  const tabStyle = (t: string) => ({
    fontSize  : '6.5px' as const,
    fontFamily: 'system-ui',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    padding   : '7px 0',
    color     : themeTab === t ? '#111' : '#bbb',
    borderBottom: themeTab === t ? '2px solid #111' : '2px solid transparent',
    background: 'transparent',
    flex      : 1,
    cursor    : 'pointer',
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-100 mb-5 -mx-4 px-4">
        {(['presets','type','color','layout','buttons'] as const).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setThemeTab(t)}>
            {t === 'type' ? 'Type' : t === 'color' ? 'Color' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Presets ─────────────────────────────────────────────────────────── */}
      {themeTab === 'presets' && (
        <div className="space-y-2">
          <p style={{ fontSize: '9px', color: '#aaa', fontFamily: 'system-ui', marginBottom: '14px', lineHeight: 1.6 }}>
            Start from a preset, then fine-tune in the other tabs.
          </p>
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => onChange({ ...theme, ...preset.values })}
              className="w-full text-left px-4 py-3 border border-zinc-100 hover:border-zinc-300 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize: '11px', color: '#111', fontFamily: 'system-ui', fontWeight: 500 }}>{preset.label}</p>
                <div className="flex gap-1">
                  {[preset.values.color_bg ?? '#fff', preset.values.color_accent ?? '#c9a84c', preset.values.color_text ?? '#111', preset.values.color_surface ?? '#f9f9f9'].map((c, i) => (
                    <div key={i} style={{ width: 12, height: 12, background: c, border: '1px solid #e0e0e0', borderRadius: 2 }} />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '9px', color: '#bbb', fontFamily: 'system-ui' }}>{preset.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Typography ──────────────────────────────────────────────────────── */}
      {themeTab === 'type' && (
        <div>
          <ThemeRow label="Heading Font">
            <ThemeSelect value={theme.font_heading} onChange={v => set('font_heading', v)} options={[
              { value: 'serif', label: 'Serif — Playfair / Georgia' },
              { value: 'sans',  label: 'Sans-serif — System UI' },
              { value: 'mono',  label: 'Monospace' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Body Font">
            <ThemeSelect value={theme.font_body} onChange={v => set('font_body', v)} options={[
              { value: 'serif', label: 'Serif — Playfair / Georgia' },
              { value: 'sans',  label: 'Sans-serif — System UI' },
              { value: 'mono',  label: 'Monospace' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Size Scale">
            <ThemeSelect value={theme.font_size_scale ?? 'default'} onChange={v => set('font_size_scale', v as Theme['font_size_scale'])} options={[
              { value: 'compact', label: 'Compact — tighter, smaller' },
              { value: 'default', label: 'Default' },
              { value: 'large',   label: 'Large — generous, bold' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Heading Weight">
            <ThemeSelect value={theme.heading_weight ?? '400'} onChange={v => set('heading_weight', v as Theme['heading_weight'])} options={[
              { value: '300', label: 'Light (300)' },
              { value: '400', label: 'Regular (400)' },
              { value: '500', label: 'Medium (500)' },
              { value: '700', label: 'Bold (700)' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Heading Case">
            <ThemeSelect value={theme.heading_transform ?? 'none'} onChange={v => set('heading_transform', v as Theme['heading_transform'])} options={[
              { value: 'none',       label: 'As typed' },
              { value: 'uppercase',  label: 'ALL CAPS' },
              { value: 'capitalize', label: 'Title Case' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Letter Spacing">
            <ThemeSelect value={theme.letter_spacing ?? 'normal'} onChange={v => set('letter_spacing', v as Theme['letter_spacing'])} options={[
              { value: 'tight',  label: 'Tight' },
              { value: 'normal', label: 'Normal' },
              { value: 'wide',   label: 'Wide' },
            ]} />
          </ThemeRow>
        </div>
      )}

      {/* ── Colors ──────────────────────────────────────────────────────────── */}
      {themeTab === 'color' && (
        <div>
          <ThemeSection title="Base">
            <ColorRow label="Accent"     value={theme.color_accent}  onChange={v => set('color_accent',  v)} />
            <ColorRow label="Background" value={theme.color_bg}      onChange={v => set('color_bg',      v)} />
            <ColorRow label="Text"       value={theme.color_text}    onChange={v => set('color_text',    v)} />
            <ColorRow label="Surface"    value={theme.color_surface} onChange={v => set('color_surface', v)} />
            <ColorRow label="Border"     value={theme.color_border ?? '#f0f0f0'} onChange={v => set('color_border', v)} />
          </ThemeSection>
          <ThemeSection title="Navigation">
            <ColorRow label="Nav Background" value={theme.color_nav_bg   ?? ''} onChange={v => set('color_nav_bg',   v)} optional />
            <ColorRow label="Nav Text"        value={theme.color_nav_text ?? ''} onChange={v => set('color_nav_text', v)} optional />
          </ThemeSection>
          <ThemeSection title="Buttons">
            <ColorRow label="Button Fill"  value={theme.color_button_bg   ?? ''} onChange={v => set('color_button_bg',   v)} optional />
            <ColorRow label="Button Label" value={theme.color_button_text ?? '#ffffff'} onChange={v => set('color_button_text', v)} />
          </ThemeSection>
        </div>
      )}

      {/* ── Layout ──────────────────────────────────────────────────────────── */}
      {themeTab === 'layout' && (
        <div>
          <ThemeRow label="Navigation Style">
            <ThemeSelect value={theme.nav_style ?? 'minimal'} onChange={v => set('nav_style', v as Theme['nav_style'])} options={[
              { value: 'minimal',  label: 'Minimal — logo left, links right' },
              { value: 'centered', label: 'Centered — logo centred' },
              { value: 'bold',     label: 'Bold — full-color bar' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Page Width">
            <ThemeSelect value={theme.page_width ?? 'contained'} onChange={v => set('page_width', v as Theme['page_width'])} options={[
              { value: 'contained', label: 'Contained — 1280px' },
              { value: 'wide',      label: 'Wide — 1440px' },
              { value: 'full',      label: 'Full bleed' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Section Spacing">
            <ThemeSelect value={theme.section_padding ?? 'standard'} onChange={v => set('section_padding', v as Theme['section_padding'])} options={[
              { value: 'compact',   label: 'Compact' },
              { value: 'standard',  label: 'Standard' },
              { value: 'spacious',  label: 'Spacious' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Product Grid">
            <ThemeSelect value={String(theme.grid_columns ?? 3)} onChange={v => set('grid_columns', Number(v) as Theme['grid_columns'])} options={[
              { value: '2', label: '2 columns — editorial, large' },
              { value: '3', label: '3 columns — balanced (default)' },
              { value: '4', label: '4 columns — dense' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Product Card Style">
            <ThemeSelect value={theme.product_card_style ?? 'editorial'} onChange={v => set('product_card_style', v as Theme['product_card_style'])} options={[
              { value: 'minimal',   label: 'Minimal — clean, no hover fx' },
              { value: 'editorial', label: 'Editorial — subtle zoom on hover' },
              { value: 'bold',      label: 'Bold — dark overlay on hover' },
            ]} />
          </ThemeRow>
        </div>
      )}

      {/* ── Buttons ─────────────────────────────────────────────────────────── */}
      {themeTab === 'buttons' && (
        <div>
          <ThemeRow label="Button Style">
            <ThemeSelect value={theme.button_style ?? 'solid'} onChange={v => set('button_style', v as Theme['button_style'])} options={[
              { value: 'solid',   label: 'Solid — filled background' },
              { value: 'outline', label: 'Outline — border only' },
              { value: 'ghost',   label: 'Ghost — text only' },
            ]} />
          </ThemeRow>
          <ThemeRow label="Button Corners">
            <ThemeSelect value={theme.button_radius ?? 'none'} onChange={v => set('button_radius', v as Theme['button_radius'])} options={[
              { value: 'none',  label: 'Square — sharp corners' },
              { value: 'small', label: 'Rounded — subtle radius' },
              { value: 'full',  label: 'Pill — fully rounded' },
            ]} />
          </ThemeRow>

          {/* Live button preview */}
          <div className="mt-6 p-4 bg-zinc-50 border border-zinc-100">
            <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '14px' }}>Preview</p>
            <div className="flex gap-3 flex-wrap">
              {(['primary','secondary'] as const).map(variant => {
                const btnBg   = theme.color_button_bg   || theme.color_accent;
                const btnText = theme.color_button_text || '#ffffff';
                const radius  = theme.button_radius === 'small' ? '4px' : theme.button_radius === 'full' ? '9999px' : '0';
                const label   = variant === 'primary' ? 'Shop Now' : 'Enquire →';
                const isOutline = theme.button_style === 'outline';
                const isGhost   = theme.button_style === 'ghost';
                return (
                  <div key={variant}
                       style={{
                         padding    : '10px 24px',
                         fontSize   : '8px',
                         textTransform: 'uppercase',
                         letterSpacing: '0.4em',
                         fontFamily : 'system-ui',
                         borderRadius: radius,
                         border     : isGhost  ? 'none' : isOutline ? `1px solid ${btnBg}` : 'none',
                         background : isGhost || isOutline ? 'transparent' : btnBg,
                         color      : isGhost || isOutline ? btnBg : btnText,
                         cursor     : 'default',
                       }}>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

type Panel = 'sections' | 'theme' | 'domain' | 'settings';

export default function EditorClient({
  initialStorefront,
  catalog,
  initialPublished,
}: {
  initialStorefront: Storefront;
  catalog          : CatalogItem[];
  initialPublished : { catalog_item_id: string }[];
}) {
  const [storefront, setStorefront] = useState<Storefront>(initialStorefront);
  const [theme, setTheme] = useState<Theme>({
    ...DEFAULT_THEME,
    ...initialStorefront.theme,
    sections: initialStorefront.theme?.sections ?? [],
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('sections');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const dragItem = useRef<number | null>(null);

  const publishedIds = new Set(initialPublished.map(p => p.catalog_item_id));
  const publishedItems = catalog.filter(item => publishedIds.has(String(item.id)));

  const activeSectionData = theme.sections.find(s => s.id === activeSection) ?? null;

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async (themeToSave: Theme, sfOverride?: Partial<Storefront>) => {
    setSaving(true);
    const sf = { ...storefront, ...sfOverride };
    await fetch('/api/store', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        slug         : sf.slug,
        name         : sf.name,
        tagline      : sf.tagline,
        description  : sf.description,
        accent_color : themeToSave.color_accent,
        contact_email: sf.contact_email,
        instagram    : sf.instagram,
        website      : sf.website,
        published    : sf.published,
        custom_domain: sf.custom_domain,
        theme        : themeToSave,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [storefront]);

  // ── Section ops ───────────────────────────────────────────────────────────

  function updateSection(updated: Section) {
    const next = { ...theme, sections: theme.sections.map(s => s.id === updated.id ? updated : s) };
    setTheme(next);
  }

  function removeSection(id: string) {
    setTheme(t => ({ ...t, sections: t.sections.filter(s => s.id !== id) }));
    if (activeSection === id) setActiveSection(null);
  }

  function addSection(type: Section['type']) {
    const s = newSection(type);
    setTheme(t => ({ ...t, sections: [...t.sections, s] }));
    setActiveSection(s.id);
    setPanel('sections');
    setShowAddMenu(false);
  }

  function moveSection(from: number, to: number) {
    const sections = [...theme.sections];
    const [item] = sections.splice(from, 1);
    sections.splice(to, 0, item);
    setTheme(t => ({ ...t, sections }));
  }

  const previewWidth = device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '375px';

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-zinc-100">

      {/* ── Left sidebar: panel nav + content ──────────────────────────────── */}
      <div className="w-72 shrink-0 bg-white border-r border-zinc-200 flex flex-col overflow-hidden">

        {/* Panel tabs */}
        <div className="flex border-b border-zinc-100">
          {([['sections','Sections'],['theme','Theme'],['domain','Domain'],['settings','Settings']] as const).map(([p, label]) => (
            <button key={p} onClick={() => setPanel(p)}
                    className="flex-1 py-3 text-[6.5px] uppercase tracking-[0.35em] transition-colors"
                    style={{
                      fontFamily  : 'system-ui',
                      color       : panel === p ? '#111' : '#bbb',
                      borderBottom: panel === p ? '2px solid #111' : '2px solid transparent',
                      background  : 'white',
                    }}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Sections panel ─────────────────────────────────────────────── */}
          {panel === 'sections' && !activeSectionData && (
            <div>
              <ul className="divide-y divide-zinc-50">
                {theme.sections.map((s, i) => (
                  <li key={s.id}
                      draggable
                      onDragStart={() => { dragItem.current = i; }}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={() => {
                        if (dragItem.current !== null && dragItem.current !== i) {
                          moveSection(dragItem.current, i);
                          dragItem.current = null;
                        }
                      }}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors ${!s.enabled ? 'opacity-40' : ''}`}
                      style={{ borderLeft: activeSection === s.id ? '2px solid #c9a84c' : '2px solid transparent' }}
                      onClick={() => setActiveSection(s.id)}>
                    <span style={{ fontSize: '12px', cursor: 'grab' }}>⠿</span>
                    <span style={{ fontSize: '11px', color: '#888', marginRight: '2px' }}>{SECTION_ICONS[s.type]}</span>
                    <span style={{ flex: 1, fontSize: '11px', color: '#333', fontFamily: 'system-ui' }}>{SECTION_LABELS[s.type]}</span>
                    <button onClick={e => { e.stopPropagation(); removeSection(s.id); }}
                            className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-[10px] hover:text-red-400 transition-all"
                            style={{ color: '#ccc' }}>✕</button>
                  </li>
                ))}
              </ul>

              {/* Add section */}
              <div className="px-4 py-4 border-t border-zinc-100">
                {showAddMenu ? (
                  <div className="space-y-1">
                    {ADD_SECTION_OPTIONS.map(opt => (
                      <button key={opt.type} onClick={() => addSection(opt.type)}
                              className="w-full text-left px-3 py-2 text-[10px] hover:bg-zinc-50 transition-colors"
                              style={{ color: '#555', fontFamily: 'system-ui' }}>
                        {SECTION_ICONS[opt.type]} &nbsp; {opt.label}
                      </button>
                    ))}
                    <button onClick={() => setShowAddMenu(false)}
                            className="w-full text-center py-1 text-[9px]" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddMenu(true)}
                          className="w-full py-2.5 text-[8px] uppercase tracking-[0.4em] border border-dashed border-zinc-300 hover:border-zinc-500 transition-colors"
                          style={{ color: '#aaa', fontFamily: 'system-ui' }}>
                    + Add Section
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section settings */}
          {panel === 'sections' && activeSectionData && (
            <div>
              <button onClick={() => setActiveSection(null)}
                      className="flex items-center gap-2 px-4 py-3 text-[8px] uppercase tracking-[0.35em] border-b border-zinc-100 w-full hover:bg-zinc-50 transition-colors"
                      style={{ color: '#888', fontFamily: 'system-ui' }}>
                ← {SECTION_LABELS[activeSectionData.type]}
              </button>
              <div className="px-4 py-5">
                <SectionSettings section={activeSectionData} onChange={updateSection} />
              </div>
            </div>
          )}

          {/* Theme panel */}
          {panel === 'theme' && (
            <div className="px-4 py-5">
              <ThemePanel theme={theme} onChange={setTheme} />
            </div>
          )}

          {/* Domain panel */}
          {panel === 'domain' && (
            <div className="px-4 py-5">
              <DomainPanel
                storefront={storefront}
                slug={storefront.slug}
                onSave={updates => setStorefront(s => ({ ...s, ...updates }))}
              />
            </div>
          )}

          {/* Settings panel */}
          {panel === 'settings' && (
            <div className="px-4 py-5 space-y-5">
              <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui' }}>Store Info</p>
              {[
                { key: 'name',          label: 'Store Name',    type: 'text'  },
                { key: 'tagline',       label: 'Tagline',       type: 'text'  },
                { key: 'contact_email', label: 'Contact Email', type: 'email' },
                { key: 'instagram',     label: 'Instagram',     type: 'text'  },
              ].map(f => (
                <div key={f.key}>
                  <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '5px' }}>{f.label}</p>
                  <input type={f.type}
                         value={String((storefront as unknown as Record<string, unknown>)[f.key] ?? '')}
                         onChange={e => setStorefront(s => ({ ...s, [f.key]: e.target.value }))}
                         className="w-full border-b border-zinc-200 pb-1.5 text-[12px] bg-transparent outline-none focus:border-black transition-colors"
                         style={{ color: '#333', fontFamily: 'system-ui' }} />
                </div>
              ))}

              {/* Publish toggle */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div>
                  <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#888', fontFamily: 'system-ui', marginBottom: '3px' }}>Store Status</p>
                  <p style={{ fontSize: '10px', color: storefront.published ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
                    {storefront.published ? 'Published' : 'Draft'}
                  </p>
                </div>
                <button onClick={() => setStorefront(s => ({ ...s, published: !s.published }))}
                        className="w-10 h-5 relative transition-colors"
                        style={{ background: storefront.published ? '#52b788' : '#e0e0e0', borderRadius: '10px' }}>
                  <span className="absolute top-0.5 w-4 h-4 bg-white transition-all"
                        style={{ left: storefront.published ? '22px' : '2px', borderRadius: '8px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="h-12 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-1">
            {([['desktop','⬜ Desktop'],['tablet','▭ Tablet'],['mobile','▯ Mobile']] as const).map(([d, label]) => (
              <button key={d} onClick={() => setDevice(d)}
                      className="px-3 py-1.5 text-[7.5px] uppercase tracking-[0.3em] transition-colors"
                      style={{ fontFamily: 'system-ui', background: device === d ? '#f4f4f4' : 'transparent', color: device === d ? '#333' : '#bbb' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {storefront.published && (
              <a href={`/store/${storefront.slug}`} target="_blank"
                 className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                 style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
                View Live ↗
              </a>
            )}
            <button
              onClick={() => save(theme)}
              disabled={saving}
              className="px-6 py-2 text-[8px] uppercase tracking-[0.45em] text-white disabled:opacity-40 transition-opacity"
              style={{ background: '#111', fontFamily: 'system-ui' }}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & Publish'}
            </button>
          </div>
        </div>

        {/* Preview frame */}
        <div className="flex-1 overflow-auto bg-zinc-200 flex justify-center py-6">
          <div style={{ width: previewWidth, maxWidth: '100%', background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', transition: 'width 0.3s ease', overflow: 'hidden' }}>
            <LivePreview storefront={storefront} theme={theme} items={publishedItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
