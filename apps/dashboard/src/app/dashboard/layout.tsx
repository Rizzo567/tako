'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Sidebar, MobileMenuButton, MobileMenuProvider } from '@/components/layout/Sidebar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { useSocket } from '@/hooks/useSocket'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  const router = useRouter()
  useSocket()

  useEffect(() => {
    if (!token) router.push('/login')
  }, [token, router])

  if (!token) return null

  return (
    <MobileMenuProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 md:ml-64 ml-0 min-h-screen flex flex-col bg-cream">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-white border-b border-ink/10 h-14 px-6 flex items-center gap-4">
            <MobileMenuButton />
            <Breadcrumb />
          </header>

          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  )
}
