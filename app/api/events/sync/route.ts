import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 min Vercel timeout

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    // Dynamic import so the heavy sync module is not bundled into main edge chunk
    const { runSync } = await import('@/lib/events/ai-sync');
    const results = await runSync();
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('[events/sync] Fatal:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Allow GET for manual trigger from browser (still requires secret via ?secret=)
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const { runSync } = await import('@/lib/events/ai-sync');
    const results = await runSync();
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
