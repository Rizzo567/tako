import type { Metadata } from 'next'
import { Nunito, Quicksand } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-display', weight: ['700', '800', '900'] })
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-body', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Tako',
  description: 'Ordina dal tavolo',
  themeColor: '#ED7159',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${nunito.variable} ${quicksand.variable}`}>
      <body className="font-body bg-cream text-ink antialiased max-w-lg mx-auto min-h-screen">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'Nunito', fontWeight: 700, borderRadius: 12 } }} />
      </body>
    </html>
  )
}
