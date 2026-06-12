import { redirect }    from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminDisputesClient from './AdminDisputesClient';

export const metadata = { title: 'Disputes — Admin · Linezheets' };

export default async function AdminDisputesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'info@linezheets.com,info@mxlla.com')
    .split(',').map(e => e.trim());
  const role    = user.user_metadata?.role ?? user.app_metadata?.role;
  const isAdmin = role === 'admin' || ADMIN_EMAILS.includes(user.email ?? '');
  if (!isAdmin) redirect('/dashboard');

  return <AdminDisputesClient />;
}
