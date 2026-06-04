'use client';

import { useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
interface Message { role: Role; content: string }

const WELCOME: Message = {
  role   : 'assistant',
  content: 'Welcome to Linezheets. How can I assist you today?',
};

function getOrCreateToken(): string {
  const key = 'lz_chat_token';
  let t = sessionStorage.getItem(key);
  if (!t) { t = crypto.randomUUID(); sessionStorage.setItem(key, t); }
  return t;
}

export default function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    // placeholder for streaming reply
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          messages    : next.map(({ role, content }) => ({ role, content })),
          sessionId,
          sessionToken: getOrCreateToken(),
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            const { text, sessionId: sid } = JSON.parse(raw);
            if (sid && !sessionId) setSessionId(sid);
            setMessages(m => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role   : 'assistant',
                content: copy[copy.length - 1].content + text,
              };
              return copy;
            });
          } catch { /* ignore malformed chunks */ }
        }
      }
    } catch {
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role   : 'assistant',
          content: 'Something went wrong. Please try again or email info@mxlla.com.',
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close concierge' : 'Open concierge'}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-black text-white flex items-center justify-center
                   hover:bg-[#c9a84c] transition-colors duration-300 shadow-lg"
        style={{ fontFamily: 'var(--font-mono, monospace)' }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2h14v11H9l-4 3v-3H2V2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-22 right-6 z-50 w-80 flex flex-col bg-white border border-zinc-200 shadow-2xl"
          style={{ height: '440px' }}
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-zinc-100 flex items-baseline justify-between">
            <span
              className="text-[11px] uppercase tracking-[0.3em] text-black"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              Concierge
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.2em] text-[#c9a84c]"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              Linezheets
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap
                    ${m.role === 'user'
                      ? 'bg-black text-white'
                      : 'bg-zinc-50 text-black border border-zinc-100'}`}
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {m.content}
                  {m.role === 'assistant' && loading && i === messages.length - 1 && m.content === '' && (
                    <span className="inline-flex gap-0.5 items-center h-3">
                      {[0, 1, 2].map(d => (
                        <span
                          key={d}
                          className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-100 px-3 py-2 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask anything…"
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-[12px] text-black placeholder:text-zinc-300
                         outline-none py-1.5 leading-relaxed max-h-24 overflow-auto disabled:opacity-40"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="mb-1 w-7 h-7 flex items-center justify-center bg-black text-white
                         hover:bg-[#c9a84c] transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="6" y1="11" x2="6" y2="1" />
                <polyline points="2,5 6,1 10,5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
