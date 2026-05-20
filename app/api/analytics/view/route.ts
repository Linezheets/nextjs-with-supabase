import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);

  try {
    const { product_id, brand_id, source } = await req.json();
    // Fire-and-forget view tracking — table may not exist yet in all envs
    if (product_id && user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('product_views').insert({
        user_id   : user.id,
        product_id: String(product_id),
        brand_id  : brand_id ?? null,
        source    : source ?? 'showroom',
      });
    }
  } catch { /* analytics should never break the caller */ }

  return NextResponse.json({ ok: true });
}
