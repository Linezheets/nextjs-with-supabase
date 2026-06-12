'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isDarkZone } from '@/lib/zones';

/**
 * Keeps the <html> theme zone in sync with the current route on client-side
 * navigation. The initial (pre-hydration) zone is set flash-free by the inline
 * script in app/layout.tsx; this component takes over for SPA transitions.
 *
 * Renders nothing.
 */
export function ZoneSync() {
  const pathname = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    const dark = isDarkZone(pathname);
    html.classList.toggle('dark', dark);
    html.style.backgroundColor = dark ? '#000000' : '#ffffff';
  }, [pathname]);

  return null;
}
