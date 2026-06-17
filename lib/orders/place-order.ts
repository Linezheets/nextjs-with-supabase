import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { priceOrderForBuyer } from '@/lib/order-pricing';
import { logActivity } from '@/lib/audit';

/**
 * Single source of truth for placing a buyer order.
 *
 * Both the web cart (POST /api/orders) and the buyer-app/API path
 * (POST /api/buyers/orders) funnel through here so they CANNOT diverge — the
 * earlier oversell bug was caused by /api/orders inserting an order with no
 * stock allocation at all while only /api/buyers/orders allocated.
 *
 * Flow (all server-authoritative — client totals are never trusted):
 *   normalise → merge-by-SKU → atomic allocate_order_stock_v2 → re-price from
 *   the buyer's catalog → one-brand check → insert order → email + audit.
 *
 * Accepts both line shapes:
 *   - { sizes: { S: 2, M: 1 } }           (buyer-order app — one row per SKU)
 *   - { size: "S", quantity: 2 }          (web CartDrawer — flat per-size rows)
 * Flat per-size rows for the same SKU are merged into one allocation line.
 */

export type PlaceOrderResult =
  | { ok: true; order: Record<string, unknown>; allocated: unknown[]; orderId: string; total_usd: number; fulfillment_type: string }
  | { ok: false; httpStatus: number; error: string; extra?: Record<string, unknown> };

type MergedLine = {
  sku            : string;
  sizes          : Record<string, number>;
  total_qty      : number;
  delivery_window?: string;
  snapshot       : Record<string, unknown>;   // first line's data, for the order record
};

export async function placeOrder(opts: {
  buyer      : { id: string; email: string | null | undefined };
  items      : Array<Record<string, unknown>>;
  terms?     : string | null;
  notes?     : string | null;
  brand_name?: string | null;
  clientTotalUsd?: number | null;   // recorded for tamper telemetry only
  req?       : NextRequest;         // for audit-log geo/UA enrichment
}): Promise<PlaceOrderResult> {
  const { buyer, items, terms, notes, brand_name, clientTotalUsd, req } = opts;

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, httpStatus: 400, error: 'items array is required and must not be empty' };
  }

  // ── 1. Normalise + merge by SKU ───────────────────────────────────────────
  const bySku = new Map<string, MergedLine>();
  for (const item of items) {
    const sku = String(item.sku ?? '').trim();
    if (!sku) continue;

    // Per-item sizes: accept { sizes: {S:2} } or legacy { size, quantity }.
    const lineSizes: Record<string, number> = {};
    if (item.sizes && typeof item.sizes === 'object' && !Array.isArray(item.sizes)) {
      for (const [sz, qty] of Object.entries(item.sizes as Record<string, unknown>)) {
        const q = Number(qty);
        if (q > 0) lineSizes[sz] = (lineSizes[sz] ?? 0) + q;
      }
    } else if (item.size && item.quantity) {
      const q = Number(item.quantity);
      if (q > 0) lineSizes[String(item.size)] = q;
    }
    if (Object.keys(lineSizes).length === 0) continue;

    const existing = bySku.get(sku);
    if (existing) {
      for (const [sz, q] of Object.entries(lineSizes)) {
        existing.sizes[sz] = (existing.sizes[sz] ?? 0) + q;
      }
      existing.total_qty = Object.values(existing.sizes).reduce((a, b) => a + b, 0);
      if (!existing.delivery_window && item.delivery_window) existing.delivery_window = String(item.delivery_window);
    } else {
      bySku.set(sku, {
        sku,
        sizes    : { ...lineSizes },
        total_qty: Object.values(lineSizes).reduce((a, b) => a + b, 0),
        ...(item.delivery_window ? { delivery_window: String(item.delivery_window) } : {}),
        snapshot : item,
      });
    }
  }

  const merged = [...bySku.values()].filter(l => l.total_qty > 0);
  if (merged.length === 0) {
    return { ok: false, httpStatus: 400, error: 'No items with valid SKUs and quantities' };
  }

  const admin = createAdminClient();

  // ── 2. Atomic stock allocation via Postgres RPC ───────────────────────────
  const allocationPayload = merged.map(({ sku, sizes, total_qty, delivery_window }) => ({
    sku,
    sizes,
    total_qty,
    ...(delivery_window ? { delivery_window } : {}),
  }));

  const { data: allocResult, error: allocError } = await admin.rpc(
    'allocate_order_stock_v2',
    { p_items: allocationPayload },
  );

  if (allocError) {
    return { ok: false, httpStatus: 500, error: 'Stock allocation failed', extra: { detail: allocError.message } };
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
    return { ok: false, httpStatus: 409, error: message, extra: { stock_errors: result.errors } };
  }

  const fulfillmentBySku = new Map((result.allocated ?? []).map(a => [a.sku, a.fulfillment_type]));

  // ── 3. Re-price authoritatively from the buyer's catalog ──────────────────
  const pricing = await priceOrderForBuyer(
    admin,
    buyer.email,
    merged.map(i => ({ sku: i.sku, total_qty: i.total_qty })),
  );
  if (!pricing.ok) {
    // NOTE: stock was already allocated above. We surface the pricing failure;
    // see allocate/restore reconciliation — a future hardening could reverse the
    // allocation here. For now this matches the prior /api/buyers/orders behavior.
    return { ok: false, httpStatus: 422, error: pricing.error, extra: { missing_skus: pricing.missingSkus } };
  }
  if (pricing.brands.length > 1) {
    return {
      ok: false, httpStatus: 400,
      error: 'An order may only contain items from one brand. Please place a separate order per brand.',
      extra: { brands: pricing.brands },
    };
  }

  const orderBrand   = pricing.brands[0] ?? brand_name ?? null;
  const serverTotal  = pricing.totalUsd;
  const unitWspBySku = new Map(pricing.lines.map(l => [l.sku, l.unitWsp]));

  const taggedItems = merged.map(i => {
    const { size: _legacySize, quantity: _legacyQty, ...rest } = i.snapshot as Record<string, unknown>;
    const unitWsp = unitWspBySku.get(i.sku) ?? 0;
    return {
      ...rest,
      sku             : i.sku,
      sizes           : i.sizes,
      wsp_usd         : unitWsp,
      line_total_usd  : Math.round(unitWsp * i.total_qty * 100) / 100,
      fulfillment_type: fulfillmentBySku.get(i.sku) ?? 'IMMEDIATE',
    };
  });

  const orderFulfillmentType = result.order_fulfillment_type ?? 'IMMEDIATE';

  // ── 4. Persist the order record ───────────────────────────────────────────
  const orderId = `LZ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: order, error: insertError } = await admin
    .from('buyer_orders')
    .insert({
      id               : orderId,
      buyer_id         : buyer.id,
      buyer_name       : buyer.email ?? buyer.id,
      status           : 'confirmed',
      fulfillment_type : orderFulfillmentType,
      total_usd        : serverTotal,
      currency         : 'USD',
      brand_name       : orderBrand,
      terms            : terms ?? null,
      notes            : notes ?? null,
      items            : taggedItems,
    })
    .select()
    .single();

  if (insertError) {
    // Stock was allocated but the order record failed to persist. Rare; logged
    // prominently. We don't auto-reverse here to avoid masking the data issue.
    console.error('[place-order] CRITICAL: stock allocated but order insert failed', orderId, insertError);
    return {
      ok: false, httpStatus: 500,
      error: 'Order could not be saved after stock was reserved. Contact support with order ID: ' + orderId,
      extra: { order_id: orderId },
    };
  }

  // ── 5. Confirmation email (non-blocking) ──────────────────────────────────
  try {
    const { sendEmail, orderConfirmationHtml } = await import('@/lib/email');
    if (buyer.email) {
      const html = orderConfirmationHtml({
        id              : orderId,
        buyer_name      : buyer.email ?? buyer.id,
        total_usd       : serverTotal,
        items           : taggedItems as Parameters<typeof orderConfirmationHtml>[0]['items'],
        fulfillment_type: orderFulfillmentType,
        terms           : terms ?? undefined,
      });
      await sendEmail({
        to     : buyer.email,
        subject: `Order Confirmed — ${orderId}`,
        html,
        text   : `Your Linezheets order ${orderId} has been confirmed. Total: $${serverTotal.toFixed(2)}`,
      });
    }
  } catch { /* email is non-critical */ }

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  logActivity({
    user_id : buyer.id,
    email   : buyer.email,
    role    : 'buyer',
    action  : 'buyer_place_order',
    resource: `order:${orderId}`,
    status  : 'success',
    detail  : `Order ${orderId} placed — ${merged.length} SKU(s), $${serverTotal.toFixed(2)}`,
    metadata: {
      order_id        : orderId,
      total_usd       : serverTotal,
      client_total_usd: clientTotalUsd ?? null,
      item_count      : merged.length,
      fulfillment_type: orderFulfillmentType,
      brand_name      : orderBrand,
    },
  }, req);

  return { ok: true, order: order as Record<string, unknown>, allocated: result.allocated ?? [], orderId, total_usd: serverTotal, fulfillment_type: orderFulfillmentType };
}
