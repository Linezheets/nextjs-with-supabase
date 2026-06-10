'use client';

import { useEffect, useState } from 'react';

const SANS = 'system-ui, -apple-system, sans-serif';
const GOLD = '#c9a84c';

const SCOPES = [
  { id: 'products:read',  label: 'Read products' },
  { id: 'products:write', label: 'Write products' },
  { id: 'orders:read',    label: 'Read orders' },
  { id: 'buyers:read',    label: 'Read buyers' },
  { id: 'linesheets:read',label: 'Read linesheets' },
];

type KeyRow = {
  id: string; key_prefix: string; name: string | null; scopes: string[];
  environment: string; last_used_at: string | null; created_at: string; revoked_at: string | null;
};

const label = { fontFamily: SANS, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase' as const, color: '#888' };

export default function ApiKeysClient() {
  const [keys, setKeys]       = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName]       = useState('');
  const [env, setEnv]         = useState<'live' | 'test'>('live');
  const [scopes, setScopes]   = useState<Set<string>>(new Set(['products:read']));
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/brand-store/api-keys');
      const json = await res.json();
      if (res.ok) setKeys(json.keys ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setCreating(true); setNewKey(null);
    try {
      const res = await fetch('/api/brand-store/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || null, environment: env, scopes: [...scopes] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not create key');
      setNewKey(json.key);
      setName('');
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key? Any integration using it will stop working immediately.')) return;
    const res = await fetch(`/api/brand-store/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) load(); else alert('Could not revoke key');
  }

  const toggle = (id: string) =>
    setScopes(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '36px 64px 28px' }}>
        <p style={{ ...label, fontSize: 9, letterSpacing: '0.5em', color: '#bbb', marginBottom: 8 }}>Brand Store / API Keys</p>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 30, fontWeight: 400, margin: 0 }}>API Keys</h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: '#888', marginTop: 8 }}>
          Programmatic access to your catalog and orders at <code>api.linezheets.com/v1</code>.
        </p>
      </div>

      <div style={{ padding: '32px 64px', display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 920 }}>
        {/* Show-once key banner */}
        {newKey && (
          <div style={{ background: '#fffdf5', border: `1px solid ${GOLD}`, padding: 20 }}>
            <p style={{ ...label, color: GOLD, marginBottom: 10 }}>Copy your key now — it won&apos;t be shown again</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <code style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 13, background: '#fff', border: '1px solid #eee', padding: '10px 12px', flex: 1, overflowX: 'auto' }}>{newKey}</code>
              <button onClick={() => navigator.clipboard.writeText(newKey)} style={{ ...btn, background: GOLD, color: '#fff', border: 'none' }}>Copy</button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: 24 }}>
          <p style={{ ...label, marginBottom: 16 }}>Create a key</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>Name (optional)</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ERP integration"
                style={{ padding: '10px 12px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, outline: 'none', minWidth: 220 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>Environment</span>
              <select value={env} onChange={e => setEnv(e.target.value as 'live' | 'test')}
                style={{ padding: '10px 12px', border: '1px solid #e5e5e5', fontSize: 13, fontFamily: SANS, background: '#fff', outline: 'none' }}>
                <option value="live">live</option><option value="test">test</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 18 }}>
            <span style={label}>Scopes</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
              {SCOPES.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: SANS, fontSize: 13, color: '#444', cursor: 'pointer' }}>
                  <input type="checkbox" checked={scopes.has(s.id)} onChange={() => toggle(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={creating || scopes.size === 0}
            style={{ ...btn, marginTop: 22, background: '#111', color: '#fff', border: 'none', opacity: creating || scopes.size === 0 ? 0.5 : 1 }}>
            {creating ? 'Generating…' : 'Generate key'}
          </button>
        </div>

        {/* Existing keys */}
        <div>
          <p style={{ ...label, marginBottom: 14 }}>Your keys</p>
          {loading ? <p style={{ fontFamily: SANS, fontSize: 13, color: '#aaa' }}>Loading…</p>
            : keys.length === 0 ? <p style={{ fontFamily: SANS, fontSize: 13, color: '#aaa' }}>No keys yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#eee', border: '1px solid #eee' }}>
                {keys.map(k => (
                  <div key={k.id} style={{ background: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, opacity: k.revoked_at ? 0.45 : 1 }}>
                    <code style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 13, color: '#222' }}>{k.key_prefix}…</code>
                    <span style={{ fontFamily: SANS, fontSize: 13, color: '#555', flex: 1 }}>{k.name ?? '—'}</span>
                    <span style={{ ...label, fontSize: 9 }}>{k.environment}</span>
                    <span style={{ fontFamily: SANS, fontSize: 11, color: '#999' }}>{(k.scopes ?? []).join(', ')}</span>
                    {k.revoked_at
                      ? <span style={{ ...label, fontSize: 9, color: '#c00' }}>revoked</span>
                      : <button onClick={() => revoke(k.id)} style={{ ...btn, padding: '6px 12px', fontSize: 11, background: '#fff', color: '#c00', border: '1px solid #eee' }}>Revoke</button>}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

const btn = {
  fontFamily: SANS, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  padding: '11px 22px', cursor: 'pointer',
};
