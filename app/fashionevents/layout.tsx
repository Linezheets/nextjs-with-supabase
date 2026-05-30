import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Fashion Events — Linezheets',
  description: 'Discover global fashion weeks, tradeshows, showrooms, and runway events.',
};

const AGENCY_EMAILS = ['info@linezheets.com'];

export default async function FashionEventsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAgency = user && AGENCY_EMAILS.includes(user.email || '');

  return (
    <div style={{ background: '#07070E', minHeight: '100vh', color: '#F5F0E8' }}>

      {/* Nav */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(7,7,14,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
        height: 56,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto', padding: '0 32px',
          height: '100%', display: 'flex', alignItems: 'center', gap: 32,
        }}>
          {/* Wordmark */}
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 14, letterSpacing: '0.5em',
            color: '#C9A84C', textDecoration: 'none',
            marginRight: 8,
          }}>
            LINEZHEETS
          </Link>

          <Link href="/fashionevents" style={{
            fontFamily: 'system-ui, sans-serif', fontSize: 9,
            letterSpacing: '0.4em', textTransform: 'uppercase',
            color: '#F5F0E8', textDecoration: 'none',
          }}>
            Fashion Events
          </Link>

          <div style={{ flex: 1 }} />

          {user && (
            <Link href="/fashionevents/manage" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: 'rgba(245,240,232,0.5)', textDecoration: 'none',
            }}>
              My Events
            </Link>
          )}

          {isAgency && (
            <Link href="/fashionevents/admin" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: '#C9A84C', textDecoration: 'none',
            }}>
              Admin
            </Link>
          )}

          {user ? (
            <Link href="/dashboard" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              color: 'rgba(245,240,232,0.4)', textDecoration: 'none',
            }}>
              Dashboard →
            </Link>
          ) : (
            <Link href="/login" style={{
              fontFamily: 'system-ui, sans-serif', fontSize: 9,
              letterSpacing: '0.35em', textTransform: 'uppercase',
              padding: '7px 18px',
              border: '1px solid rgba(201,168,76,0.4)',
              color: '#C9A84C', textDecoration: 'none',
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
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'system-ui, sans-serif', fontSize: 9,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(245,240,232,0.2)',
        }}>
          © {new Date().getFullYear()} Linezheets · Fashion Events Platform
        </p>
      </footer>
    </div>
  );
}
