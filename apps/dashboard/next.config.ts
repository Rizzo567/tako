import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'http', hostname: 'localhost' }] },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*` },
      { source: '/uploads/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/uploads/:path*` },
    ]
  },
}

export default nextConfig
