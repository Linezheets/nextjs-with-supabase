import { NextResponse } from 'next/server';

// Railway / Vercel healthcheck endpoint.
// Returns 200 as long as the Next.js process is alive.
export async function GET() {
  return NextResponse.json(
    { status: 'ok', ts: new Date().toISOString() },
    { status: 200 }
  );
}
