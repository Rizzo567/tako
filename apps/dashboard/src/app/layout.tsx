import type { Metadata } from 'next'
import { Nunito, Quicksand } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-display', weight: ['400', '600', '700', '800', '900'] })
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-body', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Tako Dashboard',
  description: 'Il tuo ristorante, più smart.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${nunito.variable} ${quicksand.variable}`}>
      <body className="font-body bg-cream text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
