'use client';

import { useState, useRef, useCallback } from 'react';

type Product = {
  id           : string;   // inventory.id is a UUID
  title        : string;
  sku          : string | null;
  category     : string;
  season       : string | null;
  color        : string | null;
  wsp_usd      : number;
  srp          : number;
  stock_total  : number;
  moq          : number;
  status       : string;
  image_urls   : string[];
  description  : string | null;
  delivery_window: string | null;
  tags         : string[];
  sizes        : Record<string, number>;
  color_hex    : string | null;
  video_urls   : string[];
  [key: string]: unknown;
};

type Props = {
  initialProducts: Record<string, unknown>[];
  brandName      : string;
  tier           : string;
  currency       : string;
};

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, "Times New Roman", serif';
const MONO  = 'DM Mono, ui-monospace, monospace';
const SANS  = 'system-ui, -apple-system, sans-serif';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active  : { bg: '#f0faf4', color: '#2d7a4f' },
  draft   : { bg: '#f5f5f5', color: '#888'    },
  archived: { bg: '#fff0f0', color: '#c0392b' },
};

const CATEGORIES = ['TOPS','BOTTOMS','DRESSES','OUTERWEAR','KNITWEAR','ACCESSORIES','BAGS','SHOES','GENERAL'];

const EMPTY: Product = {
  id: '', title: '', sku: '', category: 'GENERAL', season: '', color: '',
  wsp_usd: 0, srp: 0, stock_total: 0, moq: 1, status: 'active',
  image_urls: [], description: '', delivery_window: '', tags: [], sizes: {},
  color_hex: '', video_urls: [],
};

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'];

// ─── Image Upload ─────────────────────────────────────────────────────────────

function ImageUploadArea({ images, onChange }: { images: string[]; onChange: (urls: string[]) => void }) {
  const fileInput  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of arr) {
        const fd = new FormData();
        fd.append('file', file);
        const res  = await fetch('/api/upload/product-image', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.url) newUrls.push(json.url);
      }
      onChange([...images, ...newUrls]);
    } catch { alert('Image upload failed.'); }
    finally { setUploading(false); }
  }, [images, onChange]);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>
        Product Images
      </span>
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {images.map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', border: '1px solid #e5e5e5' }} />
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#df1b41', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        onClick={() => fileInput.current?.click()}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{ border: `2px dashed ${dragOver ? GOLD : '#e0e0e0'}`, background: dragOver ? 'rgba(201,168,76,0.04)' : '#fafafa', padding: '22px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
        {uploading
          ? <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Uploading…</p>
          : <>
              <p style={{ fontFamily: SANS, fontSize: 13, color: '#555', marginBottom: 4 }}>Drop images here or <span style={{ color: GOLD, textDecoration: 'underline' }}>click to browse</span></p>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#bbb' }}>JPG, PNG, WEBP · up to 10MB each · multiple allowed</p>
            </>
        }
        <input ref={fileInput} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>
    </div>
  );
}

// ─── Video Upload ─────────────────────────────────────────────────────────────

function VideoUploadArea({ videos, onChange }: { videos: string[]; onChange: (urls: string[]) => void }) {
  const fileInput  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('video/'));
    if (!arr.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of arr) {
        const fd = new FormData();
        fd.append('file', file);
        const res  = await fetch('/api/upload/product-image', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.url) newUrls.push(json.url);
      }
      onChange([...videos, ...newUrls]);
    } catch { alert('Video upload failed.'); }
    finally { setUploading(false); }
  }, [videos, onChange]);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>
        Product Video <span style={{ color: '#bbb', letterSpacing: 0, textTransform: 'none' }}>(optional)</span>
      </span>
      {videos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {videos.map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 120, height: 80 }}>
              <video src={url} muted style={{ width: 120, height: 80, objectFit: 'cover', border: '1px solid #e5e5e5', background: '#000' }} />
              <button type="button" onClick={() => onChange(videos.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#df1b41', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        onClick={() => fileInput.current?.click()}
        onDrop={e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}
        onDragOver={e => e.preventDefault()}
        style={{ border: '2px dashed #e0e0e0', background: '#fafafa', padding: '18px 20px', textAlign: 'center', cursor: 'pointer' }}>
        {uploading
          ? <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Uploading…</p>
          : <p style={{ fontFamily: SANS, fontSize: 12, color: '#555' }}>Drop a video or <span style={{ color: GOLD, textDecoration: 'underline' }}>click to browse</span> · MP4/WEBM · up to 50MB</p>
        }
        <input ref={fileInput} type="file" multiple accept="video/*" style={{ display: 'none' }}
          onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>
    </div>
  );
}

// ─── Sizes & Stock grid ───────────────────────────────────────────────────────
// Edits the `sizes` JSONB ({ "S": 12, "M": 8 }) that the order/stock engine
// (allocate_order_stock_v2) decrements per size. stock_total is derived from the sum.

function sizeTotal(sizes: Record<string, number>): number {
  return Object.values(sizes || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
}

function SizeStockEditor({ sizes, onChange }: { sizes: Record<string, number>; onChange: (s: Record<string, number>) => void }) {
  const [custom, setCustom] = useState('');
  const entries = Object.entries(sizes || {});

  const setQty = (size: string, qty: number) => onChange({ ...sizes, [size]: Math.max(0, Math.floor(qty || 0)) });
  const addSize = (raw: string) => {
    const s = raw.trim().toUpperCase();
    if (!s || (sizes && sizes[s] !== undefined)) return;
    onChange({ ...(sizes || {}), [s]: 0 });
    setCustom('');
  };
  const removeSize = (size: string) => {
    const next = { ...(sizes || {}) };
    delete next[size];
    onChange(next);
  };

  const inputStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none' };

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>
          Sizes & Stock
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#888' }}>
          {entries.length} {entries.length === 1 ? 'size' : 'sizes'} · {sizeTotal(sizes)} total units
        </span>
      </div>

      {/* Quick-add common sizes */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: entries.length ? 14 : 10 }}>
        {COMMON_SIZES.map(s => {
          const active = sizes && sizes[s] !== undefined;
          return (
            <button key={s} type="button" onClick={() => (active ? removeSize(s) : addSize(s))}
              style={{
                fontFamily: SANS, fontSize: 10, letterSpacing: '0.15em', padding: '5px 11px', cursor: 'pointer',
                border: `1px solid ${active ? GOLD : '#e5e5e5'}`,
                background: active ? 'rgba(201,168,76,0.08)' : '#fff',
                color: active ? '#111' : '#888',
              }}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Per-size quantity rows */}
      {entries.length > 0 && (
        <div style={{ border: '1px solid #f0f0f0', marginBottom: 12 }}>
          {entries.map(([size, qty], i) => (
            <div key={size} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid #f5f5f5' : 'none' }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: '#111', letterSpacing: '0.05em' }}>{size}</span>
              <input
                type="number" min={0} value={qty}
                onChange={e => setQty(size, Number(e.target.value))}
                style={{ ...inputStyle, fontFamily: MONO, textAlign: 'right', padding: '5px 8px' }}
                placeholder="0"
              />
              <button type="button" onClick={() => removeSize(size)}
                style={{ width: 24, height: 24, border: '1px solid #f0e0e0', background: '#fff', color: '#df1b41', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Custom size add */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(custom); } }}
          placeholder="Custom size (e.g. 38, ONE SIZE)…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={() => addSize(custom)}
          style={{ background: '#fff', border: `1px solid ${GOLD}`, color: GOLD, padding: '0 18px', fontFamily: SANS, fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Add Size
        </button>
      </div>
    </div>
  );
}

// ─── AI Mass Upload Modal ─────────────────────────────────────────────────────

function AIMassUploadModal({ onClose, onDone }: { onClose: () => void; onDone: (p: Product[]) => void }) {
  const [step,    setStep]    = useState<'upload' | 'processing' | 'review'>('upload');
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<Product[]>([]);
  const [saving,  setSaving]  = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setFile(f); setStep('processing');
    const fd = new FormData(); fd.append('file', f);
    try {
      // The working AI parser is the smart-sync endpoint (the old
      // /api/products/ai-import route never existed).
      const res = await fetch('/api/upload/smart-sync', { method: 'POST', body: fd });
      const j   = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'AI import failed');
      setPreview(j.products ?? []); setStep('review');
    } catch (e) { alert((e as Error).message); setStep('upload'); }
  }

  async function confirmImport() {
    setSaving(true);
    try {
      // Commit via the real endpoint (the old /api/products/bulk never existed).
      // It returns { success, saved, errors } — not { products }.
      const res = await fetch('/api/upload/smart-sync/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: preview }) });
      const j   = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Import failed');
      if (Array.isArray(j.errors) && j.errors.length) {
        alert(`Imported ${j.saved ?? 0} of ${preview.length}. Some rows were skipped:\n` + (j.errors as string[]).slice(0, 8).join('\n'));
      }
      onDone(preview); onClose();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto', padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>✦ AI Mass Upload</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#111' }}>Import Products with AI</h2>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888', marginTop: 6 }}>Upload a CSV, Excel, or PDF linesheet — AI maps all product data automatically.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#bbb', cursor: 'pointer' }}>×</button>
        </div>

        {step === 'upload' && (
          <>
            <div onClick={() => fileInput.current?.click()}
              style={{ border: '2px dashed #e0e0e0', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: 20 }}>
              <p style={{ fontFamily: SANS, fontSize: 14, color: '#555', marginBottom: 6 }}>Drop file here or <span style={{ color: GOLD, textDecoration: 'underline' }}>browse</span></p>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#bbb' }}>CSV · Excel (.xlsx) · PDF · Images — AI reads them all</p>
              <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
            <div style={{ background: '#f9f6ee', border: '1px solid rgba(201,168,76,0.25)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontFamily: SANS, fontSize: 12, color: '#555', fontWeight: 500, marginBottom: 2 }}>Download CSV Template</p>
                <p style={{ fontFamily: SANS, fontSize: 11, color: '#888' }}>Pre-formatted with all required columns</p>
              </div>
              <a href="/api/products/template" download style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none', border: `1px solid ${GOLD}`, padding: '7px 14px' }}>Download</a>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontFamily: SERIF, fontSize: 18, color: '#111', marginBottom: 8 }}>AI is reading your file…</p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Extracting from <strong>{file?.name}</strong></p>
          </div>
        )}

        {step === 'review' && (
          <>
            <div style={{ background: '#f0faf4', border: '1px solid #b2dfca', padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: '#2d7a4f' }}>✓</span>
              <p style={{ fontFamily: SANS, fontSize: 13, color: '#2d7a4f' }}>AI found <strong>{preview.length} products</strong> — review before importing.</p>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#fafafa' }}>
                  <tr>{['Title','SKU','WSP','SRP','Category'].map(h => <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: SANS, fontSize: 7.5, letterSpacing: '0.35em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400, borderBottom: '1px solid #f0f0f0' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: SERIF, fontSize: 13 }}>{p.title || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 11, color: '#888' }}>{p.sku || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 12 }}>${p.wsp_usd}</td>
                      <td style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 12, color: '#666' }}>${p.srp}</td>
                      <td style={{ padding: '10px 14px', fontFamily: SANS, fontSize: 11, color: '#666' }}>{p.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={confirmImport} disabled={saving}
                style={{ flex: 1, background: saving ? '#ccc' : '#111', color: '#fff', border: 'none', padding: '13px 0', fontFamily: SANS, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Importing…' : `Import ${preview.length} Products`}
              </button>
              <button onClick={() => setStep('upload')} style={{ padding: '13px 24px', background: '#fff', border: '1px solid #e5e5e5', fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer', color: '#888' }}>Re-upload</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shopify Sync Modal ───────────────────────────────────────────────────────

function ShopifySyncModal({ onClose, onDone }: { onClose: () => void; onDone: (p: Product[]) => void }) {
  const [shopUrl, setShopUrl] = useState('');
  const [token,   setToken]   = useState('');
  const [step,    setStep]    = useState<'connect' | 'syncing' | 'done'>('connect');
  const [count,   setCount]   = useState(0);

  async function handleSync() {
    if (!shopUrl.trim() || !token.trim()) { alert('Fill in both fields.'); return; }
    setStep('syncing');
    try {
      const res = await fetch('/api/integrations/shopify/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_url: shopUrl.trim(), access_token: token.trim() }) });
      const j   = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Shopify sync failed');
      setCount(j.count ?? 0); setStep('done');
      if (j.products?.length) onDone(j.products);
    } catch (e) { alert((e as Error).message); setStep('connect'); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 520, padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#96bf48', marginBottom: 6 }}>⟳ Shopify Sync</p>
            <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#111' }}>Import from Shopify</h2>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888', marginTop: 6 }}>Pull your entire catalogue directly from your Shopify store.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#bbb', cursor: 'pointer' }}>×</button>
        </div>
        {step === 'connect' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Shopify Store URL</span>
                <input value={shopUrl} onChange={e => setShopUrl(e.target.value)} placeholder="yourstore.myshopify.com"
                  style={{ padding: '10px 14px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Admin API Access Token</span>
                <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="shpat_••••••••••••••••"
                  style={{ padding: '10px 14px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none' }} />
              </label>
            </div>
            <div style={{ background: '#f5f5f5', padding: '12px 16px', marginBottom: 20, borderLeft: `3px solid ${GOLD}` }}>
              <p style={{ fontFamily: SANS, fontSize: 11, color: '#666', lineHeight: 1.7 }}>
                In Shopify Admin → Apps → Develop apps → Create an app, enable <strong>read_products</strong> scope to generate your token.
              </p>
            </div>
            <button onClick={handleSync}
              style={{ width: '100%', background: '#96bf48', color: '#fff', border: 'none', padding: '13px 0', fontFamily: SANS, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Connect & Sync Products
            </button>
          </>
        )}
        {step === 'syncing' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontFamily: SERIF, fontSize: 18, color: '#111', marginBottom: 8 }}>Syncing from Shopify…</p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Fetching products, variants, and images</p>
          </div>
        )}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, color: '#2d7a4f', marginBottom: 12 }}>✓</div>
            <p style={{ fontFamily: SERIF, fontSize: 20, color: '#111', marginBottom: 8 }}>{count} products synced</p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: '#888', marginBottom: 24 }}>Your Shopify catalogue is now in Linezheets.</p>
            <button onClick={onClose} style={{ background: '#111', color: '#fff', border: 'none', padding: '11px 28px', fontFamily: SANS, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProductsClient({ initialProducts, brandName, tier, currency }: Props) {
  const [products, setProducts]       = useState<Product[]>(initialProducts as Product[]);
  const [modal, setModal]             = useState<'none' | 'create' | 'edit'>('none');
  const [uploadModal, setUploadModal] = useState<'none' | 'ai' | 'shopify'>('none');
  const [form, setForm]           = useState<Product>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 0 }).format(n);

  const visible = products.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function openCreate() {
    setForm(EMPTY);
    setErr('');
    setModal('create');
  }

  function openEdit(p: Product) {
    // `sizes` comes back from the DB as JSONB; guarantee it's a plain object for the grid
    const sizes = (p.sizes && typeof p.sizes === 'object' && !Array.isArray(p.sizes))
      ? p.sizes as Record<string, number>
      : {};
    const video_urls = Array.isArray(p.video_urls) ? p.video_urls as string[] : [];
    setForm({ ...p, sizes, video_urls });
    setErr('');
    setModal('edit');
  }

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      const isEdit = modal === 'edit' && form.id;
      const url    = isEdit ? `/api/products/${form.id}` : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          ...form,
          tags: typeof form.tags === 'string' ? (form.tags as string).split(',').map(t => t.trim()).filter(Boolean) : form.tags,
          // stock_total is derived from the per-size grid so it always matches the sizes map
          stock_total: sizeTotal(form.sizes || {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      if (isEdit) {
        setProducts(ps => ps.map(p => p.id === form.id ? json.product : p));
      } else {
        setProducts(ps => [json.product, ...ps]);
      }
      setModal('none');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this product?')) return;
    const res  = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    setProducts(ps => ps.filter(p => p.id !== id));
  }

  async function quickAdjust(id: string, delta: number) {
    const res  = await fetch('/api/inventory/adjust', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ product_id: id, adjustment: delta, type: delta > 0 ? 'add' : 'subtract' }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    setProducts(ps => ps.map(p => p.id === id ? { ...p, stock_total: json.after } : p));
  }

  const maxProducts = tier === 'starter' ? 50 : -1;

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '40px 64px 32px' }}>
        <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
          Brand Store / Products
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontSize: '28px', fontWeight: 400, color: '#111', marginBottom: 4 }}>
              Product Catalogue
            </h1>
            <p style={{ fontFamily: SANS, fontSize: '12px', color: '#888' }}>
              {brandName} · {products.filter(p => p.status === 'active').length} active
              {maxProducts > 0 && ` / ${maxProducts} on ${tier}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setUploadModal('shopify')}
              style={{ background: '#fff', color: '#555', border: '1px solid #e5e5e5', padding: '9px 16px', fontFamily: SANS, fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#96bf48' }}>⟳</span> Shopify Sync
            </button>
            <button onClick={() => setUploadModal('ai')}
              style={{ background: '#fff', color: '#555', border: `1px solid ${GOLD}`, padding: '9px 16px', fontFamily: SANS, fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: GOLD }}>✦</span> AI Mass Upload
            </button>
            <button onClick={openCreate}
              style={{ background: '#111', color: '#fff', border: 'none', padding: '9px 20px', fontFamily: SANS, fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase', cursor: 'pointer' }}>
              + New Product
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '24px 64px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or SKU…"
          style={{ flex: 1, maxWidth: 320, padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: SANS, background: '#fff', outline: 'none' }}
        />
        {['all','active','draft','archived'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ background: filterStatus === s ? '#111' : '#fff', color: filterStatus === s ? '#fff' : '#888',
              border: '1px solid #e5e5e5', padding: '6px 16px', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: SANS }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: '24px 64px' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb', fontFamily: SANS, fontSize: '12px' }}>
            No products found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['Product','SKU','Category','WSP','SRP','Stock','Status',''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: SANS, fontSize: '8px', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#bbb', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {p.image_urls[0] ? (
                          <img src={p.image_urls[0]} alt={p.title} style={{ width: 36, height: 36, objectFit: 'cover', background: '#f5f5f5' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, background: '#f5f5f5' }} />
                        )}
                        <span style={{ fontFamily: SERIF, fontSize: '13px', color: '#111' }}>{p.title}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '11px', color: '#888' }}>{p.sku ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontFamily: SANS, fontSize: '11px', color: '#666' }}>{p.category}</td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '12px', color: '#111' }}>{fmt(p.wsp_usd)}</td>
                    <td style={{ padding: '14px 16px', fontFamily: MONO, fontSize: '12px', color: '#666' }}>{fmt(p.srp)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => quickAdjust(p.id, -1)} style={{ width: 20, height: 20, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontFamily: MONO, fontSize: '12px', minWidth: 28, textAlign: 'center', color: p.stock_total === 0 ? '#df1b41' : p.stock_total < 5 ? GOLD : '#111' }}>{p.stock_total}</span>
                        <button onClick={() => quickAdjust(p.id, 1)} style={{ width: 20, height: 20, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ ...badge, padding: '3px 10px', fontSize: '8px', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: SANS }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#666', fontFamily: SANS }}>Edit</button>
                        <button onClick={() => handleArchive(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#bbb', fontFamily: SANS }}>Archive</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload modals */}
      {uploadModal === 'ai' && <AIMassUploadModal onClose={() => setUploadModal('none')} onDone={ps => setProducts(prev => [...ps, ...prev])} />}
      {uploadModal === 'shopify' && <ShopifySyncModal onClose={() => setUploadModal('none')} onDone={ps => setProducts(prev => [...ps, ...prev])} />}

      {/* Product create/edit modal */}
      {modal !== 'none' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 40 }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.5em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
              {modal === 'create' ? 'New Product' : 'Edit Product'}
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 400, color: '#111', marginBottom: 28 }}>
              {modal === 'create' ? 'Add to Catalogue' : form.title}
            </h2>

            {err && <p style={{ color: '#df1b41', fontFamily: SANS, fontSize: '12px', marginBottom: 16 }}>{err}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ImageUploadArea images={form.image_urls} onChange={urls => setForm(f => ({ ...f, image_urls: urls }))} />
              <VideoUploadArea videos={form.video_urls} onChange={urls => setForm(f => ({ ...f, video_urls: urls }))} />
              {([
                ['Title *', 'title', 'text', true],
                ['SKU', 'sku', 'text', false],
                ['Wholesale Price (WSP)', 'wsp_usd', 'number', false],
                ['Retail Price (SRP)', 'srp', 'number', false],
                ['MOQ', 'moq', 'number', false],
                ['Color', 'color', 'text', false],
                ['Season', 'season', 'text', false],
                ['Delivery Window', 'delivery_window', 'text', false],
              ] as [string, keyof Product, string, boolean][]).map(([label, key, type]) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>{label}</span>
                  <input
                    type={type}
                    value={String(form[key] ?? '')}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}
                  />
                </label>
              ))}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Category</span>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Status</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}>
                  {['active','draft','archived'].map(s => <option key={s}>{s}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Colour Swatch</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.color_hex || '#000000'} onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))}
                    style={{ width: 40, height: 34, border: '1px solid #e5e5e5', padding: 2, cursor: 'pointer', background: '#fff' }} />
                  <input type="text" value={form.color_hex ?? ''} onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))} placeholder="#000000"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: MONO, outline: 'none' }} />
                </div>
              </label>

              <SizeStockEditor sizes={form.sizes} onChange={sizes => setForm(f => ({ ...f, sizes }))} />
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Description</span>
              <textarea
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none', resize: 'vertical' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>Tags (comma-separated)</span>
              <input
                value={Array.isArray(form.tags) ? form.tags.join(', ') : String(form.tags ?? '')}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                style={{ padding: '8px 12px', border: '1px solid #e5e5e5', fontSize: '13px', fontFamily: SANS, outline: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, background: saving ? '#ccc' : '#111', color: '#fff', border: 'none', padding: '12px 0', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Add Product' : 'Save Changes'}
              </button>
              <button onClick={() => setModal('none')} disabled={saving}
                style={{ padding: '12px 24px', background: '#fff', border: '1px solid #e5e5e5', fontFamily: SANS, fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer', color: '#888' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
