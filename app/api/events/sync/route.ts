import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 min Vercel timeout

/**
 * Fail-closed cron auth. If CRON_SECRET is not configured, the endpoint refuses
 * to run rather than becoming publicly open (it triggers an AI sync job that
 * burns API quota). The previous `CRON_SECRET && ...` short-circuit silently
 * disabled the check whenever the secret was unset.
 */
function authorize(provided: string | null): NextResponse | null {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const denied = authorize(auth?.startsWith('Bearer ') ? auth.slice(7) : null);
  if (denied) return denied;

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
  const denied = authorize(secret);
  if (denied) return denied;

  try {
    const { runSync } = await import('@/lib/events/ai-sync');
    const results = await runSync();
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
