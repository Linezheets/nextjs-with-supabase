import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEMO_EMAIL    = 'demo@linezheets.com';
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD ?? 'DemoAccess2025!';
const DEMO_ENABLED  = process.env.DEMO_ACCOUNT_ENABLED !== 'false';

export async function POST(_req: NextRequest) {
  if (!DEMO_ENABLED) {
    return NextResponse.json({ error: 'Demo access is not enabled.' }, { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email   : DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (error) {
    return NextResponse.json({ error: 'Demo login failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ redirect: '/dashboard' });
}
