import type { NextConfig } from 'next'
import { join } from 'node:path'

const nextConfig: NextConfig = {
  // Build "standalone": server Node autosufficiente che l'app desktop avvia come
  // 2º processo (porta 3002) per servire il menu cliente via QR sulla LAN.
  output: 'standalone',
  outputFileTracingRoot: join(import.meta.dirname, '../../'),
  // Non redirigere /socket.io/ → /socket.io: il polling di socket.io usa lo slash
  // finale e il 308 romperebbe il rewrite verso il server.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      // Immagini caricate (foto piatti) servite dal server API.
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
      // Socket.io same-origin: il cliente si connette al proprio host (anche via
      // LAN/QR) e Next inoltra al server, evitando problemi di CORS cross-origin.
      { source: '/socket.io/', destination: `${api}/socket.io/` },
      { source: '/socket.io/:path+', destination: `${api}/socket.io/:path+` },
    ]
  },
  devIndicators: false,
}

export default nextConfig
