// Ordini in arrivo.
//
// Un ordine nuovo compare IN CIMA senza refresh: arriva `order:new` dal socket e la
// riga entra con l'animazione della staff. La lista usa la paginazione a cursore
// (?limit=&before=) introdotta in F2.3: sul telefono si caricano 25 righe per volta,
// non tutto il servizio.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { NEXT_STATUS, ORDER_STATUS, orderTag, type OrderRow } from '../lib/domain'
import { Badge, Btn, Card, EmptyState, Skeleton, euro, hhmm, since } from '../ui/kit'

const PAGE = 25

export function OrdiniScreen() {
  const { api, online } = useApp()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Gli ordini arrivati mentre la schermata è aperta entrano con l'animazione della
  // staff: è il segnale che qualcosa è cambiato senza che tu abbia fatto nulla.
  const fresh = useRef(new Set<string>())

  const load = useCallback(async () => {
    try {
      // La busta con ?limit porta anche `meta.nextBefore`: il cursore della pagina
      // successiva viene dal server, non si ricostruisce a mano lato client.
      const page = await api.page<OrderRow[]>(`/orders/active?limit=${PAGE}`)
      setOrders(page.data ?? [])
      setNextBefore(page.meta?.nextBefore ?? null)
    } catch {
      setOrders((p) => p ?? [])
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })

  useLiveEvent('order:new', (p) => {
    const id = typeof p['orderId'] === 'string' ? p['orderId'] : null
    if (id) fresh.current.add(id)
    void load()
  })
  useLiveEvent('order:updated', () => { void load() })

  const more = async () => {
    if (!nextBefore) return
    const page = await api.page<OrderRow[]>(`/orders/active?limit=${PAGE}&before=${encodeURIComponent(nextBefore)}`)
    setOrders((prev) => [...(prev ?? []), ...(page.data ?? [])])
    setNextBefore(page.meta?.nextBefore ?? null)
  }

  const advance = async (o: OrderRow) => {
    const next = NEXT_STATUS[o.status]
    if (!next) return
    setBusy(o.id)
    // Ottimismo controllato: la riga cambia subito, ma se il server rifiuta si
    // ricarica lo stato vero. Mai inventare una transizione che il server non fa.
    setOrders((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, status: next.to } : x)))
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next.to })
    } catch {
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (orders === null) {
    return <div className="ow-stack"><Skeleton height={92} /><Skeleton height={92} /><Skeleton height={92} /></div>
  }

  if (!orders.length) {
    return <EmptyState icon="orders" title="Nessun ordine in corso" sub="Gli ordini nuovi compaiono qui da soli, senza ricaricare." />
  }

  return (
    <div className="ow-stack">
      {orders.map((o) => {
        const next = NEXT_STATUS[o.status]
        return (
          <Card key={o.id} pad={0} className={fresh.current.has(o.id) ? 'ow-new' : ''}>
            <div className="ow-ord-head" data-ready={o.status === 'ready' ? '1' : '0'}>
              <span className="ow-ord-tag num">{orderTag(o)}</span>
              <div className="ow-ord-title">
                <b>{(o.items ?? []).reduce((s, i) => s + i.quantity, 0) || 1} portate</b>
                <span className="mono">{hhmm(o.createdAt)} · {since(o.createdAt)}</span>
              </div>
              <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
            </div>
            <div className="ow-ord-body">
              {(o.items ?? []).map((i) => (
                <div key={i.id} className="ow-ord-item">
                  <span className="num">{i.quantity}×</span>
                  <span>{i.name}</span>
                  {i.notes && <em>{i.notes}</em>}
                </div>
              ))}
              <div className="ow-row-foot">
                <span className="num">{euro(o.total)}</span>
                {next && (
                  <Btn size="sm" onClick={() => void advance(o)} disabled={busy === o.id || !online}>{next.label}</Btn>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      {nextBefore && <Btn kind="ghost" full onClick={() => void more()}>Carica altri</Btn>}
    </div>
  )
}
