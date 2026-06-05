'use client';

import { useState, useCallback, useRef } from 'react';
import type { Section, Theme } from '@/app/dashboard/store/editor/EditorClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type BrandStorefront = {
  id              : string;
  slug            : string;
  display_name    : string;
  brand_name      : string;
  tagline         : string | null;
  description     : string | null;
  contact_email   : string | null;
  instagram       : string | null;
  website         : string | null;
  published       : boolean;
  custom_domain   : string | null;
  domain_verified : boolean;
  // Tax / compliance
  vat_number      : string | null;
  tax_country     : string | null;
  company_reg_number: string | null;
  // Pricing
  base_currency   : string | null;
};

type InventoryItem = {
  id        : number;
  title     : string | null;
  brand_name: string;
  srp       : number | null;
  image_urls: string[] | null;
  category  : string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hero             : 'Hero Banner',
  announcement     : 'Announcement Bar',
  featured_products: 'Product Grid',
  about            : 'About / Story',
  contact          : 'Contact',
};

const SECTION_ICONS: Record<string, string> = {
  hero             : '▬',
  announcement     : '📢',
  featured_products: '⊞',
  about            : '◧',
  contact          : '✉',
};

const ADD_OPTIONS: { type: Section['type']; label: string }[] = [
  { type: 'announcement',      label: 'Announcement Bar' },
  { type: 'hero',              label: 'Hero Banner' },
  { type: 'featured_products', label: 'Product Grid' },
  { type: 'about',             label: 'About / Story' },
  { type: 'contact',           label: 'Contact' },
];

function newSection(type: Section['type']): Section {
  const id = `${type}-${Date.now()}`;
  switch (type) {
    case 'announcement':      return { id, type, enabled: true, text: 'New collection now available', bg_color: '#111', text_color: '#fff' };
    case 'hero':              return { id, type, enabled: true, headline: 'New Collection', subheadline: 'Explore our latest pieces.', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#0a0a0a', text_color: '#ffffff' };
    case 'featured_products': return { id, type, enabled: true, title: 'Featured', count: 8, layout: 'grid' };
    case 'about':             return { id, type, enabled: true, heading: 'Our Story', body: '' };
    case 'brands_bar':        return { id, type, enabled: false };
    case 'contact':           return { id, type, enabled: true, heading: 'Get in Touch' };
  }
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ storefront, theme, items }: { storefront: BrandStorefront; theme: Theme; items: InventoryItem[] }) {
  const accent = theme.color_accent;

  function renderSection(s: Section) {
    if (!s.enabled) return null;
    switch (s.type) {
      case 'announcement':
        return (
          <div key={s.id} style={{ background: s.bg_color, color: s.text_color, padding: '8px 32px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', fontFamily: 'system-ui' }}>
            {s.text}
          </div>
        );

      case 'hero':
        return (
          <div key={s.id} style={{ background: s.bg_color, color: s.text_color, padding: '64px 32px', minHeight: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {storefront.tagline && (
              <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5em', color: accent, fontFamily: 'system-ui', marginBottom: '12px' }}>
                {storefront.tagline}
              </p>
            )}
            <h1 style={{ fontFamily: theme.font_heading === 'serif' ? 'var(--font-serif), Georgia, serif' : 'system-ui', fontSize: 'clamp(2rem,6vw,4rem)', fontWeight: 400, lineHeight: 1, color: s.text_color }}>
              {s.headline}
            </h1>
            <p style={{ fontFamily: 'system-ui', fontSize: '12px', color: s.text_color === '#ffffff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', marginTop: '12px', maxWidth: '420px', lineHeight: 1.7 }}>
              {s.subheadline}
            </p>
            {s.cta_label && (
              <div style={{ marginTop: '32px', padding: '12px 32px', background: accent, color: '#fff', fontFamily: 'system-ui', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5em', display: 'inline-block' }}>
                {s.cta_label}
              </div>
            )}
          </div>
        );

      case 'featured_products': {
        const shown = items.slice(0, s.count);
        return (
          <div key={s.id} style={{ padding: '48px 32px', background: theme.color_bg }}>
            {s.title && (
              <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '28px' }}>
                {s.title}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: s.layout === 'row' ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '16px' }}>
              {shown.map(item => {
                const img = item.image_urls?.[0] ?? '';
                const price = item.srp ?? 0;
                return (
                  <div key={item.id}>
                    <div style={{ aspectRatio: '2/3', background: '#f4f4f4', overflow: 'hidden', marginBottom: '8px' }}>
                      {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <p style={{ fontFamily: theme.font_heading === 'serif' ? 'var(--font-serif), Georgia, serif' : 'system-ui', fontSize: '12px', color: theme.color_text, marginBottom: '2px' }}>
                      {item.title ?? ''}
                    </p>
                    {price > 0 && (
                      <p style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: accent, marginTop: '4px' }}>
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
          <div key={s.id} style={{ padding: '48px 32px', display: 'flex', gap: '40px', alignItems: 'center', background: theme.color_surface }}>
            {s.image_url && (
              <img src={s.image_url} alt="" style={{ width: '200px', height: '260px', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '16px' }}>{s.heading}</p>
              <p style={{ fontFamily: 'system-ui', fontSize: '13px', color: theme.color_text, lineHeight: 1.8, maxWidth: '480px' }}>{s.body}</p>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div key={s.id} style={{ padding: '48px 32px', textAlign: 'center', background: theme.color_surface }}>
            <p style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.55em', color: accent, fontFamily: 'system-ui', marginBottom: '16px' }}>{s.heading}</p>
            <p style={{ fontFamily: 'system-ui', fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>
              {storefront.contact_email ?? 'Add your contact email in settings'}
            </p>
            <div style={{ display: 'inline-block', padding: '12px 32px', border: `1px solid ${accent}`, color: accent, fontFamily: 'system-ui', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5em' }}>
              Send Message
            </div>
          </div>
        );

      default: return null;
    }
  }

  return (
    <div style={{ background: theme.color_bg, minHeight: '100%' }}>
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '0 32px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.color_bg }}>
        <span style={{ fontFamily: theme.font_heading === 'serif' ? 'var(--font-serif), Georgia, serif' : 'system-ui', fontSize: '12px', letterSpacing: '0.4em', color: theme.color_text }}>
          {storefront.display_name.toUpperCase()}
        </span>
        <span style={{ fontSize: '8px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.3em', fontFamily: 'system-ui' }}>Shop · About · Contact</span>
      </div>

      {theme.sections.map(renderSection)}

      <div style={{ borderTop: '1px solid #f0f0f0', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: theme.font_heading === 'serif' ? 'var(--font-serif), Georgia, serif' : 'system-ui', fontSize: '11px', letterSpacing: '0.4em', color: theme.color_text }}>
          {storefront.display_name.toUpperCase()}
        </span>
        <span style={{ fontSize: '8px', color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'system-ui' }}>
          Powered by <span style={{ color: accent }}>Linezheets</span>
        </span>
      </div>
    </div>
  );
}

// ── Section settings ──────────────────────────────────────────────────────────

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', marginBottom: '6px', fontFamily: 'system-ui' }}>{label}</p>
      <div style={{ borderBottom: '1px solid #e8e8e8' }}>{children}</div>
    </div>
  );
}

function SectionSettings({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  function set<K extends keyof Section>(key: K, value: Section[K]) {
    onChange({ ...section, [key]: value } as Section);
  }

  const inputCls = "w-full py-1.5 text-[12px] bg-transparent outline-none placeholder:text-zinc-300";
  const inputStyle = { color: '#333', fontFamily: 'system-ui' };

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
          <EditorField label="Headline"><input className={inputCls} style={inputStyle} value={section.headline} onChange={e => set('headline' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Subheadline"><input className={inputCls} style={inputStyle} value={section.subheadline} onChange={e => set('subheadline' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Button Label"><input className={inputCls} style={inputStyle} value={section.cta_label} onChange={e => set('cta_label' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Background"><input type="color" value={section.bg_color} onChange={e => set('bg_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
          <EditorField label="Text Color"><input type="color" value={section.text_color} onChange={e => set('text_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
        </>
      )}

      {section.type === 'announcement' && (
        <>
          <EditorField label="Text"><input className={inputCls} style={inputStyle} value={section.text} onChange={e => set('text' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Background"><input type="color" value={section.bg_color} onChange={e => set('bg_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
          <EditorField label="Text Color"><input type="color" value={section.text_color} onChange={e => set('text_color' as never, e.target.value as never)} className="w-full h-9 border-0 cursor-pointer" /></EditorField>
        </>
      )}

      {section.type === 'featured_products' && (
        <>
          <EditorField label="Section Title"><input className={inputCls} style={inputStyle} value={section.title} onChange={e => set('title' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Product Count">
            <input type="number" min={1} max={24} className={inputCls} style={inputStyle} value={section.count} onChange={e => set('count' as never, Number(e.target.value) as never)} />
          </EditorField>
          <EditorField label="Layout">
            <select value={section.layout} onChange={e => set('layout' as never, e.target.value as never)}
                    className="w-full py-1.5 text-[12px] bg-transparent outline-none" style={{ color: '#333', fontFamily: 'system-ui' }}>
              <option value="grid">Grid (3 columns)</option>
              <option value="row">Row (2 columns)</option>
            </select>
          </EditorField>
        </>
      )}

      {section.type === 'about' && (
        <>
          <EditorField label="Heading"><input className={inputCls} style={inputStyle} value={section.heading} onChange={e => set('heading' as never, e.target.value as never)} /></EditorField>
          <EditorField label="Body">
            <textarea className={`${inputCls} resize-none`} style={inputStyle} rows={4} value={section.body} onChange={e => set('body' as never, e.target.value as never)} />
          </EditorField>
          <EditorField label="Image URL"><input className={inputCls} style={inputStyle} value={section.image_url ?? ''} onChange={e => set('image_url' as never, e.target.value as never)} placeholder="https://…" /></EditorField>
        </>
      )}

      {section.type === 'contact' && (
        <EditorField label="Heading"><input className={inputCls} style={inputStyle} value={section.heading} onChange={e => set('heading' as never, e.target.value as never)} /></EditorField>
      )}
    </div>
  );
}

// ── Theme panel ───────────────────────────────────────────────────────────────

function ThemePanel({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  function set<K extends keyof Theme>(key: K, value: Theme[K]) {
    onChange({ ...theme, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div>
        <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '12px' }}>Typography</p>
        {(['font_heading', 'font_body'] as const).map(key => (
          <div key={key} className="mb-3">
            <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '5px' }}>
              {key === 'font_heading' ? 'Heading Font' : 'Body Font'}
            </p>
            <select value={theme[key]} onChange={e => set(key, e.target.value)}
                    className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none"
                    style={{ color: '#333', fontFamily: 'system-ui' }}>
              <option value="serif">Serif (Playfair / Georgia)</option>
              <option value="sans">Sans-serif (System UI)</option>
              <option value="mono">Monospace</option>
            </select>
          </div>
        ))}
      </div>
      <div className="pt-2">
        <p style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#bbb', fontFamily: 'system-ui', marginBottom: '12px' }}>Colours</p>
        {([['color_accent','Accent'],['color_bg','Background'],['color_text','Text'],['color_surface','Surface']] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between mb-3">
            <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#aaa', fontFamily: 'system-ui' }}>{label}</p>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '9px', color: '#bbb', fontFamily: 'var(--font-mono), monospace' }}>{theme[key]}</span>
              <input type="color" value={theme[key]} onChange={e => set(key, e.target.value)} className="w-8 h-8 border-0 bg-transparent cursor-pointer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Domain panel ──────────────────────────────────────────────────────────────

function DomainPanel({ storefront, onChange }: { storefront: BrandStorefront; onChange: (d: string | null) => void }) {
  const [domain, setDomain] = useState(storefront.custom_domain ?? '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  async function save() {
    setSaving(true); setError('');
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const res = await fetch('/api/brand-store', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        slug        : storefront.slug,
        display_name: storefront.display_name,
        brand_name  : storefront.brand_name,
        custom_domain: d || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Save failed'); return; }
    setSaved(true);
    onChange(d || null);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-zinc-100 bg-zinc-50">
        <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#c9a84c', fontFamily: 'system-ui', marginBottom: '6px' }}>Platform URL</p>
        <p style={{ fontFamily: 'system-ui', fontSize: '12px', color: '#333' }}>
          linezheets.com/brand/<strong>{storefront.slug}</strong>
        </p>
      </div>

      <div>
        <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '8px' }}>Custom Domain</p>
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="shop.yourbrand.com"
               className="w-full border-b border-zinc-200 pb-2 text-[12px] outline-none focus:border-black transition-colors placeholder:text-zinc-300"
               style={{ color: '#333', fontFamily: 'system-ui' }} />
        {error && <p style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'system-ui', marginTop: '6px' }}>{error}</p>}
        <button onClick={save} disabled={saving}
                className="mt-4 px-6 py-2 text-[8px] uppercase tracking-[0.4em] text-white disabled:opacity-40"
                style={{ background: '#111', fontFamily: 'system-ui' }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Domain'}
        </button>
      </div>

      {(domain || storefront.custom_domain) && (
        <div className="p-4 border border-zinc-200 space-y-3">
          <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui' }}>DNS Configuration</p>
          <div className="font-mono text-[10px] p-3 bg-zinc-50 border border-zinc-100 space-y-1">
            <p style={{ color: '#888' }}>Type &nbsp;→ <span style={{ color: '#333' }}>CNAME</span></p>
            <p style={{ color: '#888' }}>Name &nbsp;→ <span style={{ color: '#333' }}>{(domain || (storefront.custom_domain ?? '')).split('.')[0]}</span></p>
            <p style={{ color: '#888' }}>Value → <span style={{ color: '#c9a84c' }}>stores.linezheets.com</span></p>
            <p style={{ color: '#888' }}>TTL &nbsp;→ <span style={{ color: '#333' }}>3600</span></p>
          </div>
          <div className="flex items-center gap-2">
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

// ── Main ──────────────────────────────────────────────────────────────────────

type Panel = 'sections' | 'theme' | 'domain' | 'settings';

export default function BrandEditorClient({
  initialStorefront,
  inventory,
  initialPublished,
  initialTheme,
}: {
  initialStorefront: BrandStorefront;
  inventory        : InventoryItem[];
  initialPublished : { inventory_id: number }[];
  initialTheme     : Theme;
}) {
  const [storefront,     setStorefront]     = useState<BrandStorefront>(initialStorefront);
  const [theme,          setTheme]          = useState<Theme>(initialTheme);
  const [activeSection,  setActiveSection]  = useState<string | null>(null);
  const [panel,          setPanel]          = useState<Panel>('sections');
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [device,         setDevice]         = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showAddMenu,    setShowAddMenu]     = useState(false);
  const dragItem = useRef<number | null>(null);

  const publishedIds = new Set(initialPublished.map(p => p.inventory_id));
  const publishedItems = inventory.filter(item => publishedIds.has(item.id));
  const activeSectionData = theme.sections.find(s => s.id === activeSection) ?? null;

  const save = useCallback(async (themeToSave: Theme) => {
    setSaving(true);
    await fetch('/api/brand-store', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        slug        : storefront.slug,
        display_name: storefront.display_name,
        brand_name  : storefront.brand_name,
        tagline     : storefront.tagline,
        description : storefront.description,
        contact_email     : storefront.contact_email,
        instagram         : storefront.instagram,
        website           : storefront.website,
        published         : storefront.published,
        custom_domain     : storefront.custom_domain,
        vat_number        : storefront.vat_number,
        tax_country       : storefront.tax_country,
        company_reg_number: storefront.company_reg_number,
        base_currency     : storefront.base_currency,
        theme             : themeToSave,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [storefront]);

  function updateSection(updated: Section) {
    setTheme(t => ({ ...t, sections: t.sections.map(s => s.id === updated.id ? updated : s) }));
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

  const panelTabs: { key: Panel; label: string }[] = [
    { key: 'sections', label: 'Sections' },
    { key: 'theme',    label: 'Theme' },
    { key: 'domain',   label: 'Domain' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-zinc-100">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 bg-white border-r border-zinc-200 flex flex-col overflow-hidden">

        {/* Panel tabs */}
        <div className="flex border-b border-zinc-100">
          {panelTabs.map(t => (
            <button key={t.key} onClick={() => { setPanel(t.key); setActiveSection(null); }}
                    className="flex-1 py-3 text-[7px] uppercase tracking-[0.3em] transition-colors"
                    style={{ fontFamily: 'system-ui', color: panel === t.key ? '#111' : '#bbb', borderBottom: panel === t.key ? '1px solid #111' : '1px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* Sections panel */}
          {panel === 'sections' && !activeSectionData && (
            <div>
              <div className="space-y-1 mb-6">
                {theme.sections.map((s, i) => (
                  <div key={s.id}
                       draggable
                       onDragStart={() => { dragItem.current = i; }}
                       onDragOver={e => { e.preventDefault(); }}
                       onDrop={() => { if (dragItem.current !== null && dragItem.current !== i) { moveSection(dragItem.current, i); dragItem.current = null; } }}
                       className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors group"
                       style={{ background: activeSection === s.id ? '#fafafa' : undefined }}
                       onClick={() => setActiveSection(s.id)}>
                    <span style={{ fontSize: '10px', color: '#ccc', cursor: 'grab' }}>⠿</span>
                    <span style={{ fontSize: '12px', color: '#ccc' }}>{SECTION_ICONS[s.type] ?? '◻'}</span>
                    <span className="flex-1 text-[11px]" style={{ color: s.enabled ? '#333' : '#bbb', fontFamily: 'system-ui' }}>
                      {SECTION_LABELS[s.type] ?? s.type}
                    </span>
                    {!s.enabled && <span style={{ fontSize: '8px', color: '#ddd', fontFamily: 'system-ui' }}>Hidden</span>}
                    <button onClick={e => { e.stopPropagation(); removeSection(s.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px]"
                            style={{ color: '#ccc' }}>✕</button>
                  </div>
                ))}
              </div>

              <div className="relative">
                <button onClick={() => setShowAddMenu(m => !m)}
                        className="w-full py-2.5 text-[7.5px] uppercase tracking-[0.4em] border border-dashed border-zinc-200 hover:border-zinc-400 transition-colors"
                        style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                  + Add Section
                </button>
                {showAddMenu && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-zinc-200 shadow-lg z-10 py-1">
                    {ADD_OPTIONS.map(o => (
                      <button key={o.type} onClick={() => addSection(o.type)}
                              className="w-full text-left px-4 py-2.5 text-[11px] hover:bg-zinc-50 transition-colors"
                              style={{ color: '#333', fontFamily: 'system-ui' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {panel === 'sections' && activeSectionData && (
            <div>
              <button onClick={() => setActiveSection(null)}
                      className="flex items-center gap-2 mb-5 text-[7.5px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                      style={{ color: '#bbb', fontFamily: 'system-ui' }}>
                ← Back
              </button>
              <p className="text-[8px] uppercase tracking-[0.4em] mb-5" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
                {SECTION_LABELS[activeSectionData.type] ?? activeSectionData.type}
              </p>
              <SectionSettings section={activeSectionData} onChange={updateSection} />
            </div>
          )}

          {panel === 'theme' && <ThemePanel theme={theme} onChange={setTheme} />}

          {panel === 'domain' && (
            <DomainPanel
              storefront={storefront}
              onChange={d => setStorefront(s => ({ ...s, custom_domain: d }))}
            />
          )}

          {panel === 'settings' && (
            <div className="space-y-5">
              {(['display_name','tagline','description','contact_email','instagram','website'] as const).map(key => (
                <div key={key}>
                  <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '6px' }}>
                    {key.replace(/_/g, ' ')}
                  </p>
                  {key === 'description' ? (
                    <textarea rows={3} value={storefront[key] ?? ''}
                              onChange={e => setStorefront(s => ({ ...s, [key]: e.target.value }))}
                              className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none resize-none"
                              style={{ color: '#333', fontFamily: 'system-ui' }} />
                  ) : (
                    <input value={storefront[key] ?? ''}
                           onChange={e => setStorefront(s => ({ ...s, [key]: e.target.value }))}
                           className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none"
                           style={{ color: '#333', fontFamily: 'system-ui' }} />
                  )}
                </div>
              ))}

              {/* ── Tax & Compliance ─────────────────────────────── */}
              <div className="pt-4 border-t border-zinc-100">
                <p className="text-[7.5px] uppercase tracking-[0.4em] mb-4" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
                  Tax &amp; Compliance
                </p>
                <p className="text-[9px] mb-4" style={{ color: '#999', fontFamily: 'system-ui', lineHeight: 1.6 }}>
                  These details appear on proforma invoices and invoices for customs and accounting purposes.
                  You are responsible for your own VAT obligations in your territory.
                </p>
                {([
                  { key: 'vat_number',         label: 'VAT Number',           placeholder: 'e.g. FR12345678901, GB123456789' },
                  { key: 'tax_country',         label: 'Tax Country (ISO)',     placeholder: 'e.g. FR, GB, HK, US' },
                  { key: 'company_reg_number',  label: 'Company Reg. Number',  placeholder: 'e.g. SIRET, Companies House number' },
                  { key: 'base_currency',       label: 'Pricing Currency',      placeholder: 'USD, EUR or GBP' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key} className="mb-4">
                    <p style={{ fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#aaa', fontFamily: 'system-ui', marginBottom: '6px' }}>
                      {label}
                    </p>
                    <input
                      value={(storefront as Record<string, string | null | boolean>)[key] as string ?? ''}
                      onChange={e => setStorefront(s => ({ ...s, [key]: e.target.value || null }))}
                      placeholder={placeholder}
                      className="w-full border-b border-zinc-200 py-1.5 text-[12px] bg-transparent outline-none"
                      style={{ color: '#333', fontFamily: 'system-ui' }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.4em] mb-1" style={{ color: '#888', fontFamily: 'system-ui' }}>Published</p>
                  <p style={{ fontSize: '10px', color: storefront.published ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
                    {storefront.published ? 'Live' : 'Draft'}
                  </p>
                </div>
                <button onClick={() => setStorefront(s => ({ ...s, published: !s.published }))}
                        className="w-12 h-6 relative transition-colors"
                        style={{ background: storefront.published ? '#52b788' : '#e0e0e0', borderRadius: '12px' }}>
                  <span className="absolute top-1 w-4 h-4 bg-white transition-all"
                        style={{ left: storefront.published ? '26px' : '4px', borderRadius: '8px' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="border-t border-zinc-100 p-4">
          <button onClick={() => save(theme)} disabled={saving}
                  className="w-full py-3 text-[8.5px] uppercase tracking-[0.5em] text-white disabled:opacity-40 transition-opacity"
                  style={{ background: '#111', fontFamily: 'system-ui' }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Preview ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Device switcher */}
        <div className="h-10 bg-white border-b border-zinc-200 flex items-center justify-center gap-6">
          {(['desktop','tablet','mobile'] as const).map(d => (
            <button key={d} onClick={() => setDevice(d)}
                    className="text-[7.5px] uppercase tracking-[0.3em] transition-colors"
                    style={{ color: device === d ? '#111' : '#ccc', fontFamily: 'system-ui' }}>
              {d === 'desktop' ? '⬜ Desktop' : d === 'tablet' ? '▭ Tablet' : '▯ Mobile'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-8 flex justify-center">
          <div style={{ width: previewWidth, maxWidth: '100%', transition: 'width 0.3s ease', background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <LivePreview storefront={storefront} theme={theme} items={publishedItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
