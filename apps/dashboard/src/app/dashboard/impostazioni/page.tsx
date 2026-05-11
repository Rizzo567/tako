'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useThemeStore } from '@/lib/store'
import { Upload, Loader2, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ImpostazioniPage() {
  const qc = useQueryClient()
  const { theme, setTheme } = useThemeStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant-me'],
    queryFn: () => api.get('/restaurants/me').then(r => r.data.data),
  })

  const [form, setForm] = useState({ name: '', address: '', phone: '', primaryColor: '#ED7159', logoUrl: '' })
  const [printerIp, setPrinterIp] = useState('')
  const [printerPort, setPrinterPort] = useState('9100')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name ?? '',
        address: restaurant.address ?? '',
        phone: restaurant.phone ?? '',
        primaryColor: restaurant.primaryColor ?? '#ED7159',
        logoUrl: restaurant.logoUrl ?? '',
      })
      setPrinterIp(restaurant.settings?.printerIp ?? '')
      setPrinterPort(String(restaurant.settings?.printerPort ?? 9100))
    }
  }, [restaurant])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch('/restaurants/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-me'] }); toast.success('Salvato!') },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data.data.url
      setForm(f => ({ ...f, logoUrl: url }))
      await api.patch('/restaurants/me', { logoUrl: url })
      qc.invalidateQueries({ queryKey: ['restaurant-me'] })
      toast.success('Logo aggiornato!')
    } catch {
      toast.error('Errore upload logo')
    } finally {
      setUploading(false)
    }
  }

  function saveMain() {
    saveMutation.mutate({
      name: form.name,
      address: form.address,
      phone: form.phone,
      primaryColor: form.primaryColor,
      logoUrl: form.logoUrl || null,
    })
  }

  function savePrinter() {
    const port = parseInt(printerPort)
    saveMutation.mutate({
      settings: {
        ...restaurant?.settings,
        printerIp: printerIp.trim() || undefined,
        printerPort: printerIp.trim() && port > 0 ? port : undefined,
      },
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display font-black text-3xl mb-8">Impostazioni</h1>

      {/* Theme selector */}
      <div className="card mb-6">
        <h2 className="font-display font-black text-xl mb-1">Tema interfaccia</h2>
        <p className="text-ink/50 text-sm font-semibold mb-5">Scegli lo stile visivo della dashboard</p>
        <div className="grid grid-cols-2 gap-4">
          {(['tako', 'premium'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                theme === t
                  ? 'border-coral bg-coral/5'
                  : 'border-ink/15 hover:border-ink/30 bg-white'
              }`}
            >
              {theme === t && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-coral flex items-center justify-center text-white text-xs">✓</span>
              )}
              <div className="text-2xl mb-2">{t === 'tako' ? '🐙' : '✦'}</div>
              <div className="font-display font-black text-base capitalize">{t}</div>
              <div className="text-xs text-ink/50 font-semibold mt-0.5">
                {t === 'tako' ? 'Bold, energico, giocoso' : 'Elegante, raffinato, serif'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dati ristorante */}
      <div className="card mb-6">
        <h2 className="font-display font-black text-xl mb-5">Dati ristorante</h2>
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="label">Logo ristorante</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl border-2 border-ink/15 bg-cream grid place-items-center overflow-hidden shrink-0">
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="logo" className="w-full h-full object-contain" />
                  : <span className="font-display font-black text-2xl text-coral">T</span>
                }
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-outline flex items-center gap-2 text-sm px-4 py-2"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Caricamento...' : 'Carica logo'}
                </button>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, logoUrl: '' }))}
                    className="text-xs text-ink/40 hover:text-red-500 transition-colors font-semibold text-left"
                  >
                    Rimuovi logo
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <div><label className="label">Nome ristorante</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Indirizzo</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Telefono</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div>
            <label className="label">Colore brand</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-12 h-12 rounded-xl border-2 border-ink/20 cursor-pointer" />
              <span className="font-mono font-bold text-ink/60">{form.primaryColor}</span>
            </div>
          </div>
          <button onClick={saveMain} disabled={saveMutation.isPending} className="btn-coral px-6 py-3 mt-2">
            {saveMutation.isPending ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* Stampante termica */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Printer size={18} className="text-ink/60" />
          <h2 className="font-display font-black text-xl">Stampante termica</h2>
        </div>
        <p className="text-sm text-ink/50 font-semibold mb-5">Connessione ESC/POS via TCP (rete locale)</p>
        <div className="space-y-4">
          <div>
            <label className="label">Indirizzo IP stampante</label>
            <input
              className="input font-mono"
              value={printerIp}
              onChange={e => setPrinterIp(e.target.value)}
              placeholder="es. 192.168.1.100"
            />
          </div>
          <div>
            <label className="label">Porta</label>
            <input
              className="input font-mono w-32"
              type="number"
              min="1"
              max="65535"
              value={printerPort}
              onChange={e => setPrinterPort(e.target.value)}
            />
          </div>
          <button onClick={savePrinter} disabled={saveMutation.isPending} className="btn-coral px-6 py-3">
            {saveMutation.isPending ? 'Salvataggio...' : 'Salva stampante'}
          </button>
        </div>
      </div>
    </div>
  )
}
