import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { setAuditUser }  from '@/lib/supabase/set-audit-user';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user) await setAuditUser(supabase, user);

  const { adjustments } = await req.json() as {
    adjustments: { sku: string; stock_total: number }[];
  };

  if (!Array.isArray(adjustments) || !adjustments.length) {
    return NextResponse.json({ error: 'adjustments array required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const results: { sku: string; before?: number; after?: number; ok?: boolean; error?: string }[] = [];

  for (const adj of adjustments) {
    if (!adj.sku) { results.push({ sku: '', error: 'sku required' }); continue; }

    const { data: item } = await admin
      .from('inventory')
      .select('id, stock_total')
      .eq('sku', adj.sku)
      .eq('brand_name', sf.brand_name)
      .maybeSingle();

    if (!item) { results.push({ sku: adj.sku, error: 'SKU not found' }); continue; }

    const before = item.stock_total ?? 0;
    const after  = Math.max(0, Number(adj.stock_total));

    const { error } = await admin
      .from('inventory')
      .update({ stock_total: after, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) { results.push({ sku: adj.sku, error: error.message }); continue; }

    results.push({ sku: adj.sku, before, after, ok: true });
  }

  return NextResponse.json({
    results,
    updated: results.filter(r => r.ok).length,
    failed : results.filter(r => r.error).length,
  });
}
