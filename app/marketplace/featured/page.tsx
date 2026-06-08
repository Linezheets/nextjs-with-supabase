import { createClient } from '@/lib/supabase/server';
import { FeaturedCollectionsClient } from './client';

type Item = {
  brand_name?: unknown;
  category?: unknown;
  title?: unknown;
  image_url?: unknown;
  wholesale_price?: unknown;
  retail_price?: unknown;
  season?: unknown;
};

async function getFeaturedItems(): Promise<Item[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('brand_name,category,title,image_url,wholesale_price,retail_price,season')
      .not('image_url', 'is', null)
      .limit(24);
    return (data ?? []) as Item[];
  } catch {
    return [];
  }
}

export default async function FeaturedCollectionsPage() {
  const items = await getFeaturedItems();
  return <FeaturedCollectionsClient items={items} />;
}
