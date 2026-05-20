'use client';

import { useState } from 'react';
import ProductCard from '@/components/ProductCard';
import type { CatalogItem } from '@/lib/types';

async function exportSelectedLinesheet(productIds: string[]) {
  if (!productIds.length) return;
  const res = await fetch('/api/marketplace/export-pdf', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ product_ids: productIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert((err as { error?: string }).error ?? 'Export failed. Please try again.');
    return;
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'linezheets-selection.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

type Favorite = { id: string; item_type: string; item_id: string; item_label: string | null; created_at: string };
type Alert    = { id: string; item_type: string; item_id: string; item_label: string | null; alert_type: string; title: string; body: string | null; read: boolean; created_at: string };
type Prefs    = { email_alerts: boolean; in_app_alerts: boolean; alert_on: string[] };

const ALERT_TYPE_LABELS: Record<string, string> = {
  new_stock      : 'New Stock',
  price_change   : 'Price Change',
  promotion      : 'Promotion',
  new_collection : 'New Collection',
};

const ALERT_TYPE_COLOR: Record<string, string> = {
  new_stock      : '#52b788',
  price_change   : '#c9a84c',
  promotion      : '#c9a84c',
  new_collection : '#7cb9e8',
};

// ── Alert preferences panel ───────────────────────────────────────────────────

function AlertPrefsPanel({ prefs: initialPrefs }: { prefs: Prefs }) {
  const [prefs,   setPrefs]   = useState<Prefs>(initialPrefs);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function save(next: Prefs) {
    setSaving(true);
    await fetch('/api/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleAlertOn(type: string) {
    const next = { ...prefs, alert_on: prefs.alert_on.includes(type) ? prefs.alert_on.filter(t => t !== type) : [...prefs.alert_on, type] };
    setPrefs(next);
    save(next);
  }

  function toggleBool(key: 'email_alerts' | 'in_app_alerts') {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    save(next);
  }

  return (
    <div className="border border-zinc-100 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-1" style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>Notification Preferences</p>
          <h3 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.2rem', fontWeight: 400, color: '#111' }}>Alert Settings</h3>
        </div>
        {saving && <p className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>Saving…</p>}
        {saved  && <p className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#52b788', fontFamily: 'system-ui, sans-serif' }}>Saved</p>}
      </div>

      {/* Channels */}
      <div className="space-y-4 mb-8 pb-8 border-b border-zinc-100">
        <p className="text-[7px] uppercase tracking-[0.45em]" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>Channels</p>
        {(['email_alerts', 'in_app_alerts'] as const).map(key => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <span className="text-[11px]" style={{ color: '#555', fontFamily: 'system-ui, sans-serif' }}>
              {key === 'email_alerts' ? 'Email notifications' : 'In-app notifications'}
            </span>
            <button
              onClick={() => toggleBool(key)}
              className="w-10 h-5 relative transition-colors"
              style={{ background: prefs[key] ? '#c9a84c' : '#e0e0e0', borderRadius: '10px' }}
            >
              <span className="absolute top-0.5 w-4 h-4 bg-white transition-all"
                    style={{ left: prefs[key] ? '22px' : '2px', borderRadius: '8px' }} />
            </button>
          </label>
        ))}
      </div>

      {/* Alert types */}
      <div className="space-y-4">
        <p className="text-[7px] uppercase tracking-[0.45em]" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>Notify me about</p>
        {Object.entries(ALERT_TYPE_LABELS).map(([type, label]) => (
          <label key={type} className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: ALERT_TYPE_COLOR[type] }} />
              <span className="text-[11px]" style={{ color: '#555', fontFamily: 'system-ui, sans-serif' }}>{label}</span>
            </div>
            <button
              onClick={() => toggleAlertOn(type)}
              className="w-10 h-5 relative transition-colors"
              style={{ background: prefs.alert_on.includes(type) ? '#c9a84c' : '#e0e0e0', borderRadius: '10px' }}
            >
              <span className="absolute top-0.5 w-4 h-4 bg-white transition-all"
                    style={{ left: prefs.alert_on.includes(type) ? '22px' : '2px', borderRadius: '8px' }} />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Alerts feed ───────────────────────────────────────────────────────────────

function AlertsFeed({ alerts: initial }: { alerts: Alert[] }) {
  const [alerts, setAlerts] = useState<Alert[]>(initial);

  async function markAllRead() {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setAlerts(a => a.map(x => ({ ...x, read: true })));
  }

  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="border border-zinc-100">
      <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100">
        <div>
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-1" style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>Notifications</p>
          <h3 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.2rem', fontWeight: 400, color: '#111' }}>
            Alerts
            {unread > 0 && (
              <span className="ml-2 text-[9px] px-2 py-0.5 align-middle"
                    style={{ background: '#c9a84c', color: '#fff', fontFamily: 'system-ui, sans-serif', borderRadius: '2px' }}>
                {unread}
              </span>
            )}
          </h3>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
            Mark all read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="px-8 py-12 text-center">
          <p className="text-[11px]" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            No alerts yet. Alerts will appear here when your favourited products or brands are updated.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-50">
          {alerts.map(alert => (
            <li key={alert.id} className="px-8 py-5 flex items-start gap-4"
                style={{ background: alert.read ? 'white' : '#fffdf5' }}>
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                   style={{ background: alert.read ? '#e0e0e0' : ALERT_TYPE_COLOR[alert.alert_type] ?? '#c9a84c' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[7px] uppercase tracking-[0.3em] mb-1" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
                  {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type} · {alert.item_label ?? alert.item_id}
                </p>
                <p className="text-[12px]" style={{ color: '#333', fontFamily: 'system-ui, sans-serif' }}>{alert.title}</p>
                {alert.body && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#999', fontFamily: 'system-ui, sans-serif' }}>{alert.body}</p>}
              </div>
              <p className="text-[7.5px] shrink-0" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
                {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Brand favorites ───────────────────────────────────────────────────────────

function BrandFavorites({ brands, onRemove }: { brands: Favorite[]; onRemove: (id: string) => void }) {
  return (
    <div>
      <p className="text-[7.5px] uppercase tracking-[0.55em] mb-7" style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>Brands</p>
      {brands.length === 0 ? (
        <p className="text-[11px]" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
          No brands saved. Browse the showroom and save brands you want to follow.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(fav => (
            <div key={fav.id} className="border border-zinc-100 p-6 flex items-center justify-between">
              <div>
                <p className="text-[7px] uppercase tracking-[0.4em] mb-1" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>Brand</p>
                <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1rem', fontWeight: 400, color: '#111' }}>
                  {fav.item_label ?? fav.item_id}
                </p>
              </div>
              <button
                onClick={() => onRemove(fav.item_id)}
                className="text-[7px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
                style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FavoritesClient({
  initialFavorites,
  initialAlerts,
  initialPrefs,
  catalogItems,
}: {
  initialFavorites: Favorite[];
  initialAlerts   : Alert[];
  initialPrefs    : Prefs;
  catalogItems    : unknown[];
}) {
  const [favorites, setFavorites] = useState<Favorite[]>(initialFavorites);
  const [tab, setTab] = useState<'products' | 'brands' | 'alerts' | 'settings'>('products');
  const [exporting, setExporting] = useState(false);

  const productFavs = favorites.filter(f => f.item_type === 'product');
  const brandFavs   = favorites.filter(f => f.item_type === 'brand');
  const favProductIds = new Set(productFavs.map(f => f.item_id));

  const favoritedItems = (catalogItems as CatalogItem[]).filter(item => favProductIds.has(String(item.id)));

  async function removeBrand(itemId: string) {
    await fetch(`/api/favorites?item_type=brand&item_id=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
    setFavorites(f => f.filter(x => !(x.item_type === 'brand' && x.item_id === itemId)));
  }

  async function handleExport() {
    setExporting(true);
    await exportSelectedLinesheet(favoritedItems.map(i => String(i.id)));
    setExporting(false);
  }

  function handleProductFavorite(item: CatalogItem, favorited: boolean) {
    if (!favorited) {
      setFavorites(f => f.filter(x => !(x.item_type === 'product' && x.item_id === String(item.id))));
    }
  }

  const tabs = [
    { key: 'products', label: `Products (${productFavs.length})` },
    { key: 'brands',   label: `Brands (${brandFavs.length})` },
    { key: 'alerts',   label: 'Alerts' },
    { key: 'settings', label: 'Settings' },
  ] as const;

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-8 mb-12 border-b border-zinc-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="pb-4 text-[8px] uppercase tracking-[0.4em] transition-colors"
            style={{
              fontFamily  : 'system-ui, sans-serif',
              color       : tab === t.key ? '#111' : '#bbb',
              borderBottom: tab === t.key ? '1px solid #111' : '1px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        favoritedItems.length > 0 && (
          <div className="flex items-center justify-end mb-8">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-3 px-8 py-3 text-[8px] uppercase tracking-[0.45em] border transition-colors disabled:opacity-40"
              style={{
                fontFamily  : 'system-ui, sans-serif',
                borderColor : exporting ? '#e8e8e8' : '#111',
                color       : exporting ? '#bbb'    : '#111',
                background  : 'white',
              }}
            >
              {exporting ? (
                <>
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M5 1v7M2 6l3 3 3-3M1 10h8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Export Linesheet
                </>
              )}
            </button>
          </div>
        )
      )}
      {tab === 'products' && (
        favoritedItems.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-12 h-px mx-auto mb-10" style={{ background: '#e8e8e8' }} />
            <p style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '2rem', fontWeight: 400, color: '#ccc' }}>
              No favourites yet
            </p>
            <p className="mt-4 text-[12px]" style={{ color: '#bbb', fontFamily: 'system-ui, sans-serif' }}>
              Browse the showroom and tap the heart icon on any product.
            </p>
            <a href="/" className="inline-block mt-8 px-10 py-3 text-[8px] uppercase tracking-[0.45em] border border-zinc-200 text-zinc-400 hover:border-zinc-800 hover:text-zinc-800 transition-colors" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Browse Showroom →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
            {favoritedItems.map(item => (
              <ProductCard
                key={String(item.id)}
                item={item}
                verified
                isFavorited
                onFavorite={handleProductFavorite}
              />
            ))}
          </div>
        )
      )}

      {/* Brands tab */}
      {tab === 'brands' && <BrandFavorites brands={brandFavs} onRemove={removeBrand} />}

      {/* Alerts tab */}
      {tab === 'alerts' && <AlertsFeed alerts={initialAlerts} />}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="max-w-md">
          <AlertPrefsPanel prefs={initialPrefs} />
        </div>
      )}
    </>
  );
}
