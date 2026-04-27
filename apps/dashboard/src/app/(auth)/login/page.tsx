'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.data.token, data.data.user, data.data.restaurant)
      router.push('/dashboard')
    } catch {
      toast.error('Email o password non corretti')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-4xl text-ink mb-2">Tako</h1>
          <p className="text-ink/60 font-semibold">Accedi al tuo ristorante</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@ristorante.it" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="btn-coral w-full py-3 text-lg">
              {loading ? 'Accesso...' : 'Accedi →'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm font-semibold text-ink/60">
            Non hai un account?{' '}
            <a href="/register" className="text-coral-deep font-black hover:underline">Registrati gratis</a>
          </p>
        </div>
      </div>
    </div>
  )
}
