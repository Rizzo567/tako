'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function ComandaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, _hasHydrated } = useAuthStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('tako_token')
    if (!token) {
      router.replace('/login')
      return
    }
    setChecked(true)
  }, [router])

  if (!checked || !_hasHydrated) {
    return <div className="min-h-screen bg-cream" />
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[640px] min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b-2 border-ink/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-2xl text-ink">Tako</span>
            <span className="text-[10px] bg-coral px-1.5 py-0.5 rounded-full text-white font-black tracking-wider">
              COMANDA
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-coral grid place-items-center text-white font-black text-sm">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <span className="font-display font-black text-sm text-ink truncate max-w-[120px]">
                {user.name}
              </span>
            </div>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
