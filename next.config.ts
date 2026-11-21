import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // Browser-side router cache (per visitor, in memory). Pages are rendered per request (force-dynamic); without
  // this, Next.js 15 throws every visited page away at once (dynamic: 0), so even going back to the page just seen
  // waited for a fresh server render. Visited pages are reused for 30 s; full prefetches (main navigation, board
  // levels) for 60 s. Any server action that changes data revalidates or sets cookies, which clears this cache.
  experimental: { staleTimes: { dynamic: 30, static: 60 } },
  // Icon addresses served before the stable /brand icons existed: permanent redirects so nothing that cached them breaks.
  async redirects() {
    return [
      { source: '/icon.png', destination: '/brand/icon-192.png', permanent: true },
      { source: '/apple-icon.png', destination: '/brand/apple-touch-icon.png', permanent: true },
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
