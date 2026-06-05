/** @type {import('next').NextConfig} */

// Express backend URL
// - Production (Railway): set BACKEND_URL = https://linezheets-backend-production.up.railway.app
// - Custom domain (when ready): set BACKEND_URL = https://api.linezheets.com
// - Local dev: leave unset (defaults to http://localhost:4000)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig = {
  // Required for Railway / Docker standalone deployment
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.stripe.com' },
    ],
  },

  // Turbopack (Next.js 16 default bundler)
  turbopack: {},

  // Proxy Express-exclusive routes to the Railway/Express backend
  // These routes live only in backend/server.js, not in app/api/
  async rewrites() {
    return [
      // Maps
      { source: '/api/maps/:path*',                destination: `${BACKEND_URL}/api/maps/:path*` },
      // Upload routes not in Next.js
      { source: '/api/upload/remap',               destination: `${BACKEND_URL}/api/upload/remap` },
      { source: '/api/upload/product-image',       destination: `${BACKEND_URL}/api/upload/product-image` },
      { source: '/api/upload/stage/:path*',        destination: `${BACKEND_URL}/api/upload/stage/:path*` },
      // Linesheets export
      { source: '/api/linesheets/export',          destination: `${BACKEND_URL}/api/linesheets/export` },
      // Analytics views
      { source: '/api/analytics/views/:path*',     destination: `${BACKEND_URL}/api/analytics/views/:path*` },
      // Integrations
      { source: '/api/integrations/wix/:path*',        destination: `${BACKEND_URL}/api/integrations/wix/:path*` },
      { source: '/api/integrations/quickbooks/:path*', destination: `${BACKEND_URL}/api/integrations/quickbooks/:path*` },
      { source: '/api/integrations/google/:path*',     destination: `${BACKEND_URL}/api/integrations/google/:path*` },
      // Express auth routes
      { source: '/api/auth/register/:path*',       destination: `${BACKEND_URL}/api/auth/register/:path*` },
      { source: '/api/auth/session-profile',       destination: `${BACKEND_URL}/api/auth/session-profile` },
      // AI enhance (Express-only)
      { source: '/api/ai/enhance-product',         destination: `${BACKEND_URL}/api/ai/enhance-product` },
      // Marketplace brands list
      { source: '/api/marketplace/brands',         destination: `${BACKEND_URL}/api/marketplace/brands` },
      // Buyer list (admin)
      { source: '/api/buyers/list',                destination: `${BACKEND_URL}/api/buyers/list` },
    ];
  },
};

module.exports = nextConfig;
