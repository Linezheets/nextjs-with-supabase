// ─────────────────────────────────────────────────────────────────────────────
// Linezheets AI — image generation (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
// Text → product image. Claude has no image model, so this uses OpenAI
// (gpt-image-1) or Google Imagen. Key comes from the brand's BYO config or, for
// in-house, a platform OPENAI_API_KEY / GEMINI_API_KEY (metered + Pro-gated by the
// route). Returns raw PNG bytes for the caller to store.
// ─────────────────────────────────────────────────────────────────────────────

export type ImageProvider = 'openai' | 'gemini';

export async function generateImage(
  prompt: string,
  opts: { apiKey: string; provider?: ImageProvider; size?: string },
): Promise<Buffer> {
  const provider = opts.provider ?? 'openai';
  if (provider === 'openai') return openaiImage(prompt, opts.apiKey, opts.size ?? '1024x1024');
  if (provider === 'gemini') return geminiImage(prompt, opts.apiKey);
  throw new Error(`Unsupported image provider: ${provider}`);
}

async function openaiImage(prompt: string, apiKey: string, size: string): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body   : JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI image error (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image');
  return Buffer.from(b64, 'base64');
}

async function geminiImage(prompt: string, apiKey: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini image error (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const b64 = j?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Gemini returned no image');
  return Buffer.from(b64, 'base64');
}
