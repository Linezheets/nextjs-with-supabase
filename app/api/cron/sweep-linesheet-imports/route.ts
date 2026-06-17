import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Marks linesheet import jobs that have been stuck in 'processing' as failed.
// Serverless functions can be frozen/timed-out mid-import, leaving the job
// hanging forever and the UI polling indefinitely. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  // Fail closed when CRON_SECRET is unset (avoid accepting "Bearer undefined").
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min

  const { data, error } = await admin
    .from('linesheet_imports')
    .update({
      status      : 'failed',
      errors      : JSON.stringify([{ message: 'Import timed out — job exceeded the processing window.' }]),
      completed_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('created_at', cutoff)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ swept: data?.length ?? 0 });
}
