import { NextResponse } from 'next/server';

const TIER_LIMITS = {
  starter   : { max_products: 50,  ai_features: false, marketplace: false },
  studio    : { max_products: -1,  ai_features: true,  marketplace: true  },
  enterprise: { max_products: -1,  ai_features: true,  marketplace: true  },
};

export async function GET() {
  return NextResponse.json({
    plans: [
      {
        id: 'starter', name: 'Starter', price_monthly: 49, price_annual: 39,
        limits: TIER_LIMITS.starter,
        features: [
          'Up to 50 products',
          '5 line sheets/month',
          'Basic AI matching',
          'Stripe & PayPal payments',
          'Shippo labels',
        ],
      },
      {
        id: 'studio', name: 'Studio', price_monthly: 149, price_annual: 119,
        limits: TIER_LIMITS.studio,
        popular: true,
        features: [
          'Unlimited products',
          'Unlimited line sheets',
          'Full AI Studio — 6 modules',
          'Marketplace listing',
          'ERP sync',
          'Buyer intelligence scoring',
          'Priority support',
        ],
      },
      {
        id: 'enterprise', name: 'Enterprise', price_monthly: null, price_annual: null,
        limits: TIER_LIMITS.enterprise,
        features: [
          'Everything in Studio',
          'Multi-brand portfolio',
          'Custom AI training',
          'Dedicated CSM',
          'SLA uptime',
          'SSO / SAML',
          'Custom integrations',
        ],
      },
    ],
  });
}
