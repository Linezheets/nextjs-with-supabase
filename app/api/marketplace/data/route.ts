import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { getBuyerCatalog }           from '@/lib/buyer-catalog';
import type { CatalogItem }          from '@/lib/types';

export const revalidate = 0;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

async function getPublicMeta(): Promise<CatalogItem[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('buyer_vip_catalog').select('brand_name, category');
    return Array.isArray(data) ? (data as CatalogItem[]) : [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const activeBrand    = searchParams.get('brand')  ?? '';
  const activeCategory = searchParams.get('cat')    ?? '';
  const activeSeason   = searchParams.get('season') ?? '';
  const activeStatus   = searchParams.get('status') ?? '';
  const search         = searchParams.get('q')      ?? '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const meta       = await getPublicMeta();
    const brands     = [...new Set(meta.map(i => safeStr(i.brand_name)).filter(Boolean))].sort();
    const categories = [...new Set(meta.map(i => safeStr(i.category)).filter(Boolean))].sort();
    return NextResponse.json({ user: null, brands, categories, seasons: [], items: [], all: [], activeBrand, activeCategory, activeSeason, activeStatus, search });
  }

  const all        = await getBuyerCatalog(supabase, user.email ?? '');
  const brands     = [...new Set(all.map(i => safeStr(i.brand_name)).filter(Boolean))].sort();
  const categories = [...new Set(all.map(i => safeStr(i.category)).filter(Boolean))].sort();
  const seasons    = [...new Set(all.map(i => safeStr(i.season)).filter(Boolean))].sort();

  const items = all.filter(item => {
    if (activeBrand    && safeStr(item.brand_name)       !== activeBrand)    return false;
    if (activeCategory && safeStr(item.category)         !== activeCategory)  return false;
    if (activeSeason   && safeStr(item.season)           !== activeSeason)    return false;
    if (activeStatus   && safeStr(item.inventory_status) !== activeStatus)    return false;
    if (search) {
      const q   = search.toLowerCase();
      const hay = [item.title, item.brand_name, item.category, item.description, item.style_number]
        .map(v => safeStr(v).toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return NextResponse.json({ user: user.email, brands, categories, seasons, items, all, activeBrand, activeCategory, activeSeason, activeStatus, search });
}
