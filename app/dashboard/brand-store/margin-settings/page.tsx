import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MarginSettingsClient from './MarginSettingsClient';

export default async function MarginSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('pricing_settings')
    .eq('user_id', user.id)
    .maybeSingle();

  const initial = (sf?.pricing_settings as Record<string, unknown> | null) ?? null;
  return <MarginSettingsClient initial={initial} />;
}
