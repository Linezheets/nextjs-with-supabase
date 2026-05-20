import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { getBlob, setBlob } from '@/lib/session-store';

type CartItem = { variant_id: string; quantity: number; [k: string]: unknown };

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
  const { user } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const cart = ((await getBlob<CartItem[]>(user.id, 'cart')) ?? [])
    .filter(i => i.variant_id !== variantId);
  await setBlob(user.id, 'cart', cart);
  return NextResponse.json({ cart });
}
