import { createClient } from '@/lib/supabase/server';
import LandingClient from './LandingClient';
import { getShowcaseData } from '@/lib/showcase-data';

export const revalidate = 3600;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return fallback;
}

async function getPublicCatalog() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('brand_name, category, title, image_url')
      .limit(24);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const supabase   = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const items      = await getPublicCatalog();
  const brands     = [...new Set(items.map(i => safeStr(i.brand_name)).filter(Boolean))];
  const categories = [...new Set(items.map(i => safeStr(i.category)).filter(Boolean))];
  const showcase   = await getShowcaseData();

  return (
    <LandingClient
      items={items}
      brands={brands}
      categories={categories}
      showcase={showcase}
    />
  );
}
