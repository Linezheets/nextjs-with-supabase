'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const FRAMES    = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FRAME_MS  = 115;  // 13 × 115ms ≈ 1.5s per cycle
const MIN_MS    = 1500; // minimum one full cycle before zooming
const ZOOM_MS   = 700;  // zoom animation duration

export function IntroScreen({ onDone }: { onDone?: () => void }) {
  const [done, setDone]         = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [zooming, setZooming]   = useState(false);

  useEffect(() => {
    // Remove the static pre-cover — IntroScreen is now in charge
    document.getElementById('lz-pre-cover')?.remove();

    let idx       = 0;
    let cancelled = false;
    const start   = Date.now();

    const iv = setInterval(() => {
      if (cancelled) return;

      idx += 1;

      // Reached end of cycle
      if (idx >= FRAMES.length) {
        const elapsed = Date.now() - start;
        if (elapsed >= MIN_MS) {
          // At least 1.5s played — zoom now
          clearInterval(iv);
          setZooming(true);
          setTimeout(() => {
            if (cancelled) return;
            setDone(true);
            onDone?.();
          }, ZOOM_MS);
        } else {
          // Page still loading — loop back
          idx = 0;
          setFrameIdx(0);
        }
        return;
      }

      setFrameIdx(idx);
    }, FRAME_MS);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

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
          position: 'relative',
          width: 320,
          height: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
