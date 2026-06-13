import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'] })
const dmSansBody = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], variable: '--font-serif', weight: ['400'], style: ['normal', 'italic'] })

export const metadata: Metadata = {
  title: 'Tako',
  description: 'Ordina dal tavolo',
  themeColor: '#ED7159',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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
