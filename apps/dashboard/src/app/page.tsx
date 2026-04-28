'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function RootPage() {
  const { token } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (token) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [token, router])

  return null
}
