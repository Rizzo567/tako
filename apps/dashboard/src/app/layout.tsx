import type { Metadata } from 'next'
import { Nunito, Quicksand, DM_Serif_Display, DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['400', '600', '700', '800', '900'] })
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-quicksand', weight: ['500', '600', '700'] })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], variable: '--font-dm-serif', weight: ['400'], style: ['normal', 'italic'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500', '600'] })

export const metadata: Metadata = {
  title: 'Tako Dashboard',
  description: 'Il tuo ristorante, più smart.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${nunito.variable} ${quicksand.variable} ${dmSerif.variable} ${dmSans.variable}`}>
      <body className="font-body bg-cream text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
