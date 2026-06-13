'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useThemeStore } from '@/lib/store'

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 14, border: '1px solid rgba(42,31,26,0.08)', boxShadow: '0 8px 28px rgba(42,31,26,0.10), 0 2px 8px rgba(42,31,26,0.05)' } }} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
