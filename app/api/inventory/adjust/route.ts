import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { setAuditUser }  from '@/lib/supabase/set-audit-user';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user) await setAuditUser(supabase, user);

  const { product_id, adjustment, type = 'set' } = await req.json() as {
    product_id : number;
    adjustment : number;
    type?      : 'set' | 'add' | 'subtract';
  };

  if (!product_id || adjustment === undefined) {
    return NextResponse.json({ error: 'product_id and adjustment are required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { data: item } = await admin
    .from('inventory')
    .select('id, stock_total, brand_name')
    .eq('id', product_id)
    .eq('brand_name', sf.brand_name)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const before = item.stock_total ?? 0;
  const qty    = Number(adjustment);
  let after: number;

  if      (type === 'set')      after = Math.max(0, qty);
  else if (type === 'add')      after = before + Math.abs(qty);
  else if (type === 'subtract') after = Math.max(0, before - Math.abs(qty));
  else return NextResponse.json({ error: 'type must be set | add | subtract' }, { status: 400 });

  const { error } = await admin
    .from('inventory')
    .update({ stock_total: after, updated_at: new Date().toISOString() })
    .eq('id', product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ product_id, before, after, change: after - before });
}
