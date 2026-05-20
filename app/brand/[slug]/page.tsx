import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandStorefrontClient from './BrandStorefrontClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('display_name, tagline')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!sf) return { title: 'Store Not Found' };
  return { title: `${sf.display_name}${sf.tagline ? ` — ${sf.tagline}` : ''}` };
}

export default async function BrandStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (!sf) notFound();

  const { data: sfProducts } = await supabase
    .from('brand_storefront_products')
    .select('inventory_id, consumer_price, featured')
    .eq('storefront_id', sf.id)
    .eq('published', true);

  const inventoryIds = (sfProducts ?? []).map(p => p.inventory_id);
  let inventoryItems: Record<string, unknown>[] = [];
  if (inventoryIds.length) {
    const { data } = await supabase
      .from('inventory')
      .select('id,title,description,brand_name,category,color,season,srp,image_urls,material,gender')
      .in('id', inventoryIds);
    inventoryItems = (data ?? []) as Record<string, unknown>[];
  }

  // Merge consumer_price (SRP override) into items — never expose wsp_usd
  const priceMap = Object.fromEntries(
    (sfProducts ?? []).map(p => [p.inventory_id, { consumer_price: p.consumer_price, featured: p.featured }])
  );

  const items = inventoryItems.map(item => {
    const override = priceMap[item.id as number] ?? {};
    return {
      ...item,
      consumer_price: override.consumer_price ?? item.srp,
      featured      : override.featured ?? false,
      // Ensure wsp_usd is never exposed
      wsp_usd       : undefined,
      cost          : undefined,
      margin        : undefined,
      wsp            : undefined,
    };
  });

  return (
    <BrandStorefrontClient
      storefront={sf as unknown as Parameters<typeof BrandStorefrontClient>[0]['storefront']}
      items={items as unknown as Parameters<typeof BrandStorefrontClient>[0]['items']}
    />
  );
}
