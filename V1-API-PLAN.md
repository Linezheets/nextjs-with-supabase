# Linezheets `/v1` Public API — Design Plan

Status: **design** · Target host: `api.linezheets.com` (Railway backend) · Author: planning pass 2026-06-09

## 0. Why this doc
The integrations page (`app/integrations/api/page.tsx`) already advertises a public REST
API — `Bearer lz_live_…` keys and `/v1/{orders,products,buyers,linesheets}` — but **none of
it exists in code** (no `/v1` routes, no API-key infra) and **`api.linezheets.com` isn't
attached to any service** (returns Railway's "Application not found"). This plan turns the
advertised contract into a real, secure, versioned API.

## 1. Contract (match what's already advertised)
- Base URL: `https://api.linezheets.com/v1`
- Auth: `Authorization: Bearer lz_live_…` (and `lz_test_…` for sandbox)
- Resources: `orders`, `orders/{id}`, `products`, `products/{id}`, `buyers`, `linesheets`
- JSON in/out; rate-limited per key; cursor pagination.

## 2. Where it runs — Railway, isolated from the web app
The Railway service (`linezheets-backend-production`) already runs the same Next.js app and
**auto-deploys from `main`** (currently on `204dc9b`). Host the API there; keep Vercel for the
website.

- **Route location:** Next.js route handlers can live anywhere under `app/`, so the API goes in
  `app/v1/**/route.ts` (e.g. `app/v1/orders/route.ts`). No `/api` prefix.
- **Host isolation:** both Vercel (`www`) and Railway (`api`) deploy the same code, so *both*
  would expose `/v1` and `/dashboard`. Fix with a host check in `proxy.ts` (the renamed
  middleware):
  - on `api.linezheets.com`: allow only `/v1/*` and `/api/health`; 404 everything else (no
    dashboard/admin/auth UI on the API host).
  - on `www.linezheets.com`: 404 `/v1/*` (or 301 → api host).
- **Domain attach (one-time):** `railway domain api.linezheets.com` → Railway returns a CNAME
  target → set Cloudflare DNS for `api` to that target. Cloudflare proxy: start **DNS-only
  (grey cloud)** so Railway can issue the TLS cert; switch to proxied + Full(strict) later if
  desired. Verify `https://api.linezheets.com/api/health` → 200.

## 3. Authentication — API keys (net-new)
No machine-to-machine keys exist today; current `lib/supabase/bearer.ts` only handles Supabase
*user* JWTs. Build a dedicated key system.

**New table `public.api_keys`:**
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| key_prefix | text | first 12 chars, e.g. `lz_live_a1b2`, for display/lookup |
| key_hash | text | **SHA-256 of the full key**; raw key shown once at creation, never stored |
| account_type | text | `buyer` \| `brand` — which tenant owns the key |
| account_id | uuid | FK to `buyers.id` or `brand_storefronts.id` |
| scopes | text[] | e.g. `orders:read`, `orders:write`, `products:read` |
| environment | text | `live` \| `test` |
| last_used_at | timestamptz | updated async on each call |
| created_at / revoked_at | timestamptz | revoked keys reject immediately |

- **Generation:** `lz_{live|test}_` + 32 bytes base62. Return raw key once; store only the hash.
- **Verification helper** `lib/api/auth.ts → resolveApiKey(req)`: parse Bearer → SHA-256 → look up
  by `key_hash` (indexed) → reject if missing/revoked → return `{ account_type, account_id,
  scopes, environment }`. Constant-time compare; never log raw keys.
- **Tenant scoping:** every query is filtered by the key's `account_id`. A `brand` key sees only
  that brand's products/orders; a `buyer` key sees only its own orders. Use the service-role
  client with an **explicit `.eq()` filter** on the owning column (don't rely on RLS alone for
  the service role). Enforce scope per route (`requireScope('orders:write')`).

## 4. Request/response conventions
- **Success envelope:** `{ "data": … , "request_id": "…" }`; lists add
  `{ "data": [...], "has_more": bool, "next_cursor": "…", "request_id": "…" }`.
- **Errors** (mirror the existing public 404 shape):
  `{ "error": { "type": "invalid_request|authentication|rate_limit|not_found|server",
  "code": "…", "message": "…" }, "request_id": "…" }` with correct HTTP status (400/401/403/404/429/500).
- **Pagination:** cursor-based (`?limit=50&cursor=…`), opaque cursor = base64 of `(created_at,id)`.
  Max `limit` 100.
- **Idempotency (writes):** accept `Idempotency-Key` header; reuse the new
  `stripe_webhook_events`-style dedupe pattern (a small `api_idempotency` table keyed by
  `(account_id, idempotency_key)` storing the first response).
- **Versioning:** path-based `/v1`. Breaking changes → `/v2`; additive changes stay in `/v1`.

## 5. Resources (MVP scope in **bold**)
| Endpoint | Methods | Scope | Source table(s) |
|---|---|---|---|
| **`/v1/products`** | GET (list), POST | products:read/write | `inventory` / products, filtered by brand |
| **`/v1/products/{id}`** | GET, PATCH | products:* | |
| **`/v1/orders`** | GET (list), **POST** | orders:read/write | `buyer_orders` (reuse `lib/order-pricing` for server pricing) |
| **`/v1/orders/{id}`** | GET, PATCH (status) | orders:* | `buyer_orders` |
| `/v1/buyers` | GET (list/self) | buyers:read | `buyers` / `buyer_vip_catalog` |
| `/v1/linesheets` | GET, POST (import) | linesheets:* | existing linesheet parse pipeline (`/api/linesheets/parse`) |

Writes must reuse existing server-authoritative logic (pricing via `lib/order-pricing`, escrow,
idempotency) — the public API is a thin, authenticated façade over the same domain code, never a
second implementation.

## 6. Rate limiting
- Reuse `lib/rate-limit.ts` (`checkRateLimit`) for the MVP, keyed by `api_key.id` (not IP).
- **Caveat:** the current limiter is **in-memory per instance** — it won't hold across Railway
  replicas or restarts. For a real public API move to a **durable store (Upstash Redis)** before
  GA. Return `X-RateLimit-Limit / -Remaining / -Reset` headers and `429` with `Retry-After`.
- Suggested default: 1000 req/min/key (tune per plan tier).

## 7. Security checklist
- Keys hashed at rest (SHA-256), shown once, revocable; prefix-only in UI.
- Strict tenant isolation on every query (`account_id` filter) + per-route scope checks.
- API host serves **only** `/v1/*` + health (no dashboard/auth UI) via `proxy.ts` host gate.
- MFA/AAL logic in `bearer.ts` is for user sessions and does **not** apply to API keys — keep the
  two auth paths separate.
- Audit every write via existing `lib/audit.ts`; record `last_used_at` per key.
- `live` vs `test` keys hit the same DB but tag rows / can target a sandbox brand later.

## 8. Developer experience
- Publish an **OpenAPI 3.1 spec** (`/v1/openapi.json`) generated from the route schemas.
- Key management UI in the dashboard (create/revoke, copy-once) under brand-store settings.
- Replace the hand-written examples in `app/integrations/api/page.tsx` with ones generated from
  the spec so docs never drift from reality again.

## 9. Phased delivery
1. **Foundation** — `api_keys` table + migration, `lib/api/auth.ts` (resolve/scope/rate-limit),
   `proxy.ts` host gate, attach `api.linezheets.com`. Ship `/v1/products` GET + `/api/health`.
2. **Read API** — `/v1/orders`, `/v1/orders/{id}`, `/v1/products/{id}`, pagination, error envelope.
3. **Write API** — `POST /v1/orders` (reusing pricing/escrow/idempotency), `PATCH` status.
4. **Buyers + linesheets**, OpenAPI spec, dashboard key UI.
5. **Hardening/GA** — Upstash rate limiting, webhooks (`order.updated`, `payment.succeeded`),
   per-tier quotas, regenerate docs from spec.

## 10. Open questions for product
- Who gets keys — **brands**, **buyers**, or both? (Drives `account_type` and default scopes.)
- Is `/v1/orders` POST (buyers placing orders programmatically) in scope for v1, or read-only first?
- Sandbox: real `lz_test_` environment now, or live-only at launch?
