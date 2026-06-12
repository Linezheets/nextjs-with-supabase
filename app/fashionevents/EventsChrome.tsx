'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isDarkZone } from '@/lib/zones';

const GOLD = '#C9A84C';

/**
 * Chrome (nav + footer + page surface) for the fashion-events section.
 *
 * The public browse (/fashionevents, /fashionevents/[id]) is DARK marketing; the
 * operational tools (/fashionevents/manage, /admin, /scan) are part of the LIGHT
 * app. isDarkZone() (lib/zones.ts) is the single source of truth, so this stays in
 * sync with the <html> theme set by ZoneSync.
 */
export function EventsChrome({
  signedIn,
  isAgency,
  children,
}: {
  signedIn: boolean;
  isAgency: boolean;
  children: React.ReactNode;
}) {
  const dark = isDarkZone(usePathname());

  const c = dark
    ? {
        bg: '#07070E', text: '#F5F0E8',
        headerBg: 'rgba(7,7,14,0.92)', headerBorder: 'rgba(201,168,76,0.12)',
        link: '#F5F0E8', linkMuted: 'rgba(245,240,232,0.5)', linkDim: 'rgba(245,240,232,0.4)',
        footerBorder: 'rgba(255,255,255,0.05)', footerText: 'rgba(245,240,232,0.2)',
        signInBorder: 'rgba(201,168,76,0.4)',
      }
    : {
        bg: '#fafafa', text: '#111111',
        headerBg: 'rgba(255,255,255,0.92)', headerBorder: '#eee',
        link: '#111111', linkMuted: '#888', linkDim: '#999',
        footerBorder: '#eee', footerText: '#bbb',
        signInBorder: 'rgba(201,168,76,0.55)',
      };

  return (
    <div style={{ background: c.bg, minHeight: '100vh', color: c.text }}>

      {/* Nav */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: c.headerBg, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${c.headerBorder}`,
        height: 56,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto', padding: '0 32px',
          height: '100%', display: 'flex', alignItems: 'center', gap: 32,
        }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 14, letterSpacing: '0.5em',
            color: GOLD, textDecoration: 'none', marginRight: 8,
          }}>
            LINEZHEETS
          </Link>

          <Link href="/fashionevents" style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.4em', textTransform: 'uppercase',
            color: c.link, textDecoration: 'none',
          }}>
            Fashion Events
          </Link>

          <div style={{ flex: 1 }} />

          {signedIn && (
            <Link href="/fashionevents/manage" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: c.linkMuted, textDecoration: 'none',
            }}>
              My Events
            </Link>
          )}

          {isAgency && (
            <Link href="/fashionevents/admin" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: GOLD, textDecoration: 'none',
            }}>
              Admin
            </Link>
          )}

          {signedIn ? (
            <Link href="/dashboard" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: c.linkDim, textDecoration: 'none',
            }}>
              Dashboard →
            </Link>
          ) : (
            <Link href="/login" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              padding: '7px 18px',
              border: `1px solid ${c.signInBorder}`,
              color: GOLD, textDecoration: 'none',
            }}>
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main style={{ paddingTop: 56 }}>
        {children}
      </main>

      <footer style={{
        borderTop: `1px solid ${c.footerBorder}`,
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'system-ui, sans-serif', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: c.footerText,
        }}>
          © {new Date().getFullYear()} Linezheets · Fashion Events Platform
        </p>
      </footer>
    </div>
  );
}
