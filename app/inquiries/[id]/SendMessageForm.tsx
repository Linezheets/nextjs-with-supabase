'use client';

import { useRef, useState, useTransition } from 'react';

export default function SendMessageForm({
  inquiryId,
  userId,
}: {
  inquiryId: number;
  userId   : string;
}) {
  const [body, setBody]         = useState('');
  const [error, setError]       = useState('');
  const [pending, startTransition] = useTransition();
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError('');

    startTransition(async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { error: msgErr } = await supabase
        .from('inquiry_messages')
        .insert({ inquiry_id: inquiryId, sender_id: userId, body: trimmed });

      if (msgErr) {
        setError(msgErr.message);
        return;
      }

      await supabase
        .from('inquiries')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', inquiryId);

      setBody('');
      textareaRef.current?.focus();

      // Full page refresh to show new message in server-rendered thread
      window.location.reload();
    });
  }

  // Auto-grow textarea
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-[7.5px] uppercase tracking-[0.45em] mb-3" style={{ color: '#bbb' }}>
        Reply
      </label>
      <textarea
        ref={textareaRef}
        rows={3}
        value={body}
        onChange={handleChange}
        placeholder="Write your message…"
        className="w-full border border-zinc-200 px-5 py-4 text-[13px] leading-[1.85]
                   resize-none overflow-hidden outline-none focus:border-black
                   transition-colors placeholder:text-zinc-300"
        style={{ color: '#333', minHeight: '90px' }}
      />
      {error && (
        <p className="mt-2 text-[11px]" style={{ color: '#c0392b' }}>{error}</p>
      )}
      <div className="flex items-center justify-between mt-4">
        <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#ddd' }}>
          {body.length > 0 ? `${body.length} chars` : ''}
        </p>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-10 py-3 text-[8px] uppercase tracking-[0.45em]
                     bg-black text-white hover:bg-zinc-900 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
