import { redirect }   from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandStoreNav    from './BrandStoreNav';

export default async function BrandStoreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role !== 'brand') redirect('/dashboard');

  return (
    <>
      <BrandStoreNav />
      <div style={{ paddingTop: '48px' }}>{children}</div>
    </>
  );
}
