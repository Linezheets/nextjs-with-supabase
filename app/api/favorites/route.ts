import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBlob, setBlob } from '@/lib/session-store';

type SavedItem = {
  item_type : 'product' | 'brand';
  item_id   : string;
  item_label: string | null;
  saved_at  : string;
};

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const saved = (await getBlob<SavedItem[]>(user.id, 'saved')) ?? [];
  // Return both keys so Express-side consumers (using "favorites") and
  // Next.js-side consumers (using "saved") both get the data they expect.
  return NextResponse.json({ saved, favorites: saved, total: saved.length });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const item_type  = (body.item_type ?? 'product') as 'product' | 'brand';
  const item_id    = String(body.item_id ?? body.productId ?? '');
  const item_label = body.item_label ?? null;

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const saved = (await getBlob<SavedItem[]>(user.id, 'saved')) ?? [];
  if (!saved.find(s => s.item_type === item_type && s.item_id === item_id)) {
    saved.push({ item_type, item_id, item_label, saved_at: new Date().toISOString() });
    await setBlob(user.id, 'saved', saved);
  }

  return NextResponse.json({ saved: true, item_id, favorites: saved });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const item_type = (searchParams.get('item_type') ?? 'product') as 'product' | 'brand';
  const item_id   = searchParams.get('item_id') ?? searchParams.get('productId') ?? '';

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const saved = ((await getBlob<SavedItem[]>(user.id, 'saved')) ?? [])
    .filter(s => !(s.item_type === item_type && s.item_id === item_id));
  await setBlob(user.id, 'saved', saved);

  return NextResponse.json({ saved: false, item_id, favorites: saved });
}
