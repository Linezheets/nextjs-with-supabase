// app/api/ai/image/route.ts — Linezheets AI image generation (Phase 1)
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { createAdminClient } from '@/lib/supabase/server';
import { generateImage, editImage, type ImageProvider } from '@/lib/ai-image';
import { decryptSecret } from '@/lib/secret-crypto';
import { aiImageMonthlyLimit, currentPeriod } from '@/lib/ai-limits';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { prompt?: string; apiKey?: string; provider?: ImageProvider; sourceUrl?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const prompt    = body.prompt?.trim();
  const sourceUrl = body.sourceUrl?.trim();
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  // ── Resolve an image-capable key (Claude can't make images) ─────────────────
  let provider: ImageProvider = body.provider ?? 'openai';
  let apiKey: string | undefined = body.apiKey;

  if (!apiKey) {
    const { data: cfg } = await supabase
      .from('integration_configs')
      .select('config')
      .eq('brand_id', user.id)
      .eq('platform', 'ai_provider')
      .maybeSingle();
    const c = cfg?.config as { provider?: string; api_key?: string } | undefined;
    if (c?.api_key && (c.provider === 'openai' || c.provider === 'gemini')) {
      provider = c.provider;
      apiKey   = decryptSecret(c.api_key);
    }
  }

  const usingOwnKey = !!apiKey;

  // In-house fallback to a platform image key (none configured yet → graceful 400).
  if (!apiKey) {
    if (process.env.OPENAI_API_KEY) { apiKey = process.env.OPENAI_API_KEY; provider = 'openai'; }
    else if (process.env.GEMINI_API_KEY) { apiKey = process.env.GEMINI_API_KEY; provider = 'gemini'; }
  }
  if (!apiKey) {
    return NextResponse.json({
      error: 'Image generation needs an OpenAI or Gemini key. Connect one under AI Engine → Connect your own key (Claude can’t generate images).',
      code : 'no_image_key',
    }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const period = currentPeriod();
  let brandName: string | null = null;

  // ── In-house: Pro-gate + meter (separate image allowance) ───────────────────
  if (!usingOwnKey) {
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('subscription_tier, brand_name')
      .eq('user_id', user.id)
      .maybeSingle();
    brandName = sf?.brand_name ?? null;
    const limit = aiImageMonthlyLimit(sf?.subscription_tier as string);
    if (limit <= 0) {
      return NextResponse.json({ error: 'Linezheets AI image generation is on the Brand and Enterprise plans. Connect your own key, or upgrade.', code: 'upgrade_required' }, { status: 402 });
    }
    const { count, error: usageErr } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('period', period).eq('task', 'image');
    if (usageErr) {
      return NextResponse.json({ error: 'Linezheets AI is being set up. Please connect your own image key for now.', code: 'metering_unavailable' }, { status: 503 });
    }
    if ((count ?? 0) >= limit) {
      return NextResponse.json({ error: `You've used all ${limit} Linezheets AI images this month. Connect your own key, or upgrade.`, code: 'quota_exceeded', used: count ?? 0, limit }, { status: 402 });
    }
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  let png: Buffer;
  try {
    if (sourceUrl) {
      // Phase 2 — transform an existing product photo (on-model / scene / bg swap)
      if (provider !== 'openai') throw new Error('Image transform needs an OpenAI key (gpt-image-1).');
      const srcRes = await fetch(sourceUrl);
      if (!srcRes.ok) throw new Error('Could not load the source image.');
      const srcBuf = Buffer.from(await srcRes.arrayBuffer());
      png = await editImage(srcBuf, prompt, { apiKey });
    } else {
      png = await generateImage(prompt, { apiKey, provider });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image generation failed' }, { status: 500 });
  }

  // ── Store in the product-images bucket ──────────────────────────────────────
  const key = `products/ai-${randomUUID()}.png`;
  const { error: upErr } = await admin.storage.from('product-images').upload(key, png, { contentType: 'image/png', upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  const { data: urlData } = admin.storage.from('product-images').getPublicUrl(key);

  if (!usingOwnKey) {
    await admin.from('ai_usage').insert({ user_id: user.id, brand_name: brandName, period, task: 'image', provider });
  }

  return NextResponse.json({ url: urlData.publicUrl, mode: usingOwnKey ? 'byok' : 'linezheets' });
}
