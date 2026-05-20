'use client';

import { useState, useEffect } from 'react';

// ── Integration definitions ───────────────────────────────────────────────────

export type Integration = {
  id: string;
  name: string;
  category: string;
  description: string;
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
    fields: [
      { key: 'shop_domain', label: 'Shop Domain', placeholder: 'yourstore.myshopify.com' },
      { key: 'access_token', label: 'Admin API Access Token', type: 'password', placeholder: 'shpat_...' },
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

// ── Connect modal ─────────────────────────────────────────────────────────────

function ConnectModal({
  integration,
  onClose,
  onSave,
}: {
  integration: Integration;
  onClose: () => void;
  onSave: (id: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Build payload
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
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

        {/* Header */}
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

        {/* Form */}
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

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  connected,
  connectedAt,
  onConnect,
  onDisconnect,
}: {
  integration: Integration;
  connected: boolean;
  connectedAt?: string;
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

      {/* Status dot + name */}
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

      {/* Description */}
      <p className="text-[11px] leading-relaxed flex-1"
         style={{ color: '#999', fontFamily: 'system-ui, sans-serif' }}>
        {integration.description}
      </p>

      {/* Footer */}
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
            Connect →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function IntegrationsClient() {
  const [connected, setConnected] = useState<ConnectedMap>({});
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<Integration | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(({ integrations }) => {
        const map: ConnectedMap = {};
        for (const i of integrations ?? []) {
          map[i.platform] = { connected_at: i.connected_at, last_sync_at: i.last_sync_at, active: i.active };
        }
        setConnected(map);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const connectedCount = Object.keys(connected).length;

  const displayed = activeCategory === 'All'
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  // Group by category for the grid
  const byCategory: Record<string, Integration[]> = {};
  for (const i of displayed) {
    (byCategory[i.category] ??= []).push(i);
  }

  return (
    <>
      {activeModal && (
        <ConnectModal
          integration={activeModal}
          onClose={() => setActiveModal(null)}
          onSave={handleSave}
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
              fontFamily: 'system-ui, sans-serif',
              color: activeCategory === cat ? '#111' : '#bbb',
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
                onConnect={() => setActiveModal(integration)}
                onDisconnect={() => handleDisconnect(integration.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
