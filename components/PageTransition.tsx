'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const FRAMES   = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const FRAME_MS = 38;   // 13 × 38ms ≈ 0.5s per cycle
const MIN_MS   = 500;  // minimum before zoom triggers
const ZOOM_MS  = 700;   // zoom animation duration

export function PageTransition() {
  const router   = useRouter();
  const pathname = usePathname();

  // The intro overlay only ever plays on the home page. Initialise from the path so
  // it never paints its dark wash for even one frame on a light app route.
  const [visible,  setVisible]  = useState(pathname === '/');
  const [frameIdx, setFrameIdx] = useState(0);
  const [zooming,  setZooming]  = useState(false);

  const cleanupRef   = useRef<(() => void) | null>(null);
  const navReadyRef  = useRef(false);   // navigation completed?
  const animDoneRef  = useRef(false);   // animation min-time elapsed?
  const pendingNav   = useRef<string | null>(null);
  const prevPath     = useRef(pathname);

  // ── Core animation loop ─────────────────────────────────────────────────────
  const startAnimation = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();

    let idx       = 0;
    let cancelled = false;
    const start   = Date.now();

    animDoneRef.current = false;
    navReadyRef.current = false;

    setFrameIdx(0);
    setZooming(false);
    setVisible(true);

    const tryZoom = () => {
      if (!animDoneRef.current || !navReadyRef.current) return;
      setZooming(true);
      setTimeout(() => {
        if (!cancelled) setVisible(false);
      }, ZOOM_MS);
    };

    const iv = setInterval(() => {
      if (cancelled) return;
      idx += 1;

      if (idx >= FRAMES.length) {
        const elapsed = Date.now() - start;
        if (elapsed >= MIN_MS) {
          clearInterval(iv);
          animDoneRef.current = true;
          tryZoom();
        } else {
          idx = 0; // loop
        }
        return;
      }
      setFrameIdx(idx);
    }, FRAME_MS);

    cleanupRef.current = () => { cancelled = true; clearInterval(iv); };

    // expose tryZoom so pathname watcher can trigger it
    return tryZoom;
  }, []);

  const tryZoomRef = useRef<(() => void) | null>(null);

  // ── Initial page load — only on home page ──────────────────────────────────
  useEffect(() => {
    document.getElementById('lz-pre-cover')?.remove();
    if (pathname !== '/') {
      setVisible(false);
      return;
    }
    tryZoomRef.current = startAnimation() ?? null;
    navReadyRef.current = true;
    return () => cleanupRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pathname change = navigation complete ───────────────────────────────────
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    navReadyRef.current = true;
    tryZoomRef.current?.();
  }, [pathname]);

  // No per-link interception — animation only plays on home page load

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Vignette */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 35%, #000 100%)',
        pointerEvents: 'none',
      }} />

      {/* Logo — zooms on exit */}
      <motion.div
        animate={zooming ? { scale: 44, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={zooming ? { duration: 0.7, ease: [0.7, 0, 0.95, 0.3] } : { duration: 0 }}
        style={{
          width: 320, height: 320,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={FRAMES[frameIdx]}
          src={`/intro/${FRAMES[frameIdx]}.png`}
          alt=""
          aria-hidden
          width={300}
          height={300}
          style={{
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 8px 40px rgba(0,0,0,0.7))',
          }}
        />
      </motion.div>
    </div>
  );
}
