/** @type {import('next').NextConfig} */

// Express backend URL — set BACKEND_URL in Vercel env vars to https://api.linezheets.com
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  // Required for Railway / Docker standalone deployment
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  // Turbopack (Next.js 16 default bundler)
  turbopack: {},

  // Proxy Express-exclusive routes to Railway backend
  async rewrites() {
    return [
      // Maps
      { source: '/api/maps/:path*',              destination: `${BACKEND_URL}/api/maps/:path*` },
      // Upload routes not in Next.js
      { source: '/api/upload/remap',             destination: `${BACKEND_URL}/api/upload/remap` },
      { source: '/api/upload/product-image',     destination: `${BACKEND_URL}/api/upload/product-image` },
      { source: '/api/upload/stage/:path*',      destination: `${BACKEND_URL}/api/upload/stage/:path*` },
      // Linesheets export (Next.js has parse/jobs but not export)
      { source: '/api/linesheets/export',        destination: `${BACKEND_URL}/api/linesheets/export` },
      // Analytics views (Next.js has /api/analytics/view singular)
      { source: '/api/analytics/views/:path*',   destination: `${BACKEND_URL}/api/analytics/views/:path*` },
      // Integrations not in Next.js
      { source: '/api/integrations/wix/:path*',         destination: `${BACKEND_URL}/api/integrations/wix/:path*` },
      { source: '/api/integrations/quickbooks/:path*',  destination: `${BACKEND_URL}/api/integrations/quickbooks/:path*` },
      { source: '/api/integrations/google/:path*',      destination: `${BACKEND_URL}/api/integrations/google/:path*` },
      // Express auth routes
      { source: '/api/auth/register/:path*',     destination: `${BACKEND_URL}/api/auth/register/:path*` },
      { source: '/api/auth/session-profile',     destination: `${BACKEND_URL}/api/auth/session-profile` },
      // AI enhance (Next.js has /api/ai/generate, Express has /api/ai/enhance-product)
      { source: '/api/ai/enhance-product',       destination: `${BACKEND_URL}/api/ai/enhance-product` },
      // Marketplace brands list
      { source: '/api/marketplace/brands',       destination: `${BACKEND_URL}/api/marketplace/brands` },
      // Buyer list (admin)
      { source: '/api/buyers/list',              destination: `${BACKEND_URL}/api/buyers/list` },
    ];
  },
};

module.exports = nextConfig;
