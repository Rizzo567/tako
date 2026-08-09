// Magazzino — giacenze, alert, riordino, e i movimenti registrati col pollice.
//
// Il vincolo che ha disegnato questa schermata è uno solo (piano §5 F4.1): un
// movimento in NON PIÙ di 4 tap, contati dall'apertura dell'app. Il conto:
//
//   1. «Altro»   2. «Magazzino»   3. la riga dell'articolo   4. Carico/Scarico/Spreco
//
// Da qui discendono tre scelte:
//   • la quantità NON si digita: il foglio si apre con 1 già impostato e i tasti
//     −/+ per correggerla. Una tastiera numerica costerebbe il quarto tap prima
//     ancora di aver scelto il tipo di movimento;
//   • i tre tasti del foglio SONO il movimento: scegliere il tipo lo registra, non
//     lo prepara. Nessun «Conferma» finale;
//   • la lista si apre su «Da riordinare», che è il motivo per cui un ristoratore
//     apre il magazzino dal telefono — non su tutti gli articoli in ordine alfabetico.
//
// La giacenza non si scrive mai a mano: passa sempre dal ledger dei movimenti
// (routes/inventory.ts), che è anche ciò che alimenta consumo e giorni-alla-rottura.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { Badge, Btn, Card, EmptyState, SectionTitle, Skeleton, StatTile, euro } from '../ui/kit'
import { Icon } from '../ui/icons'

interface StatItem {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  value: number
  used30: number
  perDay: number
  daysLeft: number | null
}

interface InventoryStats {
  totalValue: number
  itemCount: number
  lowCount: number
  outCount: number
  perItem: StatItem[]
}

interface ReorderItem {
  id: string
  name: string
  unit: string
  quantity: number
  suggested: number
  estCost: number | null
}

interface Reorder {
  suppliers: { supplier: string; items: ReorderItem[] }[]
  itemCount: number
  estTotalCost: number
}

type MoveType = 'load' | 'unload' | 'waste'

const MOVE_LABEL: Record<MoveType, string> = { load: 'Carico', unload: 'Scarico', waste: 'Spreco' }

/** Numero corto: 2 decimali solo quando servono davvero (12 e non 12,00). */
function qty(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

export function MagazzinoScreen() {
  const { api } = useApp()
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [reorder, setReorder] = useState<Reorder | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<'alert' | 'tutti'>('alert')
  const [open, setOpen] = useState<StatItem | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api.get<InventoryStats>('/inventory/stats'),
        api.get<Reorder>('/inventory/reorder'),
      ])
      setStats(s)
      setReorder(r)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  useLiveEvent('inventory:alert', () => { void load() })

  if (!stats && failed) {
    return <EmptyState icon="box" title="Magazzino non disponibile" sub="L'appliance non risponde: riprova quando torni in sala." />
  }

  if (!stats || !reorder) {
    return (
      <div className="ow-stack">
        <div className="ow-grid-2"><Skeleton height={108} /><Skeleton height={108} /></div>
        <Skeleton height={220} />
      </div>
    )
  }

  const low = stats.perItem.filter((i) => i.quantity <= i.minQuantity)
  const list = tab === 'alert' ? low : stats.perItem
  const suggestedFor = new Map<string, number>()
  for (const s of reorder.suppliers) for (const i of s.items) suggestedFor.set(i.id, i.suggested)

  return (
    <div className="ow-stack">
      <div className="ow-grid-2">
        <StatTile label="Valore a magazzino" value={euro(stats.totalValue)} icon="coins" sub={`${stats.itemCount} articoli`} />
        <StatTile
          label="Sotto scorta"
          value={String(stats.lowCount + stats.outCount)}
          icon="alert"
          accent={stats.outCount > 0 ? 'var(--danger)' : 'var(--wait)'}
          sub={stats.outCount > 0 ? `${stats.outCount} esauriti` : 'nessun esaurito'}
          subTone={stats.outCount > 0 ? 'danger' : 'muted'}
        />
      </div>

      <div className="ow-seg-scroll">
        <button type="button" className="press ow-chip" data-on={tab === 'alert' ? '1' : '0'} onClick={() => setTab('alert')}>
          Da riordinare {low.length > 0 && `· ${low.length}`}
        </button>
        <button type="button" className="press ow-chip" data-on={tab === 'tutti' ? '1' : '0'} onClick={() => setTab('tutti')}>
          Tutti · {stats.perItem.length}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'alert' ? 'check' : 'box'}
          title={tab === 'alert' ? 'Nessuna scorta sotto minimo' : 'Magazzino vuoto'}
          sub={tab === 'alert' ? 'Tutti gli articoli sono sopra la soglia che hai impostato.' : 'Gli articoli si creano dalla dashboard, anche da una foto della lista.'}
        />
      ) : (
        <Card pad={0}>
          {list.map((i) => {
            const out = i.quantity <= 0
            const under = i.quantity <= i.minQuantity
            return (
              <button key={i.id} type="button" className="press ow-inv-row" onClick={() => setOpen(i)}>
                <span className="ow-inv-main">
                  <span className="ow-inv-name">{i.name}</span>
                  <span className="ow-inv-sub">
                    min {qty(i.minQuantity)} {i.unit}
                    {i.daysLeft != null && ` · ~${qty(i.daysLeft)} gg`}
                  </span>
                </span>
                <span className="ow-inv-right">
                  <span className="num ow-inv-qty" data-tone={out ? 'danger' : under ? 'wait' : 'ok'}>
                    {qty(i.quantity)} <small>{i.unit}</small>
                  </span>
                  {under && <Badge tone={out ? 'danger' : 'wait'}>{out ? 'esaurito' : 'sotto scorta'}</Badge>}
                </span>
              </button>
            )
          })}
        </Card>
      )}

      {reorder.suppliers.length > 0 && (
        <Card pad={16}>
          <SectionTitle right={<Badge tone="info">{euro(reorder.estTotalCost)}</Badge>}>Lista di riordino</SectionTitle>
          <p className="ow-muted">Quanto ordinare per tornare al livello che hai deciso, diviso per fornitore.</p>
          {reorder.suppliers.map((s) => (
            <div key={s.supplier} className="ow-sup">
              <div className="ow-sup-head"><Icon name="truck" size={15} /><b>{s.supplier}</b></div>
              {s.items.map((i) => (
                <div key={i.id} className="ow-kv">
                  <span>{i.name}</span>
                  <b className="num">{qty(i.suggested)} {i.unit}</b>
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}

      {open && (
        <MovimentoSheet
          item={open}
          suggested={suggestedFor.get(open.id) ?? null}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); void load() }}
        />
      )}
    </div>
  )
}

/**
 * Il foglio del movimento. Si apre con quantità 1 (o la quantità suggerita dal
 * riordino, quando c'è: è il numero che il ristoratore sta per ordinare davvero) e
 * i tre tasti IN FONDO registrano subito. Nessun passaggio intermedio.
 */
function MovimentoSheet({ item, suggested, onClose, onDone }: {
  item: StatItem
  suggested: number | null
  onClose: () => void
  onDone: () => void
}) {
  const { api } = useApp()
  const [n, setN] = useState<number>(suggested && suggested > 0 ? suggested : 1)
  const [busy, setBusy] = useState<MoveType | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const step = (d: number) => setN((v) => Math.max(0.01, Math.round((v + d) * 100) / 100))

  const submit = async (type: MoveType) => {
    if (busy) return
    setBusy(type)
    setErr(null)
    try {
      await api.post(`/inventory/${item.id}/movements`, { type, quantity: n })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Movimento non registrato')
      setBusy(null)
    }
  }

  // Il foglio è scritto a mano invece di riusare <Sheet>: i tre tasti devono stare
  // nel piede, e il piede deve poter mostrare l'errore senza far saltare il layout.
  return (
    <div className="ow-sheet-wrap" onClick={onClose}>
      <div className="ow-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Movimento ${item.name}`}>
        <div className="ow-sheet-grip" />
        <div className="ow-sheet-head">
          <h2>{item.name}</h2>
          <button type="button" className="press ow-icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="ow-sheet-body">
          <div className="ow-kv">
            <span>Giacenza attuale</span>
            <b className="num">{qty(item.quantity)} {item.unit}</b>
          </div>
          <div className="ow-kv">
            <span>Scorta minima</span>
            <b className="num">{qty(item.minQuantity)} {item.unit}</b>
          </div>

          <div className="ow-step">
            <button type="button" className="press ow-step-btn" onClick={() => step(-1)} aria-label="Meno uno">
              <Icon name="minus" size={20} stroke={2.6} />
            </button>
            <div className="ow-step-val">
              <span className="num">{qty(n)}</span>
              <small>{item.unit}</small>
            </div>
            <button type="button" className="press ow-step-btn" onClick={() => step(1)} aria-label="Più uno">
              <Icon name="plus" size={20} stroke={2.6} />
            </button>
          </div>

          {err && <div className="ow-enroll-err">{err}</div>}
        </div>
        <div className="ow-sheet-foot ow-move-foot">
          {(['load', 'unload', 'waste'] as MoveType[]).map((t) => (
            <Btn
              key={t}
              kind={t === 'load' ? 'ok' : t === 'unload' ? 'soft' : 'danger'}
              size="md"
              full
              disabled={busy !== null}
              onClick={() => void submit(t)}
            >
              {busy === t ? '…' : MOVE_LABEL[t]}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  )
}
