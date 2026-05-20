'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/* ─── Boutique hang-tag shape ─────────────────────────────────────────────────
   A string + rectangular tag + punched hole at the top.
   On hover: tag fills black, text turns white.
   When signed in: tag shows first part of email.
──────────────────────────────────────────────────────────────────────────────── */

function HangTag({
  label,
  sublabel,
  href,
  onClick,
}: {
  label    : string;
  sublabel?: string;
  href?    : string;
  onClick? : () => void;
}) {
  const inner = (
    <span className="flex flex-col items-center group select-none">
      {/* String */}
      <span className="block w-px h-5 bg-zinc-300 group-hover:bg-zinc-600 transition-colors duration-300" />

      {/* Tag body */}
      <span
        className="relative border border-black px-5 pt-5 pb-3 flex flex-col items-center gap-0.5
                   group-hover:bg-black transition-colors duration-300 cursor-pointer"
      >
        {/* Punched hole */}
        <span
          className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full
                     border border-black bg-white group-hover:border-white group-hover:bg-black
                     transition-colors duration-300"
        />

        <span
          className="text-[8px] uppercase tracking-[0.35em] text-black group-hover:text-white
                     transition-colors duration-300 whitespace-nowrap"
          style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}
        >
          {label}
        </span>

        {sublabel && (
          <span
            className="text-[7px] uppercase tracking-[0.2em] text-zinc-400 group-hover:text-zinc-300
                       transition-colors duration-300 whitespace-nowrap max-w-[88px] truncate"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {sublabel}
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }
  return <button onClick={onClick}>{inner}</button>;
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function VIPButton() {
  const [user, setUser]   = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const supabase          = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Loading skeleton — same size as the tag */
  if (!ready) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-px h-5 bg-zinc-100" />
        <div className="border border-zinc-100 px-5 pt-5 pb-3 w-24 h-12 animate-pulse bg-zinc-50" />
      </div>
    );
  }

  if (user) {
    const emailLabel = user.email?.split('@')[0] ?? 'member';
    return (
      <HangTag
        label="My Dashboard"
        sublabel={emailLabel}
        href="/dashboard"
      />
    );
  }

  return <HangTag label="VIP Access" href="/login" />;
}
