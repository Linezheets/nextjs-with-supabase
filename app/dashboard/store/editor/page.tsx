import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EditorClient from './EditorClient';

export const metadata = { title: 'Store Editor — MXLLA' };

export default async function EditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [sfRes, catalogRes] = await Promise.all([
    supabase.from('buyer_storefronts').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('buyer_vip_catalog').select('*'),
  ]);

  // If no storefront yet, redirect to setup
  if (!sfRes.data) redirect('/dashboard/store');

  const storefront = sfRes.data;

  const { data: sfProducts } = await supabase
    .from('storefront_products')
    .select('catalog_item_id')
    .eq('storefront_id', storefront.id)
    .eq('published', true);

  // Ensure theme has required shape
  const defaultTheme = {
    font_heading : 'serif',
    font_body    : 'sans',
    color_accent : storefront.accent_color ?? '#c9a84c',
    color_bg     : '#ffffff',
    color_text   : '#111111',
    color_surface: '#f9f9f9',
    sections     : [
      { id: 'hero',     type: 'hero',              enabled: true,  headline: `${storefront.name}`, subheadline: storefront.tagline ?? 'Curated pieces from the finest houses.', cta_label: 'Shop Now', cta_link: '#collection', bg_color: '#0a0a0a', text_color: '#ffffff' },
      { id: 'featured', type: 'featured_products',  enabled: true,  title: 'New Arrivals', count: 8, layout: 'grid' },
      { id: 'brands',   type: 'brands_bar',         enabled: true  },
      { id: 'contact',  type: 'contact',            enabled: true,  heading: 'Get in Touch' },
    ],
  };

  const theme = storefront.theme ?? defaultTheme;

  return (
    // Full-screen editor — no outer nav chrome
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Minimal top bar */}
      <header className="h-[60px] bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/dashboard/store"
             className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
             style={{ color: '#888', fontFamily: 'system-ui' }}>
            ← Store
          </a>
          <div className="w-px h-4 bg-zinc-200" />
          <span style={{
            fontFamily  : 'var(--font-serif), Georgia, serif',
            fontSize    : '13px',
            letterSpacing: '0.3em',
            color       : '#111',
          }}>
            {storefront.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[7.5px] uppercase tracking-[0.4em]"
                style={{ color: storefront.published ? '#52b788' : '#bbb', fontFamily: 'system-ui' }}>
            {storefront.published ? '● Live' : '○ Draft'}
          </span>
          {storefront.published && (
            <a href={`/store/${storefront.slug}`} target="_blank"
               className="text-[7.5px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
               style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              View Store ↗
            </a>
          )}
        </div>
      </header>

      <EditorClient
        initialStorefront={storefront as unknown as Parameters<typeof EditorClient>[0]['initialStorefront']}
        catalog={(catalogRes.data ?? []) as Parameters<typeof EditorClient>[0]['catalog']}
        initialPublished={(sfProducts ?? []) as Parameters<typeof EditorClient>[0]['initialPublished']}
      />
    </div>
  );
}
