'use client';

import { usePathname } from 'next/navigation';
import { useCart } from '@/components/CartDrawer';

// ── Nav links visible to all buyers ──────────────────────────────────────────
const BUYER_LINKS = [
  { href: '/dashboard',              label: 'Dashboard'    },
  { href: '/dashboard/orders',       label: 'Orders'       },
  { href: '/dashboard/favorites',    label: 'Favourites'   },
  { href: '/dashboard/store',        label: 'My Store'     },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/profile',      label: 'Profile'      },
  { href: '/marketplace',             label: 'Showroom'     },
];

// ── Cart button ───────────────────────────────────────────────────────────────
function CartButton() {
  const { count, items, setOpen } = useCart();
  const total = items.reduce((s, i) => s + (i.wholesale_price ?? 0) * (i.qty ?? 1), 0);

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
      style={{ fontFamily: 'system-ui' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke={count > 0 ? '#c9a84c' : '#bbb'} strokeWidth="1.8">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      {count > 0 ? (
        <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#c9a84c' }}>
          {count} · ${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      ) : (
        <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#bbb' }}>Cart</span>
      )}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface DashboardNavProps {
  /** Pass 'brand' to show Brand Store link; 'admin' to also show Admin link */
  role?: 'buyer' | 'brand' | 'admin';
  /** Show the centre portal label */
  portalLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardNav({
  role = 'buyer',
  portalLabel = 'Buyer Portal',
}: DashboardNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? false : pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const links = [...BUYER_LINKS];

  // Brand Store link — shown for brand and admin roles
  if (role === 'brand' || role === 'admin') {
    // Insert Brand Store after Profile
    const profileIdx = links.findIndex(l => l.href === '/dashboard/profile');
    links.splice(profileIdx + 1, 0, { href: '/dashboard/brand-store', label: 'Brand Store' });
  }

  // Admin link — shown only for admin role
  if (role === 'admin') {
    links.push({ href: '/dashboard/admin/buyers', label: 'Admin' });
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
      {/*
        3-column layout: [wordmark] [center label] [nav]
        All three are normal flex children — no absolute positioning —
        so the label can never overlap the nav links.
      */}
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center h-[60px] gap-4">

        {/* Col 1 — Wordmark (fixed width, never shrinks) */}
        <a href="/"
           style={{
             fontFamily   : 'var(--font-serif), Georgia, "Times New Roman", serif',
             fontSize     : '15px',
             letterSpacing: '0.5em',
             fontWeight   : 400,
             flexShrink   : 0,
           }}>
          LINEZHEETS
        </a>

        {/* Col 2 — Portal label (grows to fill middle, text centred) */}
        <div className="flex-1 hidden lg:flex items-center justify-center pointer-events-none min-w-0">
          {portalLabel && (
            <span className="text-[8px] uppercase tracking-[0.5em] truncate"
                  style={{ color: '#bbb' }}>
              {portalLabel}
            </span>
          )}
        </div>

        {/* Col 3 — Nav links (fixed width, scrollable on mobile, never shrinks) */}
        <nav className="flex items-center gap-4 overflow-x-auto scrollbar-none" style={{ flexShrink: 0 }}>
          {links.map(({ href, label }) => {
            const active  = isActive(href);
            const isAdmin = href.includes('/admin');
            return (
              <a
                key={href}
                href={href}
                className="text-[8px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity whitespace-nowrap"
                style={{
                  color       : isAdmin ? '#c9a84c' : active ? '#111' : '#888',
                  fontFamily  : 'system-ui',
                  fontWeight  : active ? 500 : 400,
                  borderBottom: active ? '1px solid #111' : 'none',
                  paddingBottom: active ? '1px' : '0',
                }}
              >
                {label}
              </a>
            );
          })}

          <CartButton />

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-[8px] uppercase tracking-[0.35em] hover:opacity-50 transition-opacity whitespace-nowrap"
              style={{ color: '#bbb', fontFamily: 'system-ui' }}
            >
              Sign Out
            </button>
          </form>
        </nav>

      </div>
    </header>
  );
}
