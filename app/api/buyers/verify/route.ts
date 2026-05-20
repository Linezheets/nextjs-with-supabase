import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accept a store name / business doc submitted for verification
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* formData or empty body */ }

  const storeName = String(body.store_name ?? body.storeName ?? '').trim();

  const upsertData: Record<string, unknown> = { id: user.id, verification_status: 'pending' };
  if (storeName) upsertData.store_name = storeName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('buyers').upsert(upsertData, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'pending', message: 'Verification request submitted.' });
}
