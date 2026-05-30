// app/api/ai/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { generateAI, type AITask, type AIProvider } from '@/lib/ai-provider';

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

  // Load user's configured AI provider from integration_configs
  let provider: AIProvider = bodyProvider ?? 'claude';
    let apiKey: string | undefined = bodyKey;

  if (!bodyProvider || !bodyKey) {
        const { data: config } = await supabase
          .from('integration_configs')
          .select('config')
          .eq('brand_id', user.id)
          .eq('platform', 'ai_provider')
          .maybeSingle();

      if (config?.config) {
              const cfg = config.config as { provider?: AIProvider; api_key?: string };
              provider = bodyProvider ?? cfg.provider ?? 'claude';
              apiKey = bodyKey ?? cfg.api_key;
      }
  }

  try {
        const result = await generateAI(task, prompt, { provider, apiKey });
        return NextResponse.json({ result, provider });
  } catch (e) {
        const msg = e instanceof Error ? e.message : 'AI generation failed';
        return NextResponse.json({ error: msg }, { status: 500 });
  }
}
