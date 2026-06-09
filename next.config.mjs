import path from 'path';
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
    // Inline at build from either name (Cloudflare build env may use TURNSTILE_SITE_KEY only).
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
      process.env.TURNSTILE_SITE_KEY?.trim() ||
      "",
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/dev',
        destination: 'https://shahrulestar.com',
        permanent: true, // HTTP 308
      },
      {
        source: '/foundation',
        destination: '/',
        permanent: true, // HTTP 308
      },
      {
        source: '/pwa',
        destination: '/download',
        permanent: true, // HTTP 308
      },
      {
        source: '/sponsor',
        destination: 'https://shahrulestar.com/sponsor',
        permanent: true, // HTTP 308
      },
      {
        source: '/roadmap',
        destination:
          'https://bilauitmcuti.notion.site/3774a1187b9c8032ab31eb9a2fecf0ea?v=3774a1187b9c807793e9000c046a55e4',
        permanent: true, // HTTP 308
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // Calendar data: same-origin /api/v1/meta|calendar (legacy /api/calendar-proxy). Turnstile requires challenges.cloudflare.com.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ]
  },
}

if (process.env.NODE_ENV === 'development' && process.env.SKIP_CLOUDFLARE_DEV !== '1') {
  try {
    await setupDevPlatform({
      configPath: path.resolve(process.cwd(), 'wrangler.jsonc'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      [
        '⚠ Cloudflare dev platform unavailable — starting Next.js without Workers AI bindings.',
        '  Calendar and UI will work; chat will return 503 until AI is available.',
        `  Cause: ${message}`,
        '  Fix: ensure api.cloudflare.com is reachable, run `npx wrangler login`, then restart.',
        '  Offline UI only: set SKIP_CLOUDFLARE_DEV=1 before `pnpm dev`.',
      ].join('\n'),
    );
  }
}

export default nextConfig
