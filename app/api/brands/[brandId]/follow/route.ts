import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBlob, setBlob } from '@/lib/session-store';

type SavedItem = { item_type: 'product' | 'brand'; item_id: string; item_label: string | null; saved_at: string };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ following: false });

  const { brandId } = await params;
  const saved = (await getBlob<SavedItem[]>(user.id, 'saved')) ?? [];
  return NextResponse.json({ following: saved.some(s => s.item_type === 'brand' && s.item_id === brandId) });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { brandId } = await params;
  const saved = (await getBlob<SavedItem[]>(user.id, 'saved')) ?? [];
  if (!saved.find(s => s.item_type === 'brand' && s.item_id === brandId)) {
    saved.push({ item_type: 'brand', item_id: brandId, item_label: null, saved_at: new Date().toISOString() });
    await setBlob(user.id, 'saved', saved);
  }
  return NextResponse.json({ following: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { brandId } = await params;
  const saved = ((await getBlob<SavedItem[]>(user.id, 'saved')) ?? [])
    .filter(s => !(s.item_type === 'brand' && s.item_id === brandId));
  await setBlob(user.id, 'saved', saved);
  return NextResponse.json({ following: false });
}
