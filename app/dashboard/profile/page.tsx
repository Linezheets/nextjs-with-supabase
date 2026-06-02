import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardNav from '@/components/DashboardNav';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'Profile — Linezheets Buyer Portal' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: buyerRaw } = await supabase
    .from('buyers')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const buyer = buyerRaw as any;

  const profile = {
    id               : user.id,
    email            : user.email ?? '',
    first_name       : buyer?.first_name       ?? user.user_metadata?.first_name ?? null,
    last_name        : buyer?.last_name        ?? user.user_metadata?.last_name  ?? null,
    phone            : buyer?.phone            ?? null,
    store_name       : buyer?.store_name       ?? user.user_metadata?.store_name ?? null,
    store_address    : buyer?.store_address    ?? null,
    city             : buyer?.city             ?? null,
    country          : buyer?.country          ?? null,
    store_url        : buyer?.store_url        ?? null,
    instagram        : buyer?.instagram        ?? null,
    tiktok           : buyer?.tiktok           ?? null,
    linkedin         : buyer?.linkedin         ?? null,
    other_socials    : buyer?.other_socials    ?? null,
    store_type       : buyer?.store_type       ?? null,
    categories_sold  : buyer?.categories_sold  ?? [],
    price_range_min  : buyer?.price_range_min  ?? null,
    price_range_max  : buyer?.price_range_max  ?? null,
    market_segment   : buyer?.market_segment   ?? null,
    annual_buy_budget: buyer?.annual_buy_budget ?? null,
    status           : buyer?.status           ?? null,
  };

  const joinDate = new Date(user.created_at ?? Date.now()).toLocaleDateString('en-US', {
    month: 'long',
    year : 'numeric',
  });

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <DashboardNav />

      <main className="pt-[60px]">

        {/* Masthead */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6"
               style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              VIP Member · {joinDate}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize  : 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 400, lineHeight: 1.0, color: '#0a0a0a',
            }}>
              {profile.first_name && profile.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : <em style={{ fontStyle: 'italic', color: '#bbb' }}>{user.email?.split('@')[0]}</em>
              }
            </h1>
            {profile.store_name && (
              <p className="mt-4 text-[13px]" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
                {profile.store_name}
              </p>
            )}
          </div>
        </div>

        {/* Account meta strip */}
        <div className="border-b border-zinc-100 bg-zinc-50">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-5 flex items-center gap-8 flex-wrap">
            {[
              { label: 'Email',  value: profile.email },
              { label: 'Access', value: 'VIP Wholesale' },
              { label: 'Status', value: (profile.status ?? 'active').charAt(0).toUpperCase() + (profile.status ?? 'active').slice(1) },
              { label: 'Member Since', value: joinDate },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <p className="text-[7px] uppercase tracking-[0.4em]" style={{ color: '#ccc', fontFamily: 'system-ui' }}>{label}</p>
                <p className="text-[11px]" style={{ color: '#666', fontFamily: 'system-ui' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <ProfileClient initialProfile={profile} />
        </div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10 flex items-center justify-between gap-6">
          <div>
            <p style={{ fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif', fontSize: '13px', letterSpacing: '0.5em', marginBottom: '5px', fontWeight: 400 }}>Linezheets</p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>Private Showroom · Authorised Retailers Only</p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em] text-right" style={{ color: '#d8d8d8', fontFamily: 'system-ui, sans-serif' }}>
            © {new Date().getFullYear()} Linezheets · <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
