import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  // Non redirezionare /socket.io/ → /socket.io: il polling di socket.io usa lo
  // slash finale e il redirect 308 romperebbe il rewrite verso il server.
  skipTrailingSlashRedirect: true,
  images: { remotePatterns: [{ protocol: 'http', hostname: 'localhost' }] },
  async redirects() {
    // La UI staff definitiva è la SPA verbatim in public/staff. La root manda lì.
    return [{ source: '/', destination: '/staff/index.html', permanent: false }]
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
      // Socket.io same-origin: il browser invia il cookie HttpOnly (tako_session)
      // del dashboard e Next lo inoltra al server, che autentica il join alla room.
      // Due regole separate per preservare lo slash finale del path base di polling
      // (/socket.io/) — Next lo strippa con un singolo :path*.
      { source: '/socket.io/', destination: `${api}/socket.io/` },
      { source: '/socket.io/:path+', destination: `${api}/socket.io/:path+` },
    ]
  },
}

export default nextConfig
