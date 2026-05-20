import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StorefrontClient from './StorefrontClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: sf } = await supabase
    .from('buyer_storefronts')
    .select('name, tagline')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!sf) return { title: 'Store Not Found' };
  return { title: `${sf.name}${sf.tagline ? ` — ${sf.tagline}` : ''}` };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: sf } = await supabase
    .from('buyer_storefronts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (!sf) notFound();

  // Fetch published storefront products + their catalog data
  const { data: sfProducts } = await supabase
    .from('storefront_products')
    .select('*')
    .eq('storefront_id', sf.id)
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true });

  const catalogIds = (sfProducts ?? []).map((p: { catalog_item_id: string }) => p.catalog_item_id);
  let catalog: unknown[] = [];
  if (catalogIds.length) {
    const { data } = await supabase.from('buyer_vip_catalog').select('*').in('id', catalogIds);
    catalog = data ?? [];
  }

  // Merge consumer_price into catalog items
  const priceMap = Object.fromEntries(
    (sfProducts ?? []).map((p: { catalog_item_id: string; consumer_price: number | null; featured: boolean }) => [
      p.catalog_item_id,
      { consumer_price: p.consumer_price, featured: p.featured },
    ])
  );

  const items = catalog.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const override = priceMap[String(i.id)] ?? {};
    return { ...i, consumer_price: override.consumer_price ?? i.retail_price, featured: override.featured ?? false };
  });

  return <StorefrontClient storefront={sf as unknown as Parameters<typeof StorefrontClient>[0]['storefront']} items={items} />;
}
