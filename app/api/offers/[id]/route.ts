import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { patchOffer } from '@/lib/session-store';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body  = await req.json();
  const result = await patchOffer(id, body);

  if (!result) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  return NextResponse.json({ success: true, offer: { id, ...result } });
}
