// Prenotazioni — la sera che sta per cominciare, in una schermata.
//
// Il piano (§5 F5.2) chiede quattro cose: vedere oggi e domani, crearne una,
// assegnare un tavolo, marcare `seated` / `no_show`. Le rotte esistono già tutte
// (routes/reservations.ts) e non cambiano. Le scelte che contano sono di forma:
//
//  • **La lista è ordinata per ora e l'ora è il numero grande.** Chi guarda questa
//    schermata sta cercando "chi arriva adesso", non un nome.
//  • **«Arrivati» e «Non presentato» sono i due tasti del foglio**, in cima e larghi:
//    sono i due gesti che si fanno cinquanta volte a sera, in piedi, con una mano.
//    Tutto il resto (conferma, tavolo, annulla, elimina) sta sotto.
//  • **Il tavolo si assegna scegliendolo da una griglia**, non digitando un numero:
//    il server rifiuta con 409 se quel tavolo è già preso in quella fascia, e il
//    messaggio va mostrato così com'è invece di essere tradotto in "errore".
//  • **La creazione chiede solo il minimo che il server pretende** — nome, telefono,
//    persone, ora — perché una prenotazione si prende al telefono mentre si fa
//    altro. Le note sono l'unico campo facoltativo che vale il suo posto.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { Badge, Btn, Card, EmptyState, SectionTitle, Skeleton, type Tone } from '../ui/kit'
import { Icon } from '../ui/icons'

type Status = 'requested' | 'confirmed' | 'seated' | 'no_show' | 'cancelled'

interface Reservation {
  id: string
  customerName: string
  customerPhone: string
  partySize: number
  startsAt: string
  durationMin: number
  status: Status
  tableId: string | null
  tableNumber: string | null
  notes: string | null
}

interface Table {
  id: string
  number: string
  seats: number
  roomId: string | null
}

const STATUS_LABEL: Record<Status, string> = {
  requested: 'da confermare',
  confirmed: 'confermata',
  seated: 'arrivati',
  no_show: 'non presentati',
  cancelled: 'annullata',
}

const STATUS_TONE: Record<Status, Tone> = {
  requested: 'wait',
  confirmed: 'info',
  seated: 'ok',
  no_show: 'danger',
  cancelled: 'muted',
}

/** Chiave giorno nel fuso del telefono: è lo stesso formato che vuole `?date=`. */
function dayKey(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PrenotazioniScreen() {
  const { api } = useApp()
  const [day, setDay] = useState(0) // 0 = oggi, 1 = domani
  const [rows, setRows] = useState<Reservation[] | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Reservation | null>(null)
  const [creating, setCreating] = useState(false)

  const date = dayKey(day)

  const load = useCallback(async () => {
    try {
      const [list, tb] = await Promise.all([
        api.get<Reservation[]>(`/reservations?date=${date}`),
        api.get<Table[]>('/tables'),
      ])
      setRows(list)
      setTables(tb)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [api, date])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  // Un'altra prenotazione presa dalla dashboard, dal cliente o dall'assistente:
  // la sera cambia sotto le mani e la lista deve seguirla senza un pull-to-refresh.
  useLiveEvent('reservation:changed', () => { void load() })

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      attese: list.filter((r) => r.status === 'requested' || r.status === 'confirmed').length,
      coperti: list.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0),
    }
  }, [rows])

  if (!rows && failed) {
    return <EmptyState icon="clock" title="Prenotazioni non disponibili" sub="L'appliance non risponde: riprova quando torni in sala." />
  }
  if (!rows) {
    return <div className="ow-stack"><Skeleton height={44} /><Skeleton height={220} /></div>
  }

  return (
    <div className="ow-stack">
      <div className="ow-seg-scroll">
        <button type="button" className="press ow-chip" data-on={day === 0 ? '1' : '0'} onClick={() => setDay(0)}>Oggi</button>
        <button type="button" className="press ow-chip" data-on={day === 1 ? '1' : '0'} onClick={() => setDay(1)}>Domani</button>
        <span className="ow-resv-count">{counts.attese} attese · {counts.coperti} coperti</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          title={day === 0 ? 'Nessuna prenotazione per oggi' : 'Nessuna prenotazione per domani'}
          sub="Quelle che prendi al telefono le aggiungi da qui."
          action={<Btn kind="brand" icon="plus" act="new" onClick={() => setCreating(true)}>Nuova prenotazione</Btn>}
        />
      ) : (
        <Card pad={0}>
          {rows.map((r) => (
            <button key={r.id} type="button" className="press ow-resv-row" data-status={r.status} onClick={() => setOpen(r)}>
              <span className="num ow-resv-time">{clock(r.startsAt)}</span>
              <span className="ow-resv-main">
                <span className="ow-resv-name">{r.customerName}</span>
                <span className="ow-resv-sub">
                  {r.partySize} {r.partySize === 1 ? 'persona' : 'persone'}
                  {r.tableNumber ? ` · tavolo ${r.tableNumber}` : ' · senza tavolo'}
                </span>
              </span>
              <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </button>
          ))}
        </Card>
      )}

      {rows.length > 0 && (
        <Btn kind="brand" icon="plus" full act="new" onClick={() => setCreating(true)}>Nuova prenotazione</Btn>
      )}

      {open && (
        <DettaglioSheet
          resv={open}
          tables={tables}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); void load() }}
        />
      )}
      {creating && (
        <NuovaSheet
          date={date}
          tables={tables}
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); void load() }}
        />
      )}
    </div>
  )
}

/**
 * Il foglio di una prenotazione. In cima i due gesti della sera; sotto il resto.
 * Ogni azione è una PATCH mirata (`/status`, `/table`): il server ricontrolla
 * l'anti-overbooking a ogni assegnazione e può rispondere 409 — quel messaggio si
 * mostra parola per parola, perché dice esattamente qual è il problema.
 */
function DettaglioSheet({ resv, tables, onClose, onDone }: {
  resv: Reservation
  tables: Table[]
  onClose: () => void
  onDone: () => void
}) {
  const { api } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(key)
    setErr(null)
    try {
      await fn()
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita')
      setBusy(null)
    }
  }

  const setStatus = (status: Status) => run(status, () => api.patch(`/reservations/${resv.id}/status`, { status }))
  const setTable = (tableId: string | null) => run('table', () => api.patch(`/reservations/${resv.id}/table`, { tableId }))

  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Prenotazione ${resv.customerName}`}>
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>{resv.customerName}</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">
          <div className="ow-kv"><span>Ora</span><b className="num">{clock(resv.startsAt)}</b></div>
          <div className="ow-kv"><span>Persone</span><b className="num">{resv.partySize}</b></div>
          <div className="ow-kv"><span>Telefono</span><b>{resv.customerPhone}</b></div>
          <div className="ow-kv"><span>Tavolo</span><b>{resv.tableNumber ?? 'non assegnato'}</b></div>
          {resv.notes && <div className="ow-kv"><span>Note</span><b>{resv.notes}</b></div>}

          {/* I due gesti della sera, grandi e in cima. */}
          <div className="ow-resv-acts">
            <button
              type="button"
              className="press ow-btn ow-btn-ok ow-btn-lg ow-resv-act"
              data-act="seated"
              disabled={!!busy || resv.status === 'seated'}
              onClick={() => void setStatus('seated')}
            >
              <Icon name="check" size={18} stroke={2.4} />
              {resv.status === 'seated' ? 'Già arrivati' : 'Arrivati'}
            </button>
            <button
              type="button"
              className="press ow-btn ow-btn-soft ow-btn-lg ow-resv-act"
              data-act="no_show"
              disabled={!!busy || resv.status === 'no_show'}
              onClick={() => void setStatus('no_show')}
            >
              <Icon name="x" size={18} stroke={2.4} />
              Non presentati
            </button>
          </div>

          {assigning ? (
            <>
              <SectionTitle>Assegna un tavolo</SectionTitle>
              <div className="ow-resv-tables">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="press ow-resv-table"
                    data-on={t.id === resv.tableId ? '1' : '0'}
                    disabled={!!busy}
                    onClick={() => void setTable(t.id)}
                  >
                    <span className="num">{t.number}</span>
                    <small>{t.seats} p.</small>
                  </button>
                ))}
              </div>
              {resv.tableId && (
                <Btn kind="ghost" size="sm" act="unassign" onClick={() => void setTable(null)}>Togli il tavolo</Btn>
              )}
            </>
          ) : (
            <div className="ow-row-btns">
              <Btn kind="soft" size="sm" icon="table" act="assign" onClick={() => setAssigning(true)}>
                {resv.tableId ? 'Cambia tavolo' : 'Assegna tavolo'}
              </Btn>
              {resv.status === 'requested' && (
                <Btn kind="soft" size="sm" icon="check" act="confirm" onClick={() => void setStatus('confirmed')}>Conferma</Btn>
              )}
              {resv.status !== 'cancelled' && (
                <Btn kind="ghost" size="sm" act="cancel" onClick={() => void setStatus('cancelled')}>Annulla prenotazione</Btn>
              )}
              <Btn kind="ghost" size="sm" icon="trash" act="delete" onClick={() => void run('del', () => api.del(`/reservations/${resv.id}`))}>Elimina</Btn>
            </div>
          )}

          {err && <div className="ow-warn" style={{ marginTop: 12 }}><Icon name="alert" size={16} />{err}</div>}
        </div>
      </div>
    </div>
  )
}

/** Nuova prenotazione: i quattro campi che il server pretende, più le note. */
function NuovaSheet({ date, tables, onClose, onDone }: {
  date: string
  tables: Table[]
  onClose: () => void
  onDone: () => void
}) {
  const { api } = useApp()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [party, setParty] = useState(2)
  const [time, setTime] = useState('20:00')
  const [tableId, setTableId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      // L'orario si compone dalla data della schermata + l'ora scelta, e si manda in
      // ISO: `new Date('2026-08-09T20:00')` è interpretato nel fuso del TELEFONO, che
      // è quello del ristorante — è la stessa lettura che fa la dashboard.
      const startsAt = new Date(`${date}T${time}:00`).toISOString()
      await api.post('/reservations', {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        partySize: party,
        startsAt,
        ...(tableId ? { tableId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Prenotazione non salvata')
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0 && phone.trim().length > 0

  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nuova prenotazione">
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>Nuova prenotazione</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">
          <label className="ow-field-label" htmlFor="rs-name">Nome</label>
          <input id="rs-name" className="ow-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chi prenota" autoComplete="off" />

          <label className="ow-field-label" htmlFor="rs-phone" style={{ marginTop: 12 }}>Telefono</label>
          <input id="rs-phone" className="ow-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39…" inputMode="tel" />

          <div className="ow-resv-grid">
            <div>
              <span className="ow-field-label">Persone</span>
              <div className="ow-step">
                <button type="button" className="press ow-step-btn" onClick={() => setParty((v) => Math.max(1, v - 1))} aria-label="Una persona in meno">
                  <Icon name="minus" size={20} stroke={2.6} />
                </button>
                <div className="ow-step-val"><span className="num">{party}</span></div>
                <button type="button" className="press ow-step-btn" onClick={() => setParty((v) => v + 1)} aria-label="Una persona in più">
                  <Icon name="plus" size={20} stroke={2.6} />
                </button>
              </div>
            </div>
            <div>
              <label className="ow-field-label" htmlFor="rs-time">Ora</label>
              <input id="rs-time" className="ow-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <span className="ow-field-label" style={{ marginTop: 12 }}>Tavolo (facoltativo)</span>
          <div className="ow-resv-tables">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                className="press ow-resv-table"
                data-on={t.id === tableId ? '1' : '0'}
                onClick={() => setTableId((v) => (v === t.id ? null : t.id))}
              >
                <span className="num">{t.number}</span>
                <small>{t.seats} p.</small>
              </button>
            ))}
          </div>

          <label className="ow-field-label" htmlFor="rs-notes" style={{ marginTop: 12 }}>Note</label>
          <input id="rs-notes" className="ow-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seggiolone, allergie…" />

          {err && <div className="ow-warn" style={{ marginTop: 12 }}><Icon name="alert" size={16} />{err}</div>}
        </div>
        <div className="ow-sheet-foot">
          <div className="ow-row-btns">
            <Btn kind="brand" size="lg" icon="check" act="save" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? 'Salvo…' : 'Salva prenotazione'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
