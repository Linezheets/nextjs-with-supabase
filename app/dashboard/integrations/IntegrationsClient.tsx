'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ── Integration definitions ───────────────────────────────────────────────────

export type Integration = {
  id: string;
  name: string;
  category: string;
  description: string;
  oauth?: boolean;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
};

const INTEGRATIONS: Integration[] = [
  // Payments
  {
    id: 'stripe',
    name: 'Stripe Payments',
    category: 'Payments',
    description: 'Accept credit cards and manage payment flows for wholesale orders.',
    fields: [
      { key: 'access_token', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
      { key: 'config.publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
    ],
  },
  {
    id: 'paypal',
    name: 'PayPal Payments',
    category: 'Payments',
    description: 'Accept PayPal payments and manage transactions.',
    fields: [
      { key: 'external_id', label: 'Client ID', placeholder: 'AV...' },
      { key: 'access_token', label: 'Client Secret', type: 'password', placeholder: 'EH...' },
    ],
  },
  // E-Commerce
  {
    id: 'shopify',
    name: 'Shopify Sync',
    category: 'E-Commerce',
    description: 'Sync products, inventory and orders with your Shopify storefront.',
    oauth: true,
    fields: [
      { key: 'shop_domain', label: 'Shop Domain', placeholder: 'yourstore.myshopify.com' },
    ],
  },
  // ERP
  {
    id: 'netsuite',
    name: 'NetSuite ERP',
    category: 'ERP',
    description: 'Sync orders, inventory and financials with NetSuite.',
    fields: [
      { key: 'external_id', label: 'Account ID', placeholder: '1234567' },
      { key: 'config.consumer_key', label: 'Consumer Key', placeholder: '' },
      { key: 'access_token', label: 'Token ID', type: 'password', placeholder: '' },
      { key: 'config.token_secret', label: 'Token Secret', type: 'password', placeholder: '' },
    ],
  },
  {
    id: 'a2000',
    name: 'A2000 ERP',
    category: 'ERP',
    description: 'Connect to A2000 for fashion-specific ERP data flows.',
    fields: [
      { key: 'shop_domain', label: 'Server URL', placeholder: 'https://api.a2000.com' },
      { key: 'external_id', label: 'Company Code', placeholder: '' },
      { key: 'access_token', label: 'API Key', type: 'password', placeholder: '' },
    ],
  },
  {
    id: 'apparelmagic',
    name: 'ApparelMagic ERP',
    category: 'ERP',
    description: 'Industry-native ERP built for apparel and fashion brands.',
    fields: [
      { key: 'access_token', label: 'API Key', type: 'password', placeholder: '' },
      { key: 'external_id', label: 'Company ID', placeholder: '' },
    ],
  },
  {
    id: 'sap',
    name: 'SAP ERP',
    category: 'ERP',
    description: 'Enterprise resource planning via SAP S/4HANA or Business One.',
    fields: [
      { key: 'shop_domain', label: 'SAP Host URL', placeholder: 'https://sap.yourcompany.com' },
      { key: 'external_id', label: 'Client / Mandant', placeholder: '100' },
      { key: 'access_token', label: 'API Key / Password', type: 'password', placeholder: '' },
    ],
  },
  // Accounting
  {
    id: 'quickbooks',
    name: 'QuickBooks Accounting',
    category: 'Accounting',
    description: 'Push invoices, expenses and P&L data into QuickBooks Online.',
    fields: [
      { key: 'external_id', label: 'Realm (Company) ID', placeholder: '123456789' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '' },
      { key: 'config.refresh_token', label: 'Refresh Token', type: 'password', placeholder: '' },
    ],
  },
  // CRM
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    category: 'CRM',
    description: 'Sync buyer accounts, contacts and deal pipelines with Salesforce.',
    fields: [
      { key: 'shop_domain', label: 'Instance URL', placeholder: 'https://yourorg.salesforce.com' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '' },
      { key: 'config.refresh_token', label: 'Refresh Token', type: 'password', placeholder: '' },
    ],
  },
  // Shipping
  {
    id: 'shippo',
    name: 'Shippo Shipping',
    category: 'Shipping',
    description: "Generate labels and track shipments via Shippo's multi-carrier API.",
    fields: [
      { key: 'access_token', label: 'API Token', type: 'password', placeholder: 'shippo_live_...' },
    ],
  },
  // Automation
  {
    id: 'zapier',
    name: 'Zapier Automation',
    category: 'Automation',
    description: 'Trigger Zaps from platform events to connect 5,000+ apps.',
    fields: [
      { key: 'config.webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...' },
    ],
  },
  // Scheduling
  {
    id: 'calendly',
    name: 'Calendly Scheduling',
    category: 'Scheduling',
    description: 'Let buyers book showroom appointments via Calendly.',
    fields: [
      { key: 'access_token', label: 'Personal Access Token', type: 'password', placeholder: '' },
      { key: 'config.event_type_uri', label: 'Event Type URI (optional)', placeholder: 'https://api.calendly.com/event_types/...' },
    ],
  },
];

const CATEGORIES = ['Payments', 'E-Commerce', 'ERP', 'Accounting', 'CRM', 'Shipping', 'Automation', 'Scheduling'];

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectedMap = Record<string, {
  connected_at: string;
  last_sync_at: string | null;
  active: boolean;
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setNestedValue(obj: Record<string, unknown>, path: string, value: string) {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Shopify OAuth modal ───────────────────────────────────────────────────────

function ShopifyConnectModal({ onClose }: { onClose: () => void }) {
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/integrations/shopify/auth?shop=${encodeURIComponent(shopDomain.trim())}`);
      const data = await res.json() as { authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        setError(data.error ?? 'Failed to initiate Shopify connection');
        setLoading(false);
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md mx-4" style={{ borderTop: '2px solid #c9a84c' }}>
        <div className="px-8 pt-8 pb-6 border-b border-zinc-100">
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-2"
             style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
            E-Commerce
          </p>
          <h2 style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '1.5rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            Shopify Sync
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed"
             style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
            You will be redirected to Shopify to authorise access. No passwords are stored — only a scoped OAuth token.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          <div>
            <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                   style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
              Shop Domain
            </label>
            <input
              type="text"
              placeholder="yourstore.myshopify.com"
              value={shopDomain}
              onChange={e => setShopDomain(e.target.value)}
              required
              className="w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none
                         focus:border-zinc-400 transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif', color: '#333' }}
            />
          </div>

          {error && (
            <p className="text-[10px] uppercase tracking-[0.3em]"
               style={{ color: '#c0392b', fontFamily: 'system-ui, sans-serif' }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={loading || !shopDomain.trim()}
              className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] text-white transition-opacity
                         disabled:opacity-40"
              style={{ background: '#111', fontFamily: 'system-ui, sans-serif' }}
            >
              {loading ? 'Redirecting…' : 'Connect with Shopify →'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
              style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Connect modal (manual credentials) ───────────────────────────────────────

function ConnectModal({
  integration,
  onClose,
  onSave,
}: {
  integration: Integration;
  onClose: () => void;
  onSave: (id: string) => void;
}) {
  const [form, setForm]     = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = { platform: integration.id, config: {} };
    for (const [key, value] of Object.entries(form)) {
      if (key.startsWith('config.')) {
        setNestedValue(payload.config as Record<string, unknown>, key.slice(7), value);
      } else {
        payload[key] = value;
      }
    }

    try {
      const res = await fetch('/api/integrations', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Connection failed');
      } else {
        onSave(integration.id);
        onClose();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md mx-4" style={{ borderTop: '2px solid #c9a84c' }}>
        <div className="px-8 pt-8 pb-6 border-b border-zinc-100">
          <p className="text-[7.5px] uppercase tracking-[0.5em] mb-2"
             style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
            {integration.category}
          </p>
          <h2 style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '1.5rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            {integration.name}
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed"
             style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
            {integration.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {integration.fields.map(field => (
            <div key={field.key}>
              <label className="block text-[7.5px] uppercase tracking-[0.4em] mb-2"
                     style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
                {field.label}
              </label>
              <input
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                value={form[field.key] ?? ''}
                onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                className="w-full border border-zinc-200 px-4 py-3 text-[12px] outline-none
                           focus:border-zinc-400 transition-colors"
                style={{ fontFamily: 'system-ui, sans-serif', color: '#333' }}
              />
            </div>
          ))}

          {error && (
            <p className="text-[10px] uppercase tracking-[0.3em]"
               style={{ color: '#c0392b', fontFamily: 'system-ui, sans-serif' }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 text-[8px] uppercase tracking-[0.5em] text-white transition-opacity
                         disabled:opacity-40"
              style={{ background: '#111', fontFamily: 'system-ui, sans-serif' }}
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
              style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shopify sync actions (shown when connected) ───────────────────────────────

function ShopifySyncActions({ lastSyncAt }: { lastSyncAt: string | null }) {
  const [status, setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function runSync(action: 'push-products' | 'sync-inventory') {
    setStatus('loading');
    setMessage('');
    try {
      const res  = await fetch('/api/integrations/shopify/sync', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action }),
      });
      const data = await res.json() as {
        pushed?: number;
        synced?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      if (action === 'push-products') {
        setMessage(`${data.pushed ?? 0} product${data.pushed === 1 ? '' : 's'} pushed`);
      } else {
        setMessage(`${data.synced ?? 0} SKU${data.synced === 1 ? '' : 's'} updated`);
      }
      setStatus('success');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync failed');
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 4000);
  }

  const lastSync = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="border-t border-zinc-50 pt-4 mt-1 space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => runSync('push-products')}
          disabled={status === 'loading'}
          className="text-[7px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity disabled:opacity-30"
          style={{ color: '#111', fontFamily: 'system-ui, sans-serif' }}
        >
          Push Products
        </button>
        <span style={{ color: '#e0e0e0' }}>·</span>
        <button
          onClick={() => runSync('sync-inventory')}
          disabled={status === 'loading'}
          className="text-[7px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity disabled:opacity-30"
          style={{ color: '#111', fontFamily: 'system-ui, sans-serif' }}
        >
          Sync Inventory
        </button>
      </div>

      {status === 'loading' && (
        <p className="text-[7px] uppercase tracking-[0.3em]"
           style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
          Syncing…
        </p>
      )}
      {status === 'success' && (
        <p className="text-[7px] uppercase tracking-[0.3em]"
           style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p className="text-[7px] uppercase tracking-[0.3em]"
           style={{ color: '#c0392b', fontFamily: 'system-ui, sans-serif' }}>
          {message}
        </p>
      )}

      {lastSync && status === 'idle' && (
        <p className="text-[7px] uppercase tracking-[0.3em]"
           style={{ color: '#ddd', fontFamily: 'system-ui, sans-serif' }}>
          Last sync {lastSync}
        </p>
      )}
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  connected,
  connectedAt,
  lastSyncAt,
  onConnect,
  onDisconnect,
}: {
  integration: Integration;
  connected: boolean;
  connectedAt?: string;
  lastSyncAt?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await onDisconnect();
    setDisconnecting(false);
  }

  const dateStr = connectedAt
    ? new Date(connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={`border p-7 flex flex-col gap-5 transition-colors ${
      connected ? 'border-zinc-200' : 'border-zinc-100 hover:border-zinc-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[7px] uppercase tracking-[0.45em] mb-2"
             style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            {integration.category}
          </p>
          <p style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '1rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            {integration.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full"
               style={{ background: connected ? '#c9a84c' : '#e0e0e0' }} />
          <span className="text-[7px] uppercase tracking-[0.3em]"
                style={{ color: connected ? '#c9a84c' : '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            {connected ? 'Active' : 'Off'}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed flex-1"
         style={{ color: '#999', fontFamily: 'system-ui, sans-serif' }}>
        {integration.description}
      </p>

      {/* Shopify sync actions */}
      {connected && integration.id === 'shopify' && (
        <ShopifySyncActions lastSyncAt={lastSyncAt ?? null} />
      )}

      <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
        {connected ? (
          <>
            <p className="text-[7.5px] uppercase tracking-[0.3em]"
               style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
              Since {dateStr}
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity disabled:opacity-30"
              style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}
            >
              {disconnecting ? 'Removing…' : 'Disconnect'}
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
            style={{ color: '#111', fontFamily: 'system-ui, sans-serif' }}
          >
            {integration.oauth ? 'Connect with Shopify →' : 'Connect →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────

function Banner({ type, message, onDismiss }: { type: 'success' | 'error'; message: string; onDismiss: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 mb-10"
      style={{
        background  : type === 'success' ? '#faf8f2' : '#fff5f5',
        borderLeft  : `2px solid ${type === 'success' ? '#c9a84c' : '#c0392b'}`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.35em]"
         style={{ color: type === 'success' ? '#c9a84c' : '#c0392b', fontFamily: 'system-ui, sans-serif' }}>
        {message}
      </p>
      <button
        onClick={onDismiss}
        className="text-[9px] uppercase tracking-[0.3em] hover:opacity-50 transition-opacity ml-6"
        style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}
      >
        Dismiss
      </button>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function IntegrationsClient() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [connected, setConnected]       = useState<ConnectedMap>({});
  const [loading, setLoading]           = useState(true);
  const [activeModal, setActiveModal]   = useState<Integration | null>(null);
  const [shopifyModal, setShopifyModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchIntegrations = useCallback(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(({ integrations }: { integrations?: { platform: string; connected_at: string; last_sync_at: string | null; active: boolean }[] }) => {
        const map: ConnectedMap = {};
        for (const i of integrations ?? []) {
          map[i.platform] = { connected_at: i.connected_at, last_sync_at: i.last_sync_at, active: i.active };
        }
        setConnected(map);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Handle OAuth redirect params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');

    if (connected === 'shopify') {
      setBanner({ type: 'success', message: 'Shopify connected successfully' });
      fetchIntegrations();
      router.replace('/dashboard/integrations');
    } else if (error === 'shopify_denied') {
      setBanner({ type: 'error', message: 'Shopify authorisation was cancelled' });
      router.replace('/dashboard/integrations');
    } else if (error === 'shopify_failed' || error === 'shopify_invalid') {
      setBanner({ type: 'error', message: 'Shopify connection failed — please try again' });
      router.replace('/dashboard/integrations');
    }
  }, [searchParams, router, fetchIntegrations]);

  async function handleDisconnect(id: string) {
    await fetch(`/api/integrations?platform=${id}`, { method: 'DELETE' });
    setConnected(p => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  function handleSave(id: string) {
    setConnected(p => ({
      ...p,
      [id]: { connected_at: new Date().toISOString(), last_sync_at: null, active: true },
    }));
  }

  function handleConnect(integration: Integration) {
    if (integration.oauth) {
      setShopifyModal(true);
    } else {
      setActiveModal(integration);
    }
  }

  const connectedCount = Object.keys(connected).length;

  const displayed = activeCategory === 'All'
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  const byCategory: Record<string, Integration[]> = {};
  for (const i of displayed) {
    (byCategory[i.category] ??= []).push(i);
  }

  return (
    <>
      {shopifyModal && (
        <ShopifyConnectModal onClose={() => setShopifyModal(false)} />
      )}

      {activeModal && (
        <ConnectModal
          integration={activeModal}
          onClose={() => setActiveModal(null)}
          onSave={handleSave}
        />
      )}

      {banner && (
        <Banner
          type={banner.type}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-6 flex-wrap mb-14">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="text-[7.5px] uppercase tracking-[0.4em] transition-colors"
            style={{
              fontFamily  : 'system-ui, sans-serif',
              color       : activeCategory === cat ? '#111' : '#bbb',
              borderBottom: activeCategory === cat ? '1px solid #111' : '1px solid transparent',
              paddingBottom: '2px',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-8 mb-14 pb-8 border-b border-zinc-100">
        <div>
          <p className="text-[7px] uppercase tracking-[0.45em] mb-1"
             style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            Connected
          </p>
          <p style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '2rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            {loading ? '—' : connectedCount}
          </p>
        </div>
        <div className="w-px h-10 bg-zinc-100" />
        <div>
          <p className="text-[7px] uppercase tracking-[0.45em] mb-1"
             style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            Available
          </p>
          <p style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '2rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            {INTEGRATIONS.length}
          </p>
        </div>
        <div className="w-px h-10 bg-zinc-100" />
        <div>
          <p className="text-[7px] uppercase tracking-[0.45em] mb-1"
             style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
            Categories
          </p>
          <p style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize  : '2rem',
            fontWeight: 400,
            color     : '#111',
          }}>
            {CATEGORIES.length}
          </p>
        </div>
      </div>

      {/* Integration groups */}
      {CATEGORIES.filter(c => byCategory[c]?.length).map(category => (
        <section key={category} className="mb-14">
          <p className="text-[7.5px] uppercase tracking-[0.55em] mb-7"
             style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
            {category}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byCategory[category].map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                connected={!!connected[integration.id]}
                connectedAt={connected[integration.id]?.connected_at}
                lastSyncAt={connected[integration.id]?.last_sync_at}
                onConnect={() => handleConnect(integration)}
                onDisconnect={() => handleDisconnect(integration.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
