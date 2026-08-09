// Sala — la piantina dei tavoli, live.
//
// Sul telefono la piantina è in SOLA LETTURA: si guarda e si tocca per aprire il
// dettaglio. Il drag&drop della disposizione resta un gesto da tablet in cassa
// (spostare un tavolo con un dito su uno schermo da 6" è un incidente, non una
// funzione). I tavoli senza coordinate finiscono in una griglia sotto la piantina,
// senza inventare posizioni che il ristoratore non ha scelto.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import {
  CALL_LABEL,
  ORDER_STATUS,
  TABLE_COLOR,
  TABLE_LABEL,
  isPlaced,
  type OrderRow,
  type RoomRow,
  type TableRow,
  type WaiterCallRow,
} from '../lib/domain'
import { Badge, Btn, Card, EmptyState, Sheet, Skeleton, euro, hhmm, since } from '../ui/kit'
import { Icon } from '../ui/icons'

export function SalaScreen() {
  const { api, online } = useApp()
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [flat, setFlat] = useState<TableRow[]>([])
  const [calls, setCalls] = useState<WaiterCallRow[]>([])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [open, setOpen] = useState<TableRow | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([
        api.get<RoomRow[]>('/tables/rooms'),
        api.get<TableRow[]>('/tables'),
      ])
      setRooms(r ?? [])
      setFlat(t ?? [])
    } catch {
      setRooms((prev) => prev ?? [])
    }
    try {
      setCalls(await api.get<WaiterCallRow[]>('/tables/waiter-calls?open=1') ?? [])
    } catch {
      // Chiamate cameriere: se l'appliance è vecchia la route non esiste ancora.
      setCalls([])
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  useLiveEvent('table:updated', () => { void load() })
  useLiveEvent('waiter:called', (p) => {
    setCalls((c) => [
      { id: String(p['tableId']), tableId: String(p['tableId']), tableNumber: String(p['tableNumber'] ?? ''), type: (p['type'] as WaiterCallRow['type']) ?? 'help', createdAt: new Date().toISOString() },
      ...c.filter((x) => x.tableId !== p['tableId']),
    ])
  })
  useLiveEvent('waiter:resolved', (p) => setCalls((c) => c.filter((x) => x.tableId !== p['tableId'])))

  // Sale con almeno un tavolo + le eventuali "senza sala".
  const roomTabs = useMemo(() => (rooms ?? []).filter((r) => r.tables?.length), [rooms])
  const visible = useMemo(() => {
    if (!roomId) return flat
    return flat.filter((t) => t.roomId === roomId)
  }, [flat, roomId])

  const placed = visible.filter(isPlaced)
  const unplaced = visible.filter((t) => !isPlaced(t))

  const resolveCall = async (tableId: string) => {
    setCalls((c) => c.filter((x) => x.tableId !== tableId))
    try { await api.post(`/tables/${tableId}/waiter-resolve`) } catch { void load() }
  }

  if (rooms === null) {
    return (
      <div className="ow-stack">
        <Skeleton height={44} />
        <Skeleton height={280} />
      </div>
    )
  }

  if (!flat.length) {
    return <EmptyState icon="table" title="Nessun tavolo" sub="Aggiungi i tavoli dalla dashboard: appariranno qui in tempo reale." />
  }

  return (
    <div className="ow-stack">
      {calls.length > 0 && <WaiterCalls calls={calls} onResolve={resolveCall} />}

      {roomTabs.length > 1 && (
        <div className="ow-seg-scroll">
          <button type="button" className="press ow-chip" data-on={roomId === null ? '1' : '0'} onClick={() => setRoomId(null)}>
            Tutte
          </button>
          {roomTabs.map((r) => (
            <button key={r.id} type="button" className="press ow-chip" data-on={roomId === r.id ? '1' : '0'} onClick={() => setRoomId(r.id)}>
              {r.name}
            </button>
          ))}
        </div>
      )}

      {placed.length > 0 && (
        <div className="ow-floor">
          {placed.map((t) => (
            <button
              key={t.id}
              type="button"
              className="press ow-floor-table"
              style={{ left: `${t.posX}%`, top: `${t.posY}%` }}
              onClick={() => setOpen(t)}
            >
              <span className="ow-floor-ring" style={{ borderColor: TABLE_COLOR[t.status], background: `color-mix(in srgb, ${TABLE_COLOR[t.status]} 12%, var(--raised))` }}>
                <span className="num">{t.number}</span>
              </span>
              {calls.some((c) => c.tableId === t.id) && <span className="ow-floor-bell"><Icon name="bell" size={11} stroke={2.6} /></span>}
            </button>
          ))}
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="ow-tiles">
          {unplaced.map((t) => (
            <button key={t.id} type="button" className="press ow-tile" onClick={() => setOpen(t)}>
              <span className="ow-tile-dot" style={{ background: TABLE_COLOR[t.status] }} />
              <span className="num ow-tile-num">{t.number}</span>
              <span className="ow-tile-seats">{t.seats} posti</span>
            </button>
          ))}
        </div>
      )}

      <div className="ow-legend">
        {(Object.keys(TABLE_LABEL) as TableRow['status'][]).map((s) => (
          <span key={s}><i style={{ background: TABLE_COLOR[s] }} />{TABLE_LABEL[s]}</span>
        ))}
      </div>

      <TableSheet table={open} onClose={() => setOpen(null)} online={online} onChanged={() => void load()} />
    </div>
  )
}

function WaiterCalls({ calls, onResolve }: { calls: WaiterCallRow[]; onResolve: (tableId: string) => void }) {
  return (
    <div className="ow-calls">
      <div className="ow-calls-head">
        <Icon name="bell" size={17} />
        {calls.length === 1 ? '1 chiamata cameriere' : `${calls.length} chiamate cameriere`}
      </div>
      <div className="ow-calls-body">
        {calls.map((c) => (
          <div key={c.id} className="ow-call-row">
            <span className="ow-call-tag num">{c.tableNumber ?? '—'}</span>
            <div className="ow-call-text">
              <b>{CALL_LABEL[c.type] ?? 'Chiamata'}</b>
              <span>Tavolo {c.tableNumber ?? '—'} · {since(c.createdAt)}</span>
            </div>
            <Btn size="sm" kind="soft" onClick={() => onResolve(c.tableId)}>Risolvi</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableSheet({ table, onClose, online, onChanged }: {
  table: TableRow | null
  onClose: () => void
  online: boolean
  onChanged: () => void
}) {
  const { api } = useApp()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!table) { setOrders(null); return }
    let alive = true
    api.get<OrderRow[]>(`/orders/table/${table.id}`)
      .then((o) => { if (alive) setOrders(o ?? []) })
      .catch(() => { if (alive) setOrders([]) })
    return () => { alive = false }
  }, [api, table])

  if (!table) return null

  // Solo gli ordini della visita in corso: quelli pagati/annullati sono storia.
  const live = (orders ?? []).filter((o) => o.status !== 'paid' && o.status !== 'cancelled')
  const totale = live.reduce((s, o) => s + o.total, 0)

  const setStatus = async (status: TableRow['status']) => {
    setBusy(true)
    try {
      await api.patch(`/tables/${table.id}/status`, { status })
      onChanged()
      onClose()
    } catch (e) {
      // 409 TABLE_HAS_OPEN_BILL: il tavolo ha un conto aperto. Il messaggio del
      // server è già scritto per un umano, si mostra quello.
      alert(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Tavolo ${table.number}`}
      footer={
        <>
          <Btn kind="soft" full disabled={busy || !online} onClick={() => void setStatus('free')}>Libera</Btn>
          <Btn kind="ghost" full disabled={busy || !online} onClick={() => void setStatus('cleaning')}>Da pulire</Btn>
        </>
      }
    >
      <div className="ow-sheet-meta">
        <Badge tone={table.status === 'free' ? 'ok' : table.status === 'occupied' ? 'brand' : table.status === 'waiting' ? 'wait' : 'muted'} dot>
          {TABLE_LABEL[table.status]}
        </Badge>
        <span className="ow-muted">{table.seats} posti{table.openedAt ? ` · aperto ${hhmm(table.openedAt)}` : ''}</span>
      </div>

      {orders === null && <Skeleton height={70} />}

      {orders !== null && live.length === 0 && (
        <p className="ow-muted">Nessun ordine in corso su questo tavolo.</p>
      )}

      {live.map((o) => (
        <Card key={o.id} pad={13}>
          <div className="ow-row-head">
            <b>{(o.items ?? []).reduce((s, i) => s + i.quantity, 0)} portate</b>
            <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
          </div>
          <div className="ow-row-items">
            {(o.items ?? []).map((i) => (
              <div key={i.id}><span className="num">{i.quantity}×</span> {i.name}</div>
            ))}
          </div>
          <div className="ow-row-foot">
            <span className="mono">{hhmm(o.createdAt)}</span>
            <span className="num">{euro(o.total)}</span>
          </div>
        </Card>
      ))}

      {live.length > 0 && (
        <div className="ow-row-foot ow-total-row">
          <span>Totale in corso</span>
          <span className="num">{euro(totale)}</span>
        </div>
      )}
    </Sheet>
  )
}
