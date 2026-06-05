import { redirect }    from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Deep-link from admin notification email: /dashboard/admin/disputes/[id]
// Redirects to the disputes list with the dispute pre-selected via query param.
export default async function AdminDisputeDeepLinkPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/admin/disputes/${id}`);

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'hello@linezheets.com,info@mxlla.com')
    .split(',').map(e => e.trim());
  const role    = user.user_metadata?.role ?? user.app_metadata?.role;
  const isAdmin = role === 'admin' || ADMIN_EMAILS.includes(user.email ?? '');
  if (!isAdmin) redirect('/dashboard');

  // Redirect to list with the specific dispute highlighted
  redirect(`/dashboard/admin/disputes?highlight=${id}`);
}
