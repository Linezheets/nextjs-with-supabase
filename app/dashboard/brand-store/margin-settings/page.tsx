import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MarginSettingsClient from './MarginSettingsClient';

export default async function MarginSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <MarginSettingsClient />;
}
