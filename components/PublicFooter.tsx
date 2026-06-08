import Link from 'next/link';

const LINKS = [
  { label: 'About',    href: '/about' },
  { label: 'Pricing',  href: '/pricing' },
  { label: 'Contact',  href: '/contact' },
  { label: 'Terms',    href: '/terms' },
  { label: 'Legal',    href: '/legal' },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-zinc-100 bg-white">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-8 flex flex-wrap items-center justify-between gap-4">
        <p
          className="text-[9px] uppercase tracking-[0.4em]"
          style={{ color: '#ccc', fontFamily: 'var(--font-mono), monospace' }}
        >
          © {new Date().getFullYear()} MXLLA Agency Ltd.
        </p>

        <nav className="flex flex-wrap gap-6">
          {LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-[9px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity"
              style={{ color: '#999', fontFamily: 'var(--font-mono), monospace', textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
