/**
 * Temporary session store — cart, saved items, and offers live here
 * during the migration period. One row per (session_id, type) for
 * cart/saved; one row per offer (multiple rows per session).
 */
import { createClient } from '@/lib/supabase/server';

export type StoreType = 'cart' | 'saved' | 'offer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function client(): Promise<AnyClient> {
  return createClient();
}

/** Read the single JSON blob for cart or saved (upserted as one row). */
export async function getBlob<T>(sessionId: string, type: 'cart' | 'saved'): Promise<T | null> {
  const sb = await client();
  const { data } = await sb
    .from('session_store')
    .select('data')
    .eq('session_id', sessionId)
    .eq('type', type)
    .maybeSingle();
  return (data?.data as T) ?? null;
}

/** Write (upsert) the single JSON blob for cart or saved. */
export async function setBlob(sessionId: string, type: 'cart' | 'saved', data: unknown) {
  const sb = await client();
  await sb.from('session_store').delete().eq('session_id', sessionId).eq('type', type);
  await sb.from('session_store').insert({ session_id: sessionId, type, data });
}

/** Append a new offer row. Returns the new row id. */
export async function appendOffer(sessionId: string, data: unknown): Promise<string> {
  const sb = await client();
  const { data: row } = await sb
    .from('session_store')
    .insert({ session_id: sessionId, type: 'offer', data })
    .select('id')
    .single();
  return row?.id ?? '';
}

/** List all offer rows for a session (or all if sessionId is '*'). */
export async function listOffers(sessionId?: string) {
  const sb = await client();
  let q = sb.from('session_store').select('*').eq('type', 'offer').order('created_at', { ascending: false });
  if (sessionId && sessionId !== '*') q = q.eq('session_id', sessionId);
  const { data } = await q;
  return (data ?? []).map((r: { id: string; data: unknown; created_at: string }) => {
    const payload = (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) ? r.data as object : {};
    return { id: r.id, ...payload, created_at: r.created_at };
  });
}

/** Patch an offer row. */
export async function patchOffer(id: string, patch: Record<string, unknown>, ownerSessionId?: string) {
  const sb = await client();
  const { data: existing } = await sb.from('session_store').select('session_id, data').eq('id', id).single();
  if (!existing) return null;
  // Ownership: callers may only patch their own offer (prevents tampering with
  // another user's offer via a guessed id).
  if (ownerSessionId && existing.session_id !== ownerSessionId) return null;
  const base = (existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data))
    ? existing.data as object : {};
  const merged = { ...base, ...patch, updated_at: new Date().toISOString() };
  await sb.from('session_store').update({ data: merged, updated_at: new Date().toISOString() }).eq('id', id);
  return merged;
}
