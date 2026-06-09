import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { releaseEscrow } from '@/lib/escrow';

/**
 * POST /api/payments/release/[orderId]
 *
 * Releases escrowed funds to the brand's Stripe Connect account.
 * Called automatically when an order is marked 'delivered', or manually
 * by a Platform Admin (MXLLA) to force-release.
 *
 * Requires: authenticated user who is either the brand owner of this order
 * or a platform admin.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Authorisation: platform admin OR the brand that owns this order
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  const isPlatformAdmin = adminEmails.includes(user.email ?? '');

  if (!isPlatformAdmin) {
    // Check if this user is the brand on the order
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('brand_name')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { brand_name: string } | null };

    if (!sf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the order belongs to this brand
    const { data: order } = await admin
      .from('buyer_orders')
      .select('id, brand_name, items')
      .eq('id', orderId)
      .maybeSingle() as { data: { id: string; brand_name: string | null; items: { brand_name?: string | null }[] } | null };

    const orderBrand = order?.brand_name
      ?? (Array.isArray(order?.items) ? (order!.items[0]?.brand_name ?? '') : '');
    if (orderBrand !== sf.brand_name) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const result = await releaseEscrow(orderId);
    return NextResponse.json({
      success     : true,
      order_id    : result.orderId,
      transferred : result.transferred / 100,   // back to decimal
      currency    : result.currency,
      transfer_id : result.transferId,
      fee         : result.fee / 100,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[release-escrow]', orderId, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
