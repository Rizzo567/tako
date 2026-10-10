import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const dmSans = localFont({src:'../fonts/DMSans.ttf',variable:'--font-display',weight:'400 700',display:'swap'})
const dmSansBody = localFont({src:'../fonts/DMSans.ttf',variable:'--font-body',weight:'400 600',display:'swap'})
const dmSerif = localFont({src:[{path:'../fonts/DMSerifDisplay-Regular.ttf',weight:'400',style:'normal'},{path:'../fonts/DMSerifDisplay-Italic.ttf',weight:'400',style:'italic'}],variable:'--font-serif',display:'swap'})

export const metadata: Metadata = {
  title: 'Menu · Tako',
  description: 'Ordina dal tavolo',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tako' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon-32.png',
  },
}

// viewport-fit=cover abilita gli env(safe-area-inset-*) usati da header e bottom nav.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#1d1d1f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${dmSans.variable} ${dmSansBody.variable} ${dmSerif.variable}`}>
      <body className="font-body antialiased max-w-lg mx-auto min-h-[100dvh] bg-[var(--surface-base)] text-[var(--text-primary)]">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 14, boxShadow: '0 8px 28px rgba(42,31,26,0.12)' } }} />
      </body>
    </html>
  )
}
