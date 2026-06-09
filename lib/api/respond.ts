import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Response conventions for the public /v1 API (V1-API-PLAN.md §4).
 *
 * Success:  { data, request_id }
 * List:     { data: [...], has_more, next_cursor, request_id }
 * Error:    { error: { type, message, code? }, request_id }
 */

export type ApiErrorType =
  | 'invalid_request'
  | 'authentication'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'server';

const STATUS: Record<ApiErrorType, number> = {
  invalid_request: 400,
  authentication : 401,
  forbidden      : 403,
  not_found      : 404,
  rate_limit     : 429,
  server         : 500,
};

export function newRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '')}`;
}

export function apiOk(data: unknown, requestId: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ data, request_id: requestId }, { headers });
}

export function apiList(
  data: unknown[],
  opts: { hasMore: boolean; nextCursor: string | null; requestId: string; headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(
    { data, has_more: opts.hasMore, next_cursor: opts.nextCursor, request_id: opts.requestId },
    { headers: opts.headers },
  );
}

export function apiError(
  type: ApiErrorType,
  message: string,
  requestId: string,
  opts?: { code?: string; headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(
    { error: { type, message, ...(opts?.code ? { code: opts.code } : {}) }, request_id: requestId },
    { status: STATUS[type], headers: opts?.headers },
  );
}

// ── Cursor pagination (opaque base64url of "created_at|id") ────────────────────

export function encodeCursor(createdAt: string, id: string | number): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
