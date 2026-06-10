# Linezheets — End-to-End Payment Smoke Test

Validates the post-audit money path on a real running instance. **Run against Stripe TEST keys** (`STRIPE_SECRET_KEY=sk_test_…`, test webhook secret) so no real money moves — the test card `4242 4242 4242 4242` only works in test mode. If you must test on live, you'll be entering a real card yourself (Claude can't).

## Prerequisites
- An **approved buyer** account (can log in, see the catalog).
- A **brand** with an **active Stripe Connect account** (`brand_storefronts.stripe_account_status = 'active'`).
- At least one **product** for that brand with `wsp_usd > 0` and stock in `sizes` (not all-zero — see the 212-unpriced-products cleanup).
- `CRON_SECRET` known (for step 4).

---

## 1. Order creation — server-authoritative price (Themes A, C)
1. As the buyer, add the product to cart and check out.
2. ✅ Order total = catalog price × qty (the buyer's `get_buyer_catalog` price), **not** anything the client sent. `currency = 'USD'`, `brand_name` set.
3. **Tamper check:** POST `/api/buyers/orders` with `total_usd: 1` for a real cart → the stored total is recomputed (the `1` is ignored; recorded as `client_total_usd` in the audit log).
4. **Mixed-brand check:** a cart with two brands → `400 "An order may only contain items from one brand"`.
5. **Unpriced check:** a SKU with `wsp_usd ≤ 0` → `422 "Unknown or unavailable SKU(s)"`.

## 2. Payment intent — idempotency (Theme E)
1. Start checkout payment (card). Confirm with `4242 4242 4242 4242`, any future expiry/CVC.
2. ✅ Exactly one `buyer_payments` row (seq 1). **Double-submit** the create-intent call → same client_secret returned, no second row (`reused: true`).
3. ✅ After success, the order is `paid` (single full payment).

## 3. Installment plan — split + gating (Themes B, E)
1. Create a plan: POST `/api/payments/installment-plan` `{ order_id, plan_type: "3month", payment_method_id }`.
2. ✅ 3 `buyer_payments` rows; their `amount_usd` **sum exactly to `total_usd`** (remainder on the last).
3. ✅ After the first charge, order is **`partially_paid`**, NOT `paid`. Re-POST the plan → `409 "A payment plan already exists"`.

## 4. Cron — charge once, no double (Theme E)
1. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/charge-installments` (set a due installment's `due_date` to today first).
2. ✅ The due row charges and flips to `succeeded`/`processing`. **Run it again immediately** → that row is NOT charged twice (claimed/idempotent).
3. ✅ Order becomes `paid` only once the succeeded amounts cover `total_usd`.

## 5. Webhook idempotency (Theme E / D10-2)
1. In the Stripe dashboard (test mode), **resend** a `payment_intent.succeeded` event.
2. ✅ Second delivery returns `{ duplicate: true }`; no duplicate rows / re-applied side effects. (Row in `stripe_webhook_events`.)

## 6. Shipment + transition validation (Themes F, N)
1. As the brand, add tracking: PATCH `/api/orders/[id]/tracking` → status `shipped`, buyer gets a **shipped email** with the tracking link.
2. **Illegal transition:** PATCH `/api/orders/[id]/status` `{ status: "delivered" }` on a `confirmed` (never-shipped) order → `409 "Illegal status transition"`.

## 7. Delivery + escrow release (Themes B, C, D, F, N)
1. Brand marks `delivered` (only allowed from `shipped`).
2. ✅ `releaseEscrow` transfers the **collected amount** (not the full total if installments remain) to **that brand's** Connect account — **one** transfer, idempotent. Buyer gets a **delivered email**, brand gets a **funds-released email**.
3. **Concurrency check:** fire the status PATCH and `POST /api/payments/release/[orderId]` together → only one transfer is created (`escrow_status` claim + Stripe idempotency key).

## 8. Dispute + clawback (Theme F)
1. Open a dispute on the order → attempt release → ✅ `"an open dispute exists"` (blocked).
2. Resolve `resolved_refund`: if escrow was already released, ✅ the brand transfer is **reversed** (clawed back); else funds stay in escrow for refund. Order → `refund_approved`.

## 9. Invoice + customs (Themes L, M)
1. GET `/api/orders/[id]/invoice` (PDF).
2. ✅ Amounts show **cents**; a **Customs Declaration** table lists per-SKU HS code / origin / weights / declared value / Incoterms (the brand's configured value); a red note appears if HS code/origin are missing.

## 10. Public price redaction (Theme J)
1. `curl https://<host>/api/marketplace/products?limit=2` **unauthenticated**.
2. ✅ Response has `srp` but **no `wsp_usd` / `tier_pricing`**.

---
**Cleanup:** delete the test order/payments rows, or use a disposable test order. In Stripe test mode nothing settles, so no refunds are needed.
