// Cassa — conti aperti, sconto, mancia, incasso.
//
// REGOLA NON NEGOZIABILE DI QUESTA SCHERMATA: **zero logica di calcolo nel client**.
// Il totale, il subtotale, il coperto e l'effetto di uno sconto vengono SEMPRE dalla
// risposta del server, che li ricalcola sotto advisory lock a partire dagli ordini
// reali (bills.ts). Il telefono mostra numeri, non li produce — e l'importo che invia
// a POST /payments è esattamente quello che il server gli ha appena detto.
//
// È la route più delicata del sistema: la review del 2026-07-15 ci ha già trovato tre
// P1 da doppio addebito. Qui non si "ottimizza" nulla.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import type { BillRow, OrderRow } from '../lib/domain'
import { Badge, Btn, Card, EmptyState, Sheet, Skeleton, euro, hhmm } from '../ui/kit'
import { Icon } from '../ui/icons'

type Method = 'cash' | 'card' | 'digital'

const METHODS: { id: Method; label: string; icon: string }[] = [
  { id: 'cash', label: 'Contanti', icon: 'banknote' },
  { id: 'card', label: 'Carta', icon: 'card' },
  { id: 'digital', label: 'Digitale', icon: 'smartphone' },
]

interface BillDetail extends BillRow {
  payments?: { id: string; amount: number; method: string }[]
}

export function CassaScreen() {
  const { api } = useApp()
  const [bills, setBills] = useState<BillRow[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setBills(await api.get<BillRow[]>('/bills/open') ?? [])
    } catch {
      setBills((p) => p ?? [])
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  useLiveEvent('order:new', () => { void load() })
  useLiveEvent('order:updated', () => { void load() })
  useLiveEvent('table:updated', () => { void load() })

  if (bills === null) {
    return <div className="ow-stack"><Skeleton height={104} /><Skeleton height={104} /></div>
  }

  if (!bills.length) {
    return <EmptyState icon="cassa" title="Nessun conto aperto" sub="I conti si aprono da soli quando un tavolo ordina." />
  }

  return (
    <div className="ow-stack">
      {bills.map((b) => (
        <Card key={b.id} pad={16} onClick={() => setOpenId(b.id)}>
          <div className="ow-bill-head">
            <span className="ow-bill-tag num">{b.takeaway || b.tableNumber == null ? 'ASP' : b.tableNumber}</span>
            <div className="ow-bill-title">
              <b>{b.takeaway ? (b.customerName ?? 'Asporto') : `Tavolo ${b.tableNumber ?? '—'}`}</b>
              <span className="mono">
                {b.covers ? `${b.covers} coperti · ` : ''}{hhmm(b.createdAt)}
              </span>
            </div>
          </div>
          <div className="ow-bill-foot">
            <div>
              <span className="ow-bill-label">Totale</span>
              <div className="num ow-bill-total">{euro(b.total)}</div>
            </div>
            <Btn size="sm" icon="banknote">Incassa</Btn>
          </div>
        </Card>
      ))}

      {openId && <BillSheet billId={openId} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); void load() }} />}
    </div>
  )
}

function BillSheet({ billId, onClose, onDone }: { billId: string; onClose: () => void; onDone: () => void }) {
  const { api, session, online } = useApp()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [method, setMethod] = useState<Method>('cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [discount, setDiscount] = useState('')
  const [tip, setTip] = useState('')

  // Sconto e mancia sono owner/cassiere lato server (PATCH /bills/:id). Mostrare un
  // pulsante che sappiamo già rifiutato è solo un modo elegante di far perdere tempo.
  const canDiscount = session?.user.role === 'owner' || session?.user.role === 'cassiere'

  const reload = useCallback(async () => {
    const b = await api.get<BillDetail>(`/bills/${billId}`)
    setBill(b)
    setDiscount(String(b?.discount ?? 0))
    setTip(String(b?.tip ?? 0))
    if (b?.tableId) {
      try { setOrders(await api.get<OrderRow[]>(`/orders/table/${b.tableId}`) ?? []) } catch { setOrders([]) }
    }
  }, [api, billId])

  useEffect(() => { void reload().catch(() => setError('Conto non disponibile.')) }, [reload])

  if (!bill) {
    return <Sheet open onClose={onClose} title="Conto"><Skeleton height={120} /></Sheet>
  }

  const billable = orders.filter((o) => o.status !== 'paid' && o.status !== 'cancelled')

  const applyDiscount = async () => {
    setBusy(true)
    setError(null)
    try {
      // Si invia l'INTENZIONE (sconto e mancia richiesti); il totale risultante lo
      // decide il server, che può anche limitare lo sconto (tetto del 30% al cassiere).
      const updated = await api.patch<BillDetail>(`/bills/${billId}`, {
        discount: Number(discount.replace(',', '.')) || 0,
        tip: Number(tip.replace(',', '.')) || 0,
      })
      setBill(updated)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modifica non riuscita.')
    } finally {
      setBusy(false)
    }
  }

  const incassa = async () => {
    setBusy(true)
    setError(null)
    try {
      // L'importo è quello del server, letto un attimo fa. Se nel frattempo è arrivato
      // un ordine, il server ricalcola sotto lock e il pagamento non chiude il conto:
      // si rilegge e si mostra il nuovo totale, invece di regalare la differenza.
      await api.post(`/bills/${billId}/payments`, { amount: bill.total, method })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incasso non riuscito.')
      await reload().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const title = bill.takeaway || bill.tableNumber == null ? 'Conto asporto' : `Tavolo ${bill.tableNumber}`

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <Btn full disabled={busy || !online} onClick={() => void incassa()} icon="banknote">
          {busy ? 'Incasso…' : `Incassa ${euro(bill.total)}`}
        </Btn>
      }
    >
      {!online && (
        <div className="ow-warn"><Icon name="alert" size={16} /> Appliance non raggiungibile: sola lettura.</div>
      )}

      {billable.length > 0 && (
        <Card pad={14}>
          {billable.map((o) => (
            <div key={o.id} className="ow-bill-order">
              <span className="mono">{hhmm(o.createdAt)}</span>
              <span>{(o.items ?? []).map((i) => `${i.quantity}× ${i.name}`).join(', ') || 'Ordine'}</span>
              <span className="num">{euro(o.total)}</span>
            </div>
          ))}
        </Card>
      )}

      <Card pad={14}>
        <div className="ow-kv"><span>Subtotale</span><b className="num">{euro(bill.subtotal)}</b></div>
        {!!bill.covers && <div className="ow-kv"><span>Coperti</span><b>{bill.covers}</b></div>}
        {!!bill.discount && <div className="ow-kv"><span>Sconto</span><b className="num">−{euro(bill.discount)}</b></div>}
        {!!bill.tip && <div className="ow-kv"><span>Mancia</span><b className="num">{euro(bill.tip)}</b></div>}
        <div className="ow-kv ow-kv-total"><span>Totale</span><b className="num">{euro(bill.total)}</b></div>
        {/* Il coperto non ha una colonna dedicata: è dentro `total`, calcolato dal
            server come coperti × unitario. Per questo la somma a vista può non
            tornare — ed è giusto così: il numero buono è quello del server. */}
      </Card>

      {canDiscount && !editing && (
        <Btn kind="ghost" size="sm" disabled={!online} onClick={() => setEditing(true)}>Sconto e mancia</Btn>
      )}

      {canDiscount && editing && (
        <Card pad={14}>
          <label className="ow-field-label" htmlFor="ow-disc">Sconto (€)</label>
          <input id="ow-disc" className="ow-input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <label className="ow-field-label" htmlFor="ow-tip" style={{ marginTop: 10 }}>Mancia (€)</label>
          <input id="ow-tip" className="ow-input" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
          <div className="ow-sheet-foot">
            <Btn size="sm" kind="soft" full onClick={() => setEditing(false)}>Annulla</Btn>
            <Btn size="sm" full disabled={busy} onClick={() => void applyDiscount()}>Applica</Btn>
          </div>
        </Card>
      )}

      <div className="ow-methods">
        {METHODS.map((m) => (
          <button key={m.id} type="button" className="press ow-method" data-on={method === m.id ? '1' : '0'} onClick={() => setMethod(m.id)}>
            <Icon name={m.icon} size={18} />
            {m.label}
          </button>
        ))}
      </div>

      {bill.payments && bill.payments.length > 0 && (
        <Badge tone="ok" dot>{bill.payments.length} pagamento{bill.payments.length > 1 ? 'i' : ''} già registrato</Badge>
      )}

      {error && <div className="ow-enroll-err">{error}</div>}
    </Sheet>
  )
}
