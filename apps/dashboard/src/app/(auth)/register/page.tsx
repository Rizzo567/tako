'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    restaurantName: '', restaurantSlug: '', name: '', email: '', password: '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value, ...(k === 'restaurantName' ? { restaurantSlug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') } : {}) }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      setAuth(data.data.token, data.data.user, data.data.restaurant)
      toast.success('Benvenuto in Tako! 🐙')
      router.push('/dashboard/onboarding')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message ?? 'Errore durante la registrazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-4xl text-ink mb-2">Tako</h1>
          <p className="text-ink/60 font-semibold">Crea il tuo ristorante digitale</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome ristorante</label>
              <input className="input" value={form.restaurantName} onChange={set('restaurantName')} placeholder="Trattoria da Nino" required />
            </div>
            <div>
              <label className="label">URL pubblico (slug)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink/50">tako.app/</span>
                <input className="input flex-1" value={form.restaurantSlug} onChange={set('restaurantSlug')} placeholder="trattoria-da-nino" required pattern="[a-z0-9-]+" />
              </div>
            </div>
            <div>
              <label className="label">Il tuo nome</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Mario Rossi" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="mario@ristorante.it" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="min. 8 caratteri" required minLength={8} />
            </div>
            <button type="submit" disabled={loading} className="btn-coral w-full py-3 text-lg mt-2">
              {loading ? 'Creazione...' : 'Crea il tuo Tako →'}
            </button>
          </form>
          <p className="text-center mt-5 text-sm font-semibold text-ink/60">
            Hai già un account?{' '}
            <a href="/login" className="text-coral-deep font-black hover:underline">Accedi</a>
          </p>
        </div>
      </div>
    </div>
  )
}
