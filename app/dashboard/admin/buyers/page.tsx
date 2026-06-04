import { redirect }      from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';
import AdminBuyersClient from './AdminBuyersClient';

export default async function AdminBuyersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Accept either role metadata OR the email allowlist (mirrors requireAdmin.ts)
  const ADMIN_EMAILS = ['hello@linezheets.com', 'info@mxlla.com'];
  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  const isAdmin = role === 'admin' || ADMIN_EMAILS.includes(user.email ?? '');
  if (!isAdmin) redirect('/dashboard');

  return <AdminBuyersClient />;
}
