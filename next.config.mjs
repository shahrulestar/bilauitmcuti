/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
        destination: '/foundation-professional',
        permanent: true, // HTTP 308
      },
    ]
  },
}

export default nextConfig
