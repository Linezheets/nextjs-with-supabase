/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
