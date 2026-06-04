import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { clearPrivSession }          from '@/lib/supabase/priv-session';
import { logActivity, extractIp }    from '@/lib/audit';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Log the logout before destroying the session
  if (user) {
    const role = user.user_metadata?.role ?? user.app_metadata?.role ?? 'buyer';
    logActivity({
      user_id: user.id, email: user.email,
      role: role as 'admin' | 'brand' | 'buyer',
      action: 'logout', status: 'success',
      detail: 'User signed out',
      ip: extractIp(req),
    }, req);
  }

  await supabase.auth.signOut();

  const res = NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001')
  );
  clearPrivSession(res.cookies);
  return res;
}
