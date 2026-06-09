import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { createAdminClient } from '@/lib/supabase/server';
import { logActivity }       from '@/lib/audit';
import { setAuditUser }  from '@/lib/supabase/set-audit-user';
import { priceOrderForBuyer } from '@/lib/order-pricing';

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('buyer_orders')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// ─── OrderItem shape sent from buyer-order.html ───────────────────────────────
// {
//   sku        : string          // inventory SKU
//   product_id : number | string // inventory.id
//   name       : string
//   brand_name : string
//   sizes      : Record<string, number>  // { S: 2, M: 1 } — only non-zero entries
//   wsp_usd    : number
//   image_url  : string | null
// }

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user) await setAuditUser(supabase, user);

  let body: {
    items      : Array<Record<string, unknown>>;
    terms?     : string;
    notes?     : string;
    total_usd? : number;
    brand_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { items, terms, notes, total_usd, brand_name } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 });
  }

  // ── 1. Normalise line items ───────────────────────────────────────────────
  // Accept both { sizes: { S: 2 } } and legacy { size: "S", quantity: 2 } shapes.
  const normalised = items.map(item => {
    let sizes: Record<string, number> = {};

    if (item.sizes && typeof item.sizes === 'object' && !Array.isArray(item.sizes)) {
      // New shape: sizes object
      for (const [sz, qty] of Object.entries(item.sizes as Record<string, unknown>)) {
        const q = Number(qty);
        if (q > 0) sizes[sz] = q;
      }
    } else if (item.size && item.quantity) {
      // Legacy cart shape: single size
      const q = Number(item.quantity);
      if (q > 0) sizes[String(item.size)] = q;
    }

    const total_qty = Object.values(sizes).reduce((a, b) => a + b, 0);

    return {
      sku       : String(item.sku ?? '').trim(),
      sizes,
      total_qty,
      // Keep full item data for the order record snapshot
      snapshot  : item,
    };
  }).filter(i => i.sku && i.total_qty > 0);

  if (normalised.length === 0) {
    return NextResponse.json({ error: 'No items with valid SKUs and quantities' }, { status: 400 });
  }

  // ── 2. Atomic stock allocation via Postgres RPC ───────────────────────────
  // allocate_order_stock_v2 handles two fulfillment paths in one transaction:
  //   IMMEDIATE        — stock available now; decrements inventory
  //   FUTURE_ALLOCATION — product has a delivery_window; accepted as pre-order,
  //                       no stock decrement (Market Week / forward-order flow)
  // Items with zero stock AND no delivery_window are still rejected (409).
  const admin = createAdminClient();

  const allocationPayload = normalised.map(({ sku, sizes, total_qty, snapshot }) => ({
    sku,
    sizes,
    total_qty,
    // Pass delivery_window from the item snapshot if the caller included it
    ...(snapshot.delivery_window ? { delivery_window: String(snapshot.delivery_window) } : {}),
  }));

  const { data: allocResult, error: allocError } = await admin.rpc(
    'allocate_order_stock_v2',
    { p_items: allocationPayload },
  );

  if (allocError) {
    return NextResponse.json(
      { error: 'Stock allocation failed', detail: allocError.message },
      { status: 500 },
    );
  }

  const result = allocResult as {
    success: boolean;
    errors?: unknown[];
    allocated?: Array<{ sku: string; fulfillment_type: 'IMMEDIATE' | 'FUTURE_ALLOCATION'; delivery_window?: string; sizes_used: Record<string, number>; stock_after: number | null }>;
    order_fulfillment_type?: 'IMMEDIATE' | 'FUTURE_ALLOCATION' | 'MIXED';
  };

  if (!result.success) {
    const firstErr = (result.errors ?? [])[0] as Record<string, unknown> | undefined;
    const message = firstErr
      ? firstErr.size
        ? `${firstErr.sku} — size ${firstErr.size}: only ${firstErr.available} available (requested ${firstErr.requested})`
        : String(firstErr.error ?? 'Stock unavailable')
      : 'Insufficient stock for one or more items';

    return NextResponse.json(
      { error: message, stock_errors: result.errors },
      { status: 409 },
    );
  }

  // Build a lookup so we can stamp each line item with its fulfillment type
  const fulfillmentBySku = new Map(
    (result.allocated ?? []).map(a => [a.sku, a.fulfillment_type]),
  );

  // ── 2b. Recompute the authoritative total server-side ─────────────────────
  // SECURITY: the client-supplied `total_usd` is NEVER trusted. Re-price every
  // line from the buyer's own catalog (pricing + visibility rules applied) and
  // reject any SKU the buyer cannot see or that has no price.
  const pricing = await priceOrderForBuyer(
    admin,
    user.email,
    normalised.map(i => ({ sku: i.sku, total_qty: i.total_qty })),
  );
  if (!pricing.ok) {
    return NextResponse.json(
      { error: pricing.error, missing_skus: pricing.missingSkus },
      { status: 422 },
    );
  }
  // One brand per order: escrow payout and authorization key off a single brand.
  // A mixed-brand cart must be split into separate orders.
  if (pricing.brands.length > 1) {
    return NextResponse.json(
      { error: 'An order may only contain items from one brand. Please place a separate order per brand.', brands: pricing.brands },
      { status: 400 },
    );
  }
  const orderBrand   = pricing.brands[0] ?? brand_name ?? null;
  const serverTotal  = pricing.totalUsd;
  const unitWspBySku = new Map(pricing.lines.map(l => [l.sku, l.unitWsp]));

  const taggedItems = normalised.map(i => {
    const unitWsp = unitWspBySku.get(i.sku) ?? 0;
    return {
      ...i.snapshot,
      sku             : i.sku,
      sizes           : i.sizes,
      wsp_usd         : unitWsp,                 // authoritative unit price (USD)
      line_total_usd  : Math.round(unitWsp * i.total_qty * 100) / 100,
      fulfillment_type: fulfillmentBySku.get(i.sku) ?? 'IMMEDIATE',
    };
  });

  const orderFulfillmentType = result.order_fulfillment_type ?? 'IMMEDIATE';

  // ── 3. Persist the order record ───────────────────────────────────────────
  const orderId = `LZ-${Date.now()}`;

  const { data: order, error: insertError } = await admin
    .from('buyer_orders')
    .insert({
      id               : orderId,
      buyer_id         : user.id,
      buyer_name       : user.email ?? user.id,
      status           : 'confirmed',
      fulfillment_type : orderFulfillmentType,
      total_usd        : serverTotal,            // server-computed, not client input
      currency         : 'USD',                  // server-controlled (money basis is USD)
      brand_name       : orderBrand,             // single authoritative brand for the order
      terms            : terms ?? null,
      notes            : notes ?? null,
      items            : taggedItems,
    })
    .select()
    .single();

  if (insertError) {
    // The stock allocation succeeded but the order record failed.
    // This is a rare edge case — log it prominently. We don't reverse the
    // allocation here because the data would be out of sync. The admin
    // can reconcile manually from the buyer_orders table.
    console.error('[orders] CRITICAL: stock allocated but order insert failed', insertError);
    return NextResponse.json(
      { error: 'Order could not be saved after stock was reserved. Contact support with order ID: ' + orderId },
      { status: 500 },
    );
  }

  // ── 4. Clear cart ─────────────────────────────────────────────────────────
  try {
    if (brand_name) {
      await supabase.from('buyer_cart').delete().eq('user_id', user.id).eq('brand_name', brand_name);
    } else {
      await supabase.from('buyer_cart').delete().eq('user_id', user.id);
    }
    // Also clear the session-store cart used by buyer-shop.html
    const { setBlob } = await import('@/lib/session-store');
    await setBlob(user.id, 'cart', []);
  } catch { /* cart cleanup is non-critical */ }

  // ── 5. Send confirmation email (non-blocking) ─────────────────────────────
  try {
    const { sendEmail, orderConfirmationHtml } = await import('@/lib/email');
    const buyerEmail = user.email;
    if (buyerEmail) {
      const html = orderConfirmationHtml({
        id              : orderId,
        buyer_name      : user.email ?? user.id,
        total_usd       : serverTotal,
        items           : taggedItems as Parameters<typeof orderConfirmationHtml>[0]['items'],
        fulfillment_type: orderFulfillmentType,
        terms,
      });
      await sendEmail({
        to     : buyerEmail,
        subject: `Order Confirmed — ${orderId}`,
        html,
        text   : `Your Linezheets order ${orderId} has been confirmed. Total: $${serverTotal.toFixed(2)}`,
      });
    }
  } catch { /* email is non-critical */ }

  // Audit log — order placed
  logActivity({
    user_id : user.id,
    email   : user.email,
    role    : 'buyer',
    action  : 'buyer_place_order',
    resource: `order:${orderId}`,
    status  : 'success',
    detail  : `Order ${orderId} placed — ${normalised.length} SKU(s), $${serverTotal.toFixed(2)}`,
    metadata: {
      order_id       : orderId,
      total_usd      : serverTotal,
      client_total_usd: total_usd ?? null,   // recorded for tamper telemetry
      item_count     : normalised.length,
      fulfillment_type: orderFulfillmentType,
      brand_name,
    },
  }, req);

  return NextResponse.json({ order, allocated: result.allocated });
}
