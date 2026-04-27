'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-cream">
        {children}
      </main>
    </div>
  )
}
