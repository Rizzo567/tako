import type { Metadata, Viewport } from 'next'
import { Nunito, Quicksand, DM_Serif_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { PWARegister } from '@/components/PWARegister'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['400', '600', '700', '800', '900'] })
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-quicksand', weight: ['500', '600', '700'] })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], variable: '--font-dm-serif', weight: ['400'], style: ['normal', 'italic'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500', '600', '700'] })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', weight: ['500', '600'] })

export const metadata: Metadata = {
  title: 'Tako Dashboard',
  description: 'Il tuo ristorante, più smart.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tako' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
}

// Forza schema chiaro (no auto-dark del browser) + theme color app.
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#ED7159' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" data-theme="premium" data-brand="arancione" className={`${nunito.variable} ${quicksand.variable} ${dmSerif.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body className="font-body bg-[#F7F8FA] text-ink antialiased">
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  )
}
