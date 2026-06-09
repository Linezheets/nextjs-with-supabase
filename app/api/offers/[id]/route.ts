import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { patchOffer } from '@/lib/session-store';
import { parseMoney } from '@/lib/parse-money';

const ALLOWED_STATUS = ['pending', 'accepted', 'rejected', 'countered', 'withdrawn'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  // Whitelist patchable fields — never let a PATCH rewrite total/items/currency.
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}` }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.message === 'string') patch.message = body.message.slice(0, 2000);
  if (body.counter_total !== undefined) {
    const ct = parseMoney(body.counter_total);
    if (ct == null || ct < 0) return NextResponse.json({ error: 'Invalid counter_total' }, { status: 400 });
    patch.counter_total = ct;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  // Owner-scoped — user.id is the offer's session_id (see POST /api/offers).
  const result = await patchOffer(id, patch, user.id);
  if (!result) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  return NextResponse.json({ success: true, offer: { id, ...result } });
}
