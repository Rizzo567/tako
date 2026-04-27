'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Check, ChefHat, Grid3X3, QrCode, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 'menu', label: 'Crea il menu', desc: 'Aggiungi almeno una sezione e un piatto', icon: ChefHat },
  { id: 'tables', label: 'Configura i tavoli', desc: 'Aggiungi le tue sale e i tavoli', icon: Grid3X3 },
  { id: 'qr', label: 'Stampa i QR', desc: 'Scarica i QR code per i tavoli', icon: QrCode },
  { id: 'staff', label: 'Invita il team', desc: 'Aggiungi camerieri e cuochi', icon: Users },
]

export default function OnboardingPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const router = useRouter()
  const { restaurant } = useAuthStore()

  function complete(id: string) {
    setCompleted(s => new Set([...s, id]))
  }

  function goToDashboard() {
    router.push('/dashboard')
    toast.success('Benvenuto in Tako! Sei pronto a ricevere ordini.')
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <p className="text-5xl mb-3">🐙</p>
          <h1 className="font-display font-black text-4xl mb-2">Ciao, {restaurant?.name}!</h1>
          <p className="text-ink/60 font-semibold">Completa il setup in 4 passi</p>
        </div>

        <div className="space-y-3 mb-8">
          {STEPS.map(step => {
            const done = completed.has(step.id)
            return (
              <div key={step.id} className={`card flex items-center gap-4 ${done ? 'opacity-60' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${done ? 'bg-mint text-white' : 'bg-coral/10 text-coral'}`}>
                  {done ? <Check size={22} /> : <step.icon size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black">{step.label}</p>
                  <p className="text-sm text-ink/60 font-semibold">{step.desc}</p>
                </div>
                {!done && (
                  <a
                    href={step.id === 'menu' ? '/dashboard/menu' : step.id === 'tables' ? '/dashboard/sala' : step.id === 'staff' ? '/dashboard/staff' : '#'}
                    onClick={() => setTimeout(() => complete(step.id), 3000)}
                    className="btn-coral text-sm px-4 py-2 shrink-0"
                  >
                    Vai →
                  </a>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={goToDashboard} className="btn-coral w-full py-4 text-lg">
          {completed.size >= 2 ? 'Inizia a usare Tako →' : 'Salta e vai alla dashboard →'}
        </button>
      </div>
    </div>
  )
}
