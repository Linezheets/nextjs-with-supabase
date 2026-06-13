// app/api/ai/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { createAdminClient } from '@/lib/supabase/server';
import { generateAI, type AITask, type AIProvider } from '@/lib/ai-provider';
import { aiMonthlyLimit, currentPeriod } from '@/lib/ai-limits';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { task: AITask; prompt: string; provider?: AIProvider; apiKey?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { task, prompt, provider: bodyProvider, apiKey: bodyKey } = body;
  if (!task || !prompt?.trim()) {
    return NextResponse.json({ error: 'task and prompt are required' }, { status: 400 });
  }

  // ── Resolve the key: body override → user's saved BYO config → none ──────────
  let provider: AIProvider = bodyProvider ?? 'claude';
  let apiKey: string | undefined = bodyKey;

  if (!bodyKey) {
    const { data: config } = await supabase
      .from('integration_configs')
      .select('config')
      .eq('brand_id', user.id)
      .eq('platform', 'ai_provider')
      .maybeSingle();
    if (config?.config) {
      const cfg = config.config as { provider?: AIProvider; api_key?: string };
      provider = bodyProvider ?? cfg.provider ?? 'claude';
      apiKey   = cfg.api_key;
    }
  }

  const usingOwnKey = !!apiKey;

  // ── BYO key: the user's own provider + key, their cost, unmetered ────────────
  if (usingOwnKey) {
    try {
      const result = await generateAI(task, prompt, { provider, apiKey });
      return NextResponse.json({ result, provider, mode: 'byok' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI generation failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── In-house "Linezheets AI": platform key, Pro-gated + metered ──────────────
  // Runs on the platform's Anthropic key, so it MUST be gated to a paid plan and
  // capped per month (see lib/ai-limits.ts) — otherwise we burn our own tokens.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('subscription_tier, brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier  = (sf?.subscription_tier as string) ?? 'starter';
  const limit = aiMonthlyLimit(tier);

  if (limit <= 0) {
    return NextResponse.json({
      error: 'Linezheets AI is included on the Brand and Enterprise plans. Connect your own API key in AI settings, or upgrade your plan to use it.',
      code : 'upgrade_required',
    }, { status: 402 });
  }

  const period = currentPeriod();
  const { count, error: usageErr } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('period', period);
  // Fail CLOSED: if usage can't be read (e.g. the ai_usage migration isn't applied
  // yet), refuse in-house rather than burn platform tokens un-metered.
  if (usageErr) {
    return NextResponse.json({
      error: 'Linezheets AI is being set up. Please connect your own API key for now.',
      code : 'metering_unavailable',
    }, { status: 503 });
  }
  const used = count ?? 0;

  if (used >= limit) {
    return NextResponse.json({
      error: `You've used all ${limit} Linezheets AI generations this month. Connect your own API key for unlimited use, or upgrade your plan.`,
      code : 'quota_exceeded', used, limit,
    }, { status: 402 });
  }

  try {
    // In-house always runs on Claude (the platform's configured key).
    const result = await generateAI(task, prompt, { provider: 'claude' });
    await admin.from('ai_usage').insert({
      user_id   : user.id,
      brand_name: sf?.brand_name ?? null,
      period,
      task,
      provider  : 'claude',
    });
    return NextResponse.json({ result, provider: 'claude', mode: 'linezheets', usage: { used: used + 1, limit } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
