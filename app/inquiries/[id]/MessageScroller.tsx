'use client';

import { useEffect, useRef } from 'react';

export default function MessageScroller({ children }: { children: React.ReactNode }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [children]);

  return (
    <div className="flex-1 py-10 space-y-10 overflow-y-auto min-h-[240px]">
      {children}
      <div ref={bottomRef} />
    </div>
  );
}
