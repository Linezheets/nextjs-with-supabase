import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are the Linezheets concierge — a sophisticated, warm support assistant for the Linezheets luxury wholesale platform by MXLLA Agency.

Linezheets is a private VIP showroom connecting authorised wholesale buyers with designer houses. The platform features:
- A curated luxury wholesale catalogue (buyer_vip_catalog)
- AI-powered merchandising and stock management
- Exclusive brand storefronts and seasonal collections
- Fashion events and market appointments
- Order management, allocations, and invoicing
- VIP buyer onboarding and account management

Your tone: polished, concise, and helpful — like a knowledgeable showroom assistant. No filler phrases.

You can help with:
- How to browse the catalogue or apply filters
- Understanding order status, allocations, and invoices
- VIP buyer account questions (login, onboarding, access)
- Fashion event schedules and appointments
- Brand and product inquiries
- General platform navigation

For account-specific data (order details, exact stock levels) or urgent issues, direct the user to email info@mxlla.com.

Keep replies brief — 2–4 sentences unless a longer answer is clearly needed. Do not hallucinate specific stock numbers or prices.`;

type MessageParam = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId, sessionToken } = await req.json() as {
      messages: MessageParam[];
      sessionId?: string;
      sessionToken?: string;
    };

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
    }

    // Persist user message to Supabase (best-effort, non-blocking)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Persist via the service-role client and enforce ownership in code. RLS no
    // longer exposes guest (user_id null) sessions to everyone (see migration).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    let resolvedSessionId = sessionId;

    if (resolvedSessionId) {
      // Verify the caller owns this session before reading/writing into it.
      const { data: sess } = await db
        .from('chat_sessions')
        .select('user_id, session_token')
        .eq('id', resolvedSessionId)
        .maybeSingle();
      if (!sess) return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
      const owns = user ? sess.user_id === user.id : (!!sessionToken && sess.session_token === sessionToken);
      if (!owns) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    } else {
      const { data: session } = await db
        .from('chat_sessions')
        .insert({
          user_id      : user?.id ?? null,
          session_token: user ? null : (sessionToken ?? crypto.randomUUID()),
        })
        .select('id')
        .single();
      resolvedSessionId = session?.id;
    }

    const lastUserMsg = messages[messages.length - 1];
    if (resolvedSessionId && lastUserMsg?.role === 'user') {
      await db.from('chat_messages').insert({
        session_id: resolvedSessionId,
        role      : 'user',
        content   : lastUserMsg.content,
      });
    }

    // Stream from Anthropic
    if (!anthropic) return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 503 });
    const stream = await anthropic.messages.stream({
      model      : 'claude-haiku-4-5',
      max_tokens : 512,
      system     : SYSTEM_PROMPT,
      messages   : messages.slice(-12), // keep last 12 turns for context
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text;
              fullText += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text, sessionId: resolvedSessionId })}\n\n`)
              );
            }
          }
          // Persist assistant reply
          if (resolvedSessionId && fullText) {
            await db.from('chat_messages').insert({
              session_id: resolvedSessionId,
              role      : 'assistant',
              content   : fullText,
            });
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type'     : 'text/event-stream',
        'Cache-Control'    : 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[chat/route]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
