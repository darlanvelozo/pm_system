import path from 'node:path';
import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: {root: path.resolve(__dirname)},
  async headers() {
    return [{source: '/sw.js', headers: [{key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate'}, {key: 'Service-Worker-Allowed', value: '/'}]}, { source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
export default config;
