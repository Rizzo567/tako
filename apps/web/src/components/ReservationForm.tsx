'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// Form pubblico di prenotazione. Legge dal menu i flag (nome ristorante +
// reservationsEnabled), poi invia a POST /customer/restaurant/:id/reservation.
// La prenotazione arriva come 'requested' e l'owner la conferma dalla dashboard.
export function ReservationForm({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('20:00')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    api.get(`/customer/restaurant/${restaurantId}/menu`)
      .then(r => { setName(r.data.features?.restaurantName || ''); setEnabled(r.data.features?.reservationsEnabled === true) })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false))
  }, [restaurantId])

  const submit = async () => {
    setErr('')
    if (!customerName.trim() || !customerPhone.trim() || !date || !time || partySize < 1) {
      setErr('Compila nome, telefono, persone, data e ora.')
      return
    }
    setBusy(true)
    try {
      await api.post(`/customer/restaurant/${restaurantId}/reservation`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        partySize: Number(partySize), date, time, notes: notes.trim() || undefined,
      })
      setDone(true)
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || 'Invio non riuscito, riprova.')
    } finally { setBusy(false) }
  }

  const field = 'w-full rounded-xl border border-[var(--hairline,#e5e5e5)] bg-[var(--sunken,#f6f3ec)] px-3.5 py-3 text-[15px] text-[var(--ink,#2a1f1a)] outline-none focus:border-[var(--brand,#ED7159)]'

  if (loading) return <div className="grid min-h-dvh place-items-center text-[var(--ink-3,#999)]">Carico…</div>

  if (!enabled) return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <div className="text-5xl">📅</div>
        <h1 className="mt-4 text-xl font-bold text-[var(--ink,#2a1f1a)]">Prenotazioni non disponibili</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-2,#666)]">Questo ristorante non accetta prenotazioni online. Contattalo direttamente.</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-bold text-[var(--ink,#2a1f1a)]">Richiesta inviata!</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-2,#666)]">Abbiamo ricevuto la tua richiesta per {partySize} {partySize === 1 ? 'persona' : 'persone'} il {date} alle {time}. Il ristorante confermerà a breve.</p>
      </div>
    </div>
  )

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <h1 className="text-2xl font-extrabold text-[var(--ink,#2a1f1a)]">Prenota un tavolo</h1>
      {name && <p className="mt-1 text-[15px] text-[var(--ink-2,#666)]">{name}</p>}

      <div className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Nome</span>
          <input className={field} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Il tuo nome" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Telefono</span>
          <input className={field} type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Per confermare" />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Persone</span>
            <input className={field} type="number" min={1} max={40} value={partySize} onChange={e => setPartySize(parseInt(e.target.value) || 1)} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Ora</span>
            <input className={field} type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Data</span>
          <input className={field} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">Note (opzionale)</span>
          <textarea className={field} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergie, seggiolone, occasione…" />
        </label>

        {err && <p className="text-[14px] font-medium text-red-600">{err}</p>}

        <button onClick={submit} disabled={busy}
          className="mt-2 rounded-xl bg-[var(--brand,#ED7159)] py-3.5 text-[16px] font-bold text-white disabled:opacity-50">
          {busy ? 'Invio…' : 'Invia richiesta'}
        </button>
      </div>
    </div>
  )
}
