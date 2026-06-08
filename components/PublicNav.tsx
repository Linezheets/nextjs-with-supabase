import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

interface Props {
  label?: string;
}

export function PublicNav({ label }: Props) {
  return (
    <header className="border-b border-zinc-100 bg-white">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">

        {/* Logo */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}
        >
          <LogoMark size={26} opacity={0.85} />
          <span
            style={{
              fontFamily   : 'var(--font-serif), Georgia, serif',
              fontSize     : '13px',
              letterSpacing: '0.45em',
              fontWeight   : 400,
              color        : '#111',
            }}
          >
            LINEZHEETS
          </span>
        </Link>

        {/* Centre label */}
        {label && (
          <p
            className="text-[8px] uppercase tracking-[0.5em] hidden sm:block"
            style={{ color: '#bbb', fontFamily: 'var(--font-mono), monospace' }}
          >
            {label}
          </p>
        )}

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link
            href="/login"
            className="text-[8px] uppercase tracking-[0.4em] transition-opacity hover:opacity-60"
            style={{ color: '#888', fontFamily: 'var(--font-mono), monospace', textDecoration: 'none' }}
          >
            Sign In
          </Link>
          <Link
            href="/join"
            className="text-[8px] uppercase tracking-[0.35em] whitespace-nowrap"
            style={{
              color         : '#000',
              background    : 'linear-gradient(135deg,#e8c56b,#c9a84c)',
              padding       : '0.55rem 1.25rem',
              textDecoration: 'none',
              fontFamily    : 'var(--font-mono), monospace',
              fontWeight    : 600,
            }}
          >
            Apply for Access
          </Link>
        </div>
      </div>
    </header>
  );
}
