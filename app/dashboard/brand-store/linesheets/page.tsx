import { redirect }       from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import LinesheetClient    from './LinesheetClient';

export const metadata = { title: 'Linesheet Import — Linezheets' };

export default async function LinesheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: jobs } = await admin
    .from('linesheet_imports')
    .select('id, filename, status, rows_parsed, rows_created, rows_skipped, errors, created_at, completed_at')
    .eq('brand_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return <LinesheetClient initialJobs={(jobs ?? []) as Record<string, unknown>[]} />;
}
