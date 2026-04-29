'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { api } from '@/lib/api'
import { useAuthStore, useOnboardingStore } from '@/lib/store'
import { Building2, Grid3X3, ChefHat, QrCode, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const DISCOVERY_OPTIONS = [
  { value: 'passaparola', label: '🤝 Passaparola / Amici' },
  { value: 'google', label: '🔍 Google / Ricerca online' },
  { value: 'social', label: '📱 Instagram / TikTok / Social' },
  { value: 'fiera', label: '🏛️ Fiera o evento' },
  { value: 'altro', label: '💬 Altro' },
]

const STEPS = [
  {
    id: 'discovery',
    label: 'Come ci hai conosciuto?',
    desc: 'Aiutaci a capire come stai trovando Tako',
    icon: Users,
  },
  {
    id: 'restaurant',
    label: 'Dati ristorante',
    desc: 'Nome, contatti e personalizzazione del tuo locale',
    icon: Building2,
  },
  {
    id: 'tables',
    label: 'Configura i tavoli',
    desc: 'Aggiungi sale e tavoli per gestire la sala in tempo reale',
    icon: Grid3X3,
    href: '/dashboard/sala/tavoli',
  },
  {
    id: 'menu',
    label: 'Crea il menu',
    desc: 'Aggiungi sezioni, piatti e prezzi per iniziare a ricevere ordini',
    icon: ChefHat,
    href: '/dashboard/menu',
  },
  {
    id: 'qr',
    label: 'Stampa i QR',
    desc: 'Scarica i QR code da mettere sui tavoli — i clienti ordinano da soli',
    icon: QrCode,
    href: '/dashboard/sala/tavoli',
  },
  {
    id: 'staff',
    label: 'Invita il team',
    desc: 'Aggiungi camerieri, cuochi e cassieri (opzionale)',
    icon: Users,
    href: '/dashboard/staff',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { restaurant } = useAuthStore()
  const { completedSteps, completeStep, isStepComplete } = useOnboardingStore()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [discoverySource, setDiscoverySource] = useState('')
  const [form, setForm] = useState({
    name: restaurant?.name ?? '',
    phone: '',
    address: '',
    primaryColor: '#ED7159',
  })

  const currentStep = STEPS[currentIndex]
  const progress = Math.round((completedSteps.length / STEPS.length) * 100)
  const allSeen = currentIndex >= STEPS.length - 1

  function advance() {
    if (currentIndex < STEPS.length - 1) setCurrentIndex(i => i + 1)
  }

  function skip() {
    advance()
  }

  async function submitRestaurant() {
    setSaving(true)
    try {
      await api.patch('/restaurants/me', {
        name: form.name,
        phone: form.phone,
        address: form.address,
        primaryColor: form.primaryColor,
      })
      completeStep('restaurant')
      toast.success('Dati salvati!')
      advance()
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  function markAndAdvance() {
    completeStep(currentStep.id)
    advance()
  }

  function finish() {
    router.push('/dashboard')
    toast.success('Benvenuto in Tako! Sei pronto a ricevere ordini.')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Image src="/tako-cloche.png" alt="Tako" width={80} height={80} className="mx-auto mb-3" />
          <h1 className="font-display font-black text-4xl text-ink mb-1">Configura Tako</h1>
          <p className="text-ink/60 font-body">{STEPS.length} passi per iniziare</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-black text-sm text-ink">
              Passo {currentIndex + 1} di {STEPS.length}
            </span>
            <span className="font-body text-sm text-ink/60">{progress}% completato</span>
          </div>
          <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-coral rounded-full transition-all duration-500"
              style={{ width: `${Math.max(((currentIndex + 1) / STEPS.length) * 100, 5)}%` }}
            />
          </div>
          <div className="flex mt-3 gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentIndex(i)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= currentIndex ? 'bg-coral' : 'bg-ink/10'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="card p-8">
          {currentStep.id === 'discovery' ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-coral/10 grid place-items-center text-2xl">🤝</div>
                <div>
                  <h2 className="font-display font-black text-2xl text-ink">Come ci hai conosciuto?</h2>
                  <p className="text-ink/60 font-body text-sm">Ci aiuta a migliorare Tako</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {DISCOVERY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDiscoverySource(opt.value)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all font-display font-black text-base ${
                      discoverySource === opt.value
                        ? 'border-coral bg-coral/5 text-coral-deep'
                        : 'border-ink/10 bg-white hover:border-coral/40 text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={skip} className="btn-ghost flex-1">Preferisco non dirlo →</button>
                <button
                  onClick={async () => {
                    if (discoverySource) {
                      try { await api.patch('/restaurants/me', { settings: { discoverySource } }) } catch {}
                    }
                    completeStep('discovery')
                    advance()
                  }}
                  className="btn-coral flex-1"
                >
                  {discoverySource ? 'Avanti →' : 'Salta →'}
                </button>
              </div>
            </div>
          ) : currentStep.id === 'restaurant' ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-coral/10 grid place-items-center">
                  <Building2 size={22} className="text-coral" />
                </div>
                <div>
                  <h2 className="font-display font-black text-2xl text-ink">Dati ristorante</h2>
                  <p className="text-ink/60 font-body text-sm">Nome, contatti e personalizzazione</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Nome del ristorante</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Es. Osteria Da Mario"
                  />
                </div>
                <div>
                  <label className="label">Telefono</label>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+39 02 1234567"
                    type="tel"
                  />
                </div>
                <div>
                  <label className="label">Indirizzo</label>
                  <input
                    className="input"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Via Roma 1, Milano"
                  />
                </div>
                <div>
                  <label className="label">Colore principale</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                      className="w-12 h-12 rounded-xl border-2 border-ink/10 cursor-pointer bg-transparent"
                    />
                    <div className="flex gap-2">
                      {['#ED7159', '#7FC4A8', '#F5C065', '#2A1F1A'].map(c => (
                        <button
                          key={c}
                          onClick={() => setForm(f => ({ ...f, primaryColor: c }))}
                          className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: form.primaryColor === c ? '#2A1F1A' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-body text-sm text-ink/60">{form.primaryColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={skip}
                  className="btn-ghost flex-1"
                >
                  Salta →
                </button>
                <button
                  onClick={submitRestaurant}
                  disabled={saving || !form.name.trim()}
                  className="btn-coral flex-1 px-8 disabled:opacity-50"
                >
                  {saving ? 'Salvataggio…' : 'Salva e avanti →'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-coral/10 grid place-items-center">
                  <currentStep.icon size={22} className="text-coral" />
                </div>
                <div>
                  <h2 className="font-display font-black text-2xl text-ink">{currentStep.label}</h2>
                  <p className="text-ink/60 font-body text-sm">{currentStep.desc}</p>
                </div>
                {isStepComplete(currentStep.id) && (
                  <span className="ml-auto badge-success">Fatto</span>
                )}
              </div>

              <div className="bg-coral/5 border border-coral/20 rounded-2xl p-5 mb-6">
                <p className="font-body text-ink/80 text-sm leading-relaxed">
                  {currentStep.id === 'tables' &&
                    'Dalla sezione Sala potrai aggiungere le tue sale, i tavoli e i posti. Ogni tavolo avrà un QR code univoco per far ordinare i clienti.'}
                  {currentStep.id === 'menu' &&
                    'Crea sezioni come "Antipasti", "Primi", "Bevande" e aggiungi i tuoi piatti con foto, descrizione e prezzo. I clienti vedranno il menu in tempo reale.'}
                  {currentStep.id === 'qr' &&
                    'I QR code si trovano nella sezione Tavoli. Stampali, plastificali e mettili su ogni tavolo — i clienti li scansionano per ordinare senza app.'}
                  {currentStep.id === 'staff' &&
                    'Invita camerieri, cuochi e cassieri. Ogni ruolo ha una vista ottimizzata: sala, KDS cucina o cassa. Puoi farlo anche dopo.'}
                </p>
              </div>

              <div className="flex gap-3">
                {currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex(i => i - 1)}
                    className="btn-ghost px-4"
                  >
                    ← Indietro
                  </button>
                )}
                <a
                  href={currentStep.href}
                  className="btn-outline flex-1 text-center"
                >
                  Vai →
                </a>
                <button
                  onClick={markAndAdvance}
                  className="btn-coral flex-1"
                >
                  {isStepComplete(currentStep.id) ? 'Avanti →' : 'Segna fatto ✓'}
                </button>
              </div>

              {currentStep.id === 'staff' && (
                <button
                  onClick={skip}
                  className="btn-ghost w-full mt-2 text-sm"
                >
                  Salta questo passo
                </button>
              )}
            </div>
          )}
        </div>

        {allSeen && (
          <button
            onClick={finish}
            className="btn-coral w-full py-4 text-lg mt-4"
          >
            Inizia a usare Tako →
          </button>
        )}

        <div className="text-center mt-6">
          <button onClick={finish} className="btn-ghost text-sm text-ink/40">
            Salta tutto e vai alla dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
