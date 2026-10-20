'use client'
import { TakoLoading } from './TakoLoading'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

type BookingTable = { id: string; number: string; seats: number; shape: string; posX: number | null; posY: number | null; available: boolean }
type BookingRoom = { id: string; name: string; tables: BookingTable[] }

const tableAsset = (table: BookingTable) => `/staff/assets/tables/${table.shape === 'round' ? (table.seats <= 2 ? 'round-2' : 'booking-round-4') : table.shape === 'square' ? 'square-4' : table.seats > 6 ? 'rect-8' : 'rect-6'}.png`

const hasPosition = (table: BookingTable): table is BookingTable & { posX: number; posY: number } => typeof table.posX === 'number' && typeof table.posY === 'number' && Number.isFinite(table.posX) && Number.isFinite(table.posY)

// Form pubblico di prenotazione. Legge dal menu i flag (nome ristorante +
// reservationsEnabled), poi invia a POST /customer/restaurant/:id/reservation.
// La prenotazione arriva come 'requested' e l'owner la conferma dalla dashboard.
export function ReservationForm({ restaurantId }: { restaurantId: string }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail,setCustomerEmail]=useState('')
  const [reminderConsent,setReminderConsent]=useState(false)
  const [partySize, setPartySize] = useState(2)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('20:00')
  const [notes, setNotes] = useState('')
  const [rooms, setRooms] = useState<BookingRoom[]>([])
  const [roomId, setRoomId] = useState('')
  const [tableId, setTableId] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(false)
  const [availabilityKey, setAvailabilityKey] = useState('')
  const requestKey = `${restaurantId}:${date}:${time}:${partySize}`
  const [availabilityRevision, setAvailabilityRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setAvailabilityKey('')
    setTableId('')
    setRooms([])
    setAvailabilityError(false)
    if (!enabled || !date || !time || partySize < 1) return () => controller.abort()
    setAvailabilityLoading(true)
    api.get(`/customer/restaurant/${restaurantId}/reservation-availability`, {
      params: { date, time, partySize }, signal: controller.signal,
    }).then(response => {
      if (controller.signal.aborted) return
      const data = response.data?.data
      if (!data || !Array.isArray(data.rooms)) throw new Error('Invalid availability')
      setAvailabilityKey(`${restaurantId}:${date}:${time}:${partySize}`)
      setRooms(data.rooms)
      setRoomId(previous => data.rooms.some((room: BookingRoom) => room.id === previous) ? previous : data.rooms[0]?.id || '')
    }).catch(() => {
      if (!controller.signal.aborted) setAvailabilityError(true)
    }).finally(() => {
      if (!controller.signal.aborted) setAvailabilityLoading(false)
    })
    return () => controller.abort()
  }, [restaurantId, enabled, date, time, partySize, availabilityRevision])

  const room = rooms.find(item => item.id === roomId)
  const selectedTable = rooms.flatMap(item => item.tables).find(table => table.id === tableId && table.available)


  useEffect(() => {
    api.get(`/customer/restaurant/${restaurantId}/reservation-info`)
      .then(r => { setName(r.data.data?.restaurantName || ''); setEnabled(r.data.data?.reservationsEnabled === true) })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false))
  }, [restaurantId])

  const submit = async () => {
    setErr('')
    if (!customerName.trim() || !customerPhone.trim() || !date || !time || partySize < 1) {
      setErr(t('resvValidation'))
      return
    }
    if (availabilityLoading || availabilityError || availabilityKey !== requestKey) {
      setErr(t('resvAvailabilityError'))
      return
    }
    if (tableId && !selectedTable) {
      setErr(t('resvSelectTableAgain'))
      return
    }
    setBusy(true)
    try {
      await api.post(`/customer/restaurant/${restaurantId}/reservation`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        customerEmail:customerEmail.trim()||undefined,reminderConsent,
        partySize: Number(partySize), date, time, tableId: tableId || undefined, notes: notes.trim() || undefined,
      })
      setDone(true)
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setAvailabilityKey('')
        setTableId('')
        setAvailabilityRevision(value => value + 1)
        setErr(t('resvSelectTableAgain'))
      } else setErr(e?.response?.data?.error?.message || t('resvError'))
    } finally { setBusy(false) }
  }

  const field = 'w-full rounded-xl border border-[var(--hairline,#e5e5e5)] bg-[var(--sunken,#f6f3ec)] px-3.5 py-3 text-[15px] text-[var(--ink,#2a1f1a)] outline-none focus:border-[var(--brand,#1d1d1f)]'

  if (loading) return <TakoLoading label={t('loading')} variant="screen"/>

  if (!enabled) return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <div className="text-5xl">📅</div>
        <h1 className="mt-4 text-xl font-bold text-[var(--ink,#2a1f1a)]">{t('resvDisabledTitle')}</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-2,#666)]">{t('resvDisabledBody')}</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-bold text-[var(--ink,#2a1f1a)]">{t('resvDoneTitle')}</h1>
        <p className="mt-2 text-[15px] font-semibold text-[var(--ink,#2a1f1a)]">
          {partySize} {partySize === 1 ? t('person') : t('people')} · {date} · {time}
        </p>
        <p className="mt-2 text-[15px] text-[var(--ink-2,#666)]">{t('resvDoneBody')}</p>
      </div>
    </div>
  )

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <h1 className="text-2xl font-extrabold text-[var(--ink,#2a1f1a)]">{t('resvTitle')}</h1>
      {name && <p className="mt-1 text-[15px] text-[var(--ink-2,#666)]">{name}</p>}

      <div className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvName')}</span>
          <input className={field} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('resvNamePh')} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvPhone')}</span>
          <input className={field} type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder={t('resvPhonePh')} />
        </label>
        <label className="flex flex-col gap-1.5"><span>Email (opzionale)</span><input className={field} type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={reminderConsent} onChange={e=>setReminderConsent(e.target.checked)}/>Acconsento a ricevere il promemoria di questa prenotazione via email.</label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvParty')}</span>
            <input className={field} type="number" min={1} max={40} disabled={busy} value={partySize} onChange={e => setPartySize(parseInt(e.target.value) || 1)} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvTime')}</span>
            <input className={field} type="time" disabled={busy} value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvDate')}</span>
          <input className={field} type="date" disabled={busy} value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <section aria-labelledby="booking-table-title" aria-busy={availabilityLoading} className="rounded-2xl border border-[var(--hairline,#e5e5e5)] p-4">
          <h2 id="booking-table-title" className="font-bold">{t('resvChooseTable')}</h2>
          <p className="mt-1 text-sm text-[var(--ink-2,#666)]">{t('resvTableHint')}</p>
          <div aria-live="polite" className="mt-3">
            {!date || !time ? <p className="text-sm">{t('resvChooseDateFirst')}</p> : availabilityLoading ? <TakoLoading label={t('loading')} variant="compact"/> : availabilityError ? (
              <div role="alert"><p className="text-sm text-red-600">{t('resvAvailabilityError')}</p><button type="button" className="mt-2 underline" onClick={() => setAvailabilityRevision(value => value + 1)}>{t('resvRetry')}</button></div>
            ) : rooms.length === 0 ? <p className="text-sm">{t('resvAutoTable')}</p> : <>
              <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('resvRooms')}>
                {rooms.map(item => <button key={item.id} type="button" aria-pressed={roomId === item.id} onClick={() => setRoomId(item.id)} className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${roomId === item.id ? 'bg-[var(--brand,#ED7159)] text-white' : ''}`}>{item.name}</button>)}
              </div>
              <div className="relative h-[340px] overflow-auto rounded-xl border border-dashed border-[var(--hairline,#ddd)] bg-[#f5f0e6]" role="group" aria-label={room?.name}>
                {room?.tables.filter(hasPosition).map(table => <button key={table.id} type="button" disabled={!table.available || busy} aria-pressed={tableId === table.id} aria-label={`${t('resvTable')} ${table.number}, ${table.seats} ${t('people')}, ${table.available ? t('resvAvailable') : t('resvUnavailable')}`} onClick={() => setTableId(table.id)} style={{ position: 'absolute', left: `calc(40px + (100% - 80px) * ${table.posX / 100})`, top: `calc(40px + (100% - 80px) * ${table.posY / 100})`, transform: 'translate(-50%, -50%)', width: 80, minHeight: 80 }} className={`rounded-xl p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${tableId === table.id ? 'ring-2 ring-[var(--brand,#ED7159)] bg-white' : ''}`}>
                  <img src={tableAsset(table)} alt="" className="mx-auto h-14 w-16 object-contain"/>
                  <span className="block rounded bg-white/90 px-1 text-xs font-semibold">{t('resvTable')} {table.number} · {table.seats}</span>
                </button>)}
              </div>
              {!!room?.tables.some(table => !hasPosition(table)) && <div className="mt-3">
                <h3 className="text-sm font-semibold">{t('resvUnpositionedTables')}</h3>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('resvUnpositionedTables')}>
                  {room.tables.filter(table => !hasPosition(table)).map(table => <button key={table.id} type="button" disabled={!table.available || busy} aria-pressed={tableId === table.id} aria-label={`${t('resvTable')} ${table.number}, ${table.seats} ${t('people')}, ${table.available ? t('resvAvailable') : t('resvUnavailable')}`} onClick={() => setTableId(table.id)} className={`rounded-xl border p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${tableId === table.id ? 'ring-2 ring-[var(--brand,#ED7159)]' : ''}`}>
                    <img src={tableAsset(table)} alt="" className="mx-auto h-14 w-16 object-contain"/>
                    <span>{t('resvTable')} {table.number} · {table.seats}</span>
                  </button>)}
                </div>
              </div>}
              {room?.tables.length === 0 && <p className="mt-2 text-sm">{t('resvNoTables')}</p>}
              <p className="mt-3 text-sm" role="status">{selectedTable ? `${t('resvTable')} ${selectedTable.number} · ${rooms.find(item => item.tables.some(table => table.id === tableId))?.name}` : t('resvAutoTable')}</p>
              {tableId && <button type="button" className="mt-2 text-sm underline" onClick={() => setTableId('')}>{t('resvClearTable')}</button>}
            </>}
          </div>
        </section>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--ink-2,#666)]">{t('resvNotes')}</span>
          <textarea className={field} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('resvNotesPh')} />
        </label>

        {err && <p className="text-[14px] font-medium text-red-600">{err}</p>}

        <button onClick={submit} disabled={busy || availabilityLoading || availabilityError || availabilityKey !== requestKey}
          className="mt-2 rounded-xl bg-[var(--brand,#ED7159)] py-3.5 text-[16px] font-bold text-white disabled:opacity-50">
          {busy ? <TakoLoading label={t('sending')} variant="compact"/> : t('resvSubmit')}
        </button>

        {/* Consenso privacy discreto: linka all'informativa (nuova scheda per non perdere il form). */}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer"
          className="mt-1 text-center text-[12px] leading-snug text-[var(--ink-3,#999)] underline decoration-[var(--hairline,#e5e5e5)] underline-offset-2">
          {t('privacyConsent')}
        </Link>
      </div>
    </div>
  )
}
