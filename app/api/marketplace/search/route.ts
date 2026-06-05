import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

type ParsedQuery = {
  keywords   : string[];   // cleaned keyword terms for ilike matching
  brand      : string | null;
  category   : string | null;
  color      : string | null;
  season     : string | null;
  price_max  : number | null;
  price_min  : number | null;
};

async function parseQuery(q: string): Promise<ParsedQuery> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { keywords: [q], brand: null, category: null, color: null, season: null, price_max: null, price_min: null };

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model     : 'claude-haiku-4-5',
    max_tokens: 256,
    system    : 'You are a search query parser for a luxury fashion wholesale platform. Extract structured filters from the user query. Respond with ONLY valid JSON, no explanation.',
    messages  : [{
      role   : 'user',
      content: `Parse this search query into structured filters: "${q}"

Return JSON with these fields (null if not present):
{
  "keywords": ["array", "of", "cleaned", "search", "terms"],
  "brand": "brand name or null",
  "category": "Womenswear|Menswear|Accessories|Footwear|Outerwear|Denim|etc or null",
  "color": "color name or null",
  "season": "SS25|AW25|SS26|AW26|etc or null",
  "price_max": number or null,
  "price_min": number or null
}`,
    }],
  });

  try {
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      keywords  : Array.isArray(parsed.keywords) ? parsed.keywords : [q],
      brand     : parsed.brand ?? null,
      category  : parsed.category ?? null,
      color     : parsed.color ?? null,
      season    : parsed.season ?? null,
      price_max : parsed.price_max ?? null,
      price_min : parsed.price_min ?? null,
    };
  } catch {
    return { keywords: [q], brand: null, category: null, color: null, season: null, price_max: null, price_min: null };
  }
}

export async function GET(req: NextRequest) {
  // Invite-only platform — require authenticated session.
  // Also guards the Anthropic AI call from unauthenticated cost abuse.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q      = searchParams.get('q') ?? '';
  const limit  = Math.min(Number(searchParams.get('limit') ?? 48), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  if (!q.trim()) return NextResponse.json({ products: [], total: 0 });

  // Parse query with AI (falls back to plain keyword if no API key)
  const parsed = await parseQuery(q);

  let query = supabase
    .from('inventory')
    .select('id, title, brand_name, category, season, color, image_urls, srp, wsp_usd, sizes, stock_total, sku', { count: 'exact' })
    .eq('status', 'active');

  // Apply structured filters when AI extracted them
  if (parsed.brand)    query = query.ilike('brand_name', `%${parsed.brand}%`);
  if (parsed.category) query = query.ilike('category', `%${parsed.category}%`);
  if (parsed.color)    query = query.ilike('color', `%${parsed.color}%`);
  if (parsed.season)   query = query.ilike('season', `%${parsed.season}%`);
  if (parsed.price_max !== null) query = query.lte('wsp_usd', parsed.price_max);
  if (parsed.price_min !== null) query = query.gte('wsp_usd', parsed.price_min);

  // Keyword OR-match across text columns
  const keywords = parsed.keywords.filter(k => k.trim().length > 1);
  if (keywords.length > 0) {
    const orParts = keywords.flatMap(k => {
      const safe = k.replace(/[%_,()]/g, c => `\\${c}`);
      return [
        `title.ilike.%${safe}%`,
        `brand_name.ilike.%${safe}%`,
        `sku.ilike.%${safe}%`,
        `category.ilike.%${safe}%`,
        `description.ilike.%${safe}%`,
      ];
    });
    query = query.or(orParts.join(','));
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [], total: count ?? 0, query: q, parsed });
}
