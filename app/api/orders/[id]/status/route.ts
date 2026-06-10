import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { updateOrderStatus } from '@/lib/orders/update-status';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status, notes } = await req.json() as { status: string; notes?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Brand-only — resolve the caller's brand.
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const result = await updateOrderStatus(admin, { orderId: id, brandName: sf.brand_name, toStatus: status, notes });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  return NextResponse.json({ order: result.order, escrow_release: result.escrowRelease });
}
