import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ApiKeysClient from './ApiKeysClient';

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <ApiKeysClient />;
}
