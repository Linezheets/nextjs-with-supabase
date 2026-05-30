import Anthropic from '@anthropic-ai/sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AIProvider = 'claude' | 'openai' | 'gemini';

export type AITask =
  | 'product_description'
  | 'pricing_advice'
  | 'store_bio'
  | 'newsletter'
  | 'campaign_copy'
  | 'buyer_recommendations'
  | 'search_parse';

export type AIOptions = {
  provider?  : AIProvider;
  apiKey?    : string;
  maxTokens? : number;
};

// ── System prompts per task ───────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AITask, string> = {
  product_description: `You are a luxury fashion copywriter specialising in wholesale B2B product descriptions for boutiques and department stores. Write compelling, editorial product descriptions that highlight quality, craftsmanship, and commercial appeal. Use precise fashion vocabulary. Keep descriptions 60–120 words. Never use hype or marketing clichés. Respond with only the description text.`,

  pricing_advice: `You are a luxury fashion wholesale pricing strategist with deep knowledge of wholesale/retail margins, keystone pricing, and market positioning. Advise on wholesale selling price (WSP), suggested retail price (SRP), and margin strategy. Be specific and quantitative. Format your response as clear bullet points with rationale. Consider brand tier, category norms, and competitive positioning.`,

  store_bio: `You are an editorial copywriter for luxury fashion brands. Write brand store bios that are sophisticated, concise, and compelling for a B2B wholesale audience (boutique buyers and retailers). Capture the brand's aesthetic, heritage, and wholesale appeal. Keep it 80–150 words. No bullet points — flowing prose. Respond with only the bio text.`,

  newsletter: `You are an editorial fashion communications specialist. Write newsletters for luxury wholesale fashion brands targeting boutique buyers and retailers. Subject lines should be direct and intriguing (under 60 chars). Body copy should be editorial, warm, and professional — not sales-y. Structure: subject line on the first line, then a blank line, then the body. Keep body under 200 words.`,

  campaign_copy: `You are a luxury fashion brand communications specialist. Write targeted outreach copy for wholesale promotional campaigns directed at boutique buyers. Tone: editorial, professional, exclusive — never pushy. Lead with the offer value, reinforce with brand prestige. Keep it under 150 words. Respond with only the copy.`,

  buyer_recommendations: `You are a luxury fashion buying advisor. Given a buyer's store profile (categories, market segment, budget), recommend which types of products and brands they should prioritise this season. Be specific and practical. Format as concise bullet points. Keep it under 120 words.`,

  search_parse: `You are a search query parser for a luxury fashion wholesale platform. Extract structured filters from the user query. Respond with ONLY valid JSON, no explanation.`,
};

// ── Provider implementations ──────────────────────────────────────────────────

async function callClaude(system: string, prompt: string, apiKey: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model     : 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages  : [{ role: 'user', content: prompt }],
  });
  const block = msg.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

async function callOpenAI(system: string, prompt: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body   : JSON.stringify({
      model     : 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages  : [
        { role: 'system', content: system },
        { role: 'user',   content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callGemini(system: string, prompt: string, apiKey: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents          : [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig  : { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Gemini error ${res.status}`);
  }
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateAI(
  task   : AITask,
  prompt : string,
  options: AIOptions = {},
): Promise<string> {
  const provider  = options.provider  ?? 'claude';
  const maxTokens = options.maxTokens ?? 512;

  // Resolve API key: option > env var
  const keyMap: Record<AIProvider, string | undefined> = {
    claude: options.apiKey ?? process.env.ANTHROPIC_API_KEY,
    openai: options.apiKey ?? process.env.OPENAI_API_KEY,
    gemini: options.apiKey ?? process.env.GEMINI_API_KEY,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  const system = SYSTEM_PROMPTS[task];

  switch (provider) {
    case 'claude': return callClaude(system, prompt, apiKey, maxTokens);
    case 'openai': return callOpenAI(system, prompt, apiKey, maxTokens);
    case 'gemini': return callGemini(system, prompt, apiKey, maxTokens);
  }
}
