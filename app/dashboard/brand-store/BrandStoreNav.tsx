'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard/brand-store',               label: 'Overview'      },
  { href: '/dashboard/brand-store/products',       label: 'Products'      },
  { href: '/dashboard/brand-store/inventory',      label: 'Inventory'     },
  { href: '/dashboard/brand-store/linesheets',     label: 'Import'        },
  { href: '/dashboard/brand-store/orders',         label: 'Orders'        },
  { href: '/dashboard/brand-store/analytics',      label: 'Analytics'     },
  { href: '/dashboard/brand-store/promotions',     label: 'Promotions'    },
  { href: '/dashboard/brand-store/recommendations',label: 'Outreach'      },
  { href: '/dashboard/brand-store/payment-terms',  label: 'Payments'      },
  { href: '/dashboard/brand-store/subscriptions',  label: 'Subscription'  },
  { href: '/dashboard/brand-store/ai-tools',       label: 'AI Studio'     },
  { href: '/dashboard/brand-store/editor',         label: 'Store Editor'  },
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
      position: 'fixed', top: 60, left: 0, right: 0, zIndex: 40,
      background: '#fff', borderBottom: '1px solid #f0f0f0',
      overflowX: 'auto', whiteSpace: 'nowrap',
    }}>
      <div style={{ padding: '0 64px', display: 'inline-flex', gap: 0 }}>
        {LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'inline-block',
              padding: '13px 18px',
              fontFamily: SANS,
              fontSize: '8px',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: isActive(href) ? '#111' : '#aaa',
              borderBottom: isActive(href) ? `2px solid ${GOLD}` : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
