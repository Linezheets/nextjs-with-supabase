'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LINKS = [
  { href: '/dashboard/brand-store',                 label: 'Overview'     },
  { href: '/dashboard/brand-store/products',        label: 'Products'     },
  { href: '/dashboard/brand-store/inventory',       label: 'Inventory'    },
  { href: '/dashboard/brand-store/linesheets',      label: 'Linesheets'   },
  { href: '/dashboard/brand-store/orders',          label: 'Orders'       },
  { href: '/dashboard/brand-store/analytics',       label: 'Analytics'    },
  { href: '/dashboard/brand-store/invoicing',       label: 'Invoicing'    },
  { href: '/dashboard/brand-store/packing-list',    label: 'Packing List' },
  { href: '/dashboard/brand-store/margin-settings', label: 'Margins'      },
  { href: '/dashboard/brand-store/payment-terms',   label: 'Sales Terms'  },
  { href: '/dashboard/brand-store/promotions',      label: 'Promotions'   },
  { href: '/dashboard/brand-store/recommendations', label: 'Outreach'     },
  { href: '/dashboard/brand-store/ai-tools',        label: 'AI Studio'    },
  { href: '/dashboard/brand-store/editor',          label: 'Store Editor' },
  { href: '/dashboard/brand-store/subscriptions',   label: 'Subscription' },
];

const GOLD = '#c9a84c';
const SANS = 'system-ui, -apple-system, sans-serif';

export default function BrandStoreNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard/brand-store'
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
      background: '#0a0a0a',
      borderBottom: '1px solid rgba(201,168,76,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 52 }}>

        {/* ← Home */}
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '0 20px', height: '100%',
          textDecoration: 'none', borderRight: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)', fontFamily: SANS,
          fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
          ← Home
        </Link>

        {/* Brand studio label */}
        <div style={{
          padding: '0 18px', flexShrink: 0, height: '100%',
          display: 'flex', alignItems: 'center',
          fontFamily: SANS, fontSize: 7.5, letterSpacing: '0.45em',
          textTransform: 'uppercase', color: GOLD,
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}>
          Brand Studio
        </div>

        {/* Scrollable nav links */}
        <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', flex: 1, scrollbarWidth: 'none' }}>
          <div style={{ display: 'inline-flex', padding: '0 8px' }}>
            {LINKS.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '0 15px', height: 52,
                  fontFamily: SANS, fontSize: 7.5, letterSpacing: '0.3em',
                  textTransform: 'uppercase', textDecoration: 'none',
                  color: active ? '#fff' : 'rgba(255,255,255,0.35)',
                  borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                  borderTop: '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
