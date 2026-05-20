'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// jsQR is imported dynamically to avoid SSR issues
export default function ScanPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const event_id     = params?.id as string;

  // URL token mode: /scan/[id]?token=XXX — validate directly
  const urlToken = searchParams?.get('token');

  const [mode,        setMode]        = useState<'camera'|'manual'|'token'>(urlToken ? 'token' : 'camera');
  const [scanning,    setScanning]    = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [result,      setResult]      = useState<any>(null);
  const [error,       setError]       = useState('');
  const [eventTitle,  setEventTitle]  = useState('');

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const streamRef  = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch(`/api/events/${event_id}`).then(r => r.json()).then(j => setEventTitle(j.event?.title || 'Event'));
    if (urlToken) validateToken(urlToken);
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event_id, urlToken]);

  const validateToken = async (token: string) => {
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/events/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id, qr_token: token }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || 'Invalid QR code'); return; }
      setResult(j);
    } catch {
      setError('Check-in failed. Try again.');
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch {
      setError('Camera access denied. Use manual entry below.');
    }
  };

  const scanFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    import('jsqr').then(({ default: jsQR }) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        stopCamera();
        // Extract token from URL if encoded as URL, or use raw as token
        let token = code.data;
        try {
          const u = new URL(code.data);
          token = u.searchParams.get('token') || code.data;
        } catch {}
        validateToken(token);
      } else {
        animRef.current = requestAnimationFrame(scanFrame);
      }
    });
  };

  const reset = () => {
    setResult(null);
    setError('');
    setManualToken('');
    if (mode === 'camera') startCamera();
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#07070E',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px', fontFamily: 'system-ui, sans-serif',
    }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
          Event Check-in
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.8rem', fontWeight: 400, color: '#F5F0E8' }}>
          {eventTitle}
        </h1>
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ── Token validation mode (QR link) ────────────────────────────── */}
        {mode === 'token' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {!result && !error && (
              <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13 }}>Validating pass…</p>
            )}
          </div>
        )}

        {/* ── Result ────────────────────────────────────────────────────── */}
        {result && (
          <div style={{
            background: result.ok ? 'rgba(164,196,126,0.08)' : 'rgba(201,168,76,0.08)',
            border: `1px solid ${result.ok ? 'rgba(164,196,126,0.3)' : 'rgba(201,168,76,0.25)'}`,
            padding: '32px', textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {result.ok ? '✓' : result.already_checked_in ? '⚠' : '✗'}
            </div>
            <div style={{
              fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase',
              color: result.ok ? '#A4C47E' : '#C9A84C', marginBottom: 16,
            }}>
              {result.ok ? 'Checked In' : result.already_checked_in ? 'Already Checked In' : 'Not Valid'}
            </div>
            {result.attendee && (
              <div>
                <div style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: 6 }}>
                  {result.attendee.name}
                </div>
                {result.attendee.company && (
                  <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 4 }}>
                    {result.attendee.company}
                  </div>
                )}
                <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)' }}>
                  {result.attendee.type}
                </div>
                {result.already_checked_in && result.attendee.checked_in_at && (
                  <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', marginTop: 8 }}>
                    Checked in at {new Date(result.attendee.checked_in_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
            {mode !== 'token' && (
              <button onClick={reset} style={{
                marginTop: 24, background: '#C9A84C', border: 'none',
                color: '#07070E', padding: '10px 28px', cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.4em', textTransform: 'uppercase',
              }}>
                Scan Next
              </button>
            )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(196,126,126,0.08)', border: '1px solid rgba(196,126,126,0.25)',
            padding: '16px 20px', marginBottom: 24,
            fontSize: 13, color: '#C47E7E', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* ── Camera scanner ────────────────────────────────────────────── */}
        {mode === 'camera' && !result && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              position: 'relative', background: '#0D0D1A',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden', marginBottom: 16,
              aspectRatio: '4/3',
            }}>
              <video ref={videoRef} playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {!scanning && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 16,
                }}>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>◎</div>
                  <button onClick={startCamera} style={{
                    background: '#C9A84C', border: 'none', color: '#07070E',
                    padding: '12px 28px', cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif', fontSize: 9,
                    letterSpacing: '0.4em', textTransform: 'uppercase',
                  }}>
                    Start Camera
                  </button>
                </div>
              )}

              {scanning && (
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Scan frame */}
                  <div style={{
                    width: 200, height: 200,
                    border: '2px solid rgba(201,168,76,0.6)',
                    boxShadow: '0 0 0 9999px rgba(7,7,14,0.5)',
                  }} />
                </div>
              )}
            </div>

            {scanning && (
              <button onClick={stopCamera} style={{
                width: '100%', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(245,240,232,0.4)', padding: '10px',
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontSize: 9,
                letterSpacing: '0.3em', textTransform: 'uppercase',
              }}>
                Stop Camera
              </button>
            )}
          </div>
        )}

        {/* ── Manual entry ──────────────────────────────────────────────── */}
        {mode !== 'token' && !result && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
            <p style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: 'rgba(245,240,232,0.25)', marginBottom: 12,
            }}>
              Manual Token Entry
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="Paste QR token…"
                onKeyDown={e => e.key === 'Enter' && manualToken && validateToken(manualToken)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F5F0E8', padding: '9px 14px',
                  fontFamily: 'DM Mono, monospace', fontSize: 11, outline: 'none',
                }}
              />
              <button
                disabled={!manualToken}
                onClick={() => validateToken(manualToken)}
                style={{
                  background: manualToken ? '#C9A84C' : 'rgba(201,168,76,0.2)',
                  border: 'none', color: manualToken ? '#07070E' : 'rgba(201,168,76,0.4)',
                  padding: '9px 20px', cursor: manualToken ? 'pointer' : 'not-allowed',
                  fontFamily: 'system-ui, sans-serif', fontSize: 9,
                  letterSpacing: '0.3em', textTransform: 'uppercase',
                }}
              >
                Validate
              </button>
            </div>
          </div>
        )}

        {/* Mode switcher */}
        {mode === 'camera' && !result && (
          <button onClick={() => { stopCamera(); setMode('manual'); }} style={{
            width: '100%', marginTop: 12, background: 'transparent',
            border: 'none', color: 'rgba(245,240,232,0.25)',
            cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontSize: 10,
          }}>
            Switch to manual entry
          </button>
        )}
      </div>
    </div>
  );
}
