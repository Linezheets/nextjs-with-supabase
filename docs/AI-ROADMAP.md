# Linezheets AI — Roadmap

Linezheets AI runs in two modes everywhere:
- **Bring-your-own-key (BYO)** — the brand connects their own provider key
  (Claude / OpenAI / Gemini, and later image providers). Unlimited, their cost.
  Keys are stored **encrypted at rest** (AES-256-GCM, `lib/secret-crypto.ts`).
- **In-house "Linezheets AI"** — runs on the platform's key, **gated to paid plans
  and metered** per month so we never burn tokens un-capped (`lib/ai-limits.ts`,
  `ai_usage` table).

---

## ✅ Phase 0 — Text AI (shipped)
Product descriptions, B2B pricing advice, brand bios, wholesale newsletters, buyer
outreach. BYO + in-house metered. Endpoint: `POST /api/ai/generate`.

**Tiers (text):** Starter = BYO only · Brand $149 = 300/mo · Enterprise $899 = 2,000/mo.

---

## Phase 1 — Image generation (enhance & restyle product photos)
**Use case:** background removal / white-out, lifestyle backdrops, colour
correction, upscaling — turn a phone snap into a buyer-ready product image.

- **Providers:** in-house via a hosted image model (Replicate / Fal — Flux/SDXL,
  or OpenAI `gpt-image-1`, or Google Imagen); BYO = brand connects a Replicate/Fal/
  OpenAI image key.
- **Output:** generated images land in the `product-images` bucket and attach
  directly to a product **colourway's** media (ties into the new editor).
- **Where:** an "✨ Generate" action in the product editor's media block.

## Phase 2 — On-model mockups (virtual try-on)
**Use case:** show a garment on a model for lookbooks/linesheets without a shoot.
- Garment-transfer / VTON models (e.g. IDM-VTON or a commercial VTON API).
- Higher credit cost; Enterprise-first.

## Phase 3 — AI product shoots (full scene generation)
**Use case:** generate full editorial/lifestyle scenes (model + setting + styling)
from a product image + a preset, for campaigns and the storefront hero.
- Pipeline: product image → segmentation → scene composition → upscale.
- Premium credits; agency / Enterprise.

---

## Architecture (Phases 1–3)
- **`ai_image_jobs`** table — async jobs: `queued | processing | done | failed`,
  input params, `output_url`, credits charged. Image gen is slow, so it's a job,
  not a request/response.
- **`ai_credits`** ledger — *separate* from text `ai_usage` (image is far more
  expensive): per-brand monthly grant + top-up packs + consumption rows.
- **Worker** — process jobs on Railway (already hosts the `/v1` API) or a Vercel
  cron; poll the provider, write `output_url`, debit credits.
- **BYO image keys** reuse the encrypted `integration_configs` pattern.

## Credit model (proposal — numbers tunable to real provider cost)
| Plan | Text / mo | Image credits / mo | Top-up packs |
|---|---|---|---|
| Starter | BYO only | — | — |
| Brand $149 | 300 | 50 | e.g. $19 / 100 |
| Enterprise $899 | 2,000 | 300 | e.g. $79 / 500 |

Rough credit weights: **image enhance ≈ 1 · on-model mockup ≈ 3 · full shoot ≈ 8**
(calibrate once a provider is chosen).

## Cost guardrails (same discipline as the text leak fix)
- Hard per-plan caps + top-ups; **fail closed** if metering is unavailable.
- BYO keys for power users (their cost, uncapped).
- Every generation is a credited, logged job — never an uncapped fire-and-forget.

## Suggested next step
Phase 1 (image enhance) gives the fastest visible win and slots straight into the
new colourway media block. Pick a provider (Fal/Replicate Flux is cheap + fast for
fashion), add `ai_image_jobs` + `ai_credits`, and wire the editor "✨ Generate".
