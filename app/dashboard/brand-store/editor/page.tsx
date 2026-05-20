import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandEditorClient from './BrandEditorClient';

export const metadata = { title: 'Brand Store Editor — MXLLA' };

export default async function BrandEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sfRes = await supabase.from('brand_storefronts').select('*').eq('user_id', user.id).maybeSingle();

  let inventoryQuery = supabase
    .from('inventory')
    .select('id,title,brand_name,srp,image_urls,category,color,season')
    .eq('status', 'active');
  if (sfRes.data?.brand_name) {
    inventoryQuery = inventoryQuery.eq('brand_name', sfRes.data.brand_name);
  }
  const [inventoryRes] = await Promise.all([inventoryQuery]);

  if (!sfRes.data) redirect('/dashboard/brand-store');

  const storefront = sfRes.data;

  const { data: sfProducts } = await supabase
    .from('brand_storefront_products')
    .select('inventory_id')
    .eq('storefront_id', storefront.id)
    .eq('published', true);

  const defaultTheme = {
    font_heading : 'serif',
    font_body    : 'sans',
    color_accent : '#111111',
    color_bg     : '#ffffff',
    color_text   : '#111111',
    color_surface: '#f9f9f9',
    sections     : [
      { id: 'hero',     type: 'hero',              enabled: true,  headline: storefront.display_name, subheadline: storefront.tagline ?? 'Explore our latest collection.', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#0a0a0a', text_color: '#ffffff' },
      { id: 'featured', type: 'featured_products',  enabled: true,  title: 'New Arrivals', count: 8, layout: 'grid' },
      { id: 'about',    type: 'about',              enabled: false, heading: 'About the Brand', body: '' },
      { id: 'contact',  type: 'contact',            enabled: true,  heading: 'Get in Touch' },
    ],
  };

  const theme = storefront.theme ?? defaultTheme;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="h-[60px] bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/dashboard/brand-store"
             className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            ← Brand Store
          </a>
          <div className="w-px h-4 bg-zinc-200" />
          <span style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '13px', letterSpacing: '0.3em', color: '#111' }}>
            {storefront.display_name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[7.5px] uppercase tracking-[0.4em]"
                style={{ color: storefront.published ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
            {storefront.published ? '● Live' : '○ Draft'}
          </span>
          {storefront.published && (
            <a href={`/brand/${storefront.slug}`} target="_blank"
               className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
               style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              View Store ↗
            </a>
          )}
        </div>
      </header>

      <BrandEditorClient
        initialStorefront={storefront as unknown as Parameters<typeof BrandEditorClient>[0]['initialStorefront']}
        inventory={(inventoryRes.data ?? []) as Parameters<typeof BrandEditorClient>[0]['inventory']}
        initialPublished={(sfProducts ?? []) as Parameters<typeof BrandEditorClient>[0]['initialPublished']}
        initialTheme={theme as unknown as Parameters<typeof BrandEditorClient>[0]['initialTheme']}
      />
    </div>
  );
}
