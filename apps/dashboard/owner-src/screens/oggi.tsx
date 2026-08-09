// Oggi — quanto ha fatto il locale oggi.
//
// "Oggi" è la giornata DEL RISTORANTE, non del telefono: il confine di mezzanotte
// lo decide il server con restaurantTimezone() (lib/billing.ts). Qui non si chiama
// mai `new Date()` per definire un giorno — se il ristoratore è in viaggio con il
// telefono su un altro fuso, i numeri devono restare quelli del suo locale.
//
// La MANCIA non è ricavo: è pass-through allo staff, quindi il server la esclude da
// incasso e ticket medio (bills.ts) e qui resta nel suo riquadro, separata.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent, useLiveReload } from '../lib/live'
import { Card, EmptyState, SectionTitle, Skeleton, StatTile, euro } from '../ui/kit'

interface TodaySummary {
  revenue: number
  tips: number
  billsCount: number
  avgTicket: number
}

interface DashboardStats {
  pendingOrdersCount: number
  totalCovers: number
  topItems: { name: string; qty: number; revenue: number }[]
}

export function OggiScreen() {
  const { api } = useApp()
  const [today, setToday] = useState<TodaySummary | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      // Le due letture arrivano dalla stessa fonte di verità sul fuso: bills.ts e
      // stats.ts usano entrambe restaurantTimezone(), quindi non divergono a mezzanotte.
      const [t, s] = await Promise.all([
        api.get<TodaySummary>('/bills/summary/today'),
        api.get<DashboardStats>('/stats/dashboard'),
      ])
      setToday(t)
      setStats(s)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [api])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  useLiveEvent('order:new', () => { void load() })
  useLiveEvent('order:updated', () => { void load() })
  useLiveEvent('table:updated', () => { void load() })

  if (!today && failed) {
    return <EmptyState icon="stats" title="Numeri non disponibili" sub="L'appliance non risponde: riprova quando torni in sala." />
  }

  if (!today || !stats) {
    return (
      <div className="ow-grid-2">
        <Skeleton height={108} /><Skeleton height={108} />
        <Skeleton height={108} /><Skeleton height={108} />
      </div>
    )
  }

  return (
    <div className="ow-stack">
      <div className="ow-grid-2">
        <StatTile label="Incasso" value={euro(today.revenue)} icon="banknote" sub="mance escluse" />
        <StatTile label="Conti chiusi" value={String(today.billsCount)} icon="cassa" accent="var(--info)" />
        <StatTile label="Ticket medio" value={euro(today.avgTicket)} icon="stats" accent="var(--ok)" />
        <StatTile label="Mance" value={euro(today.tips)} icon="coins" accent="var(--wait)" sub="allo staff" />
      </div>

      <Card pad={16}>
        <SectionTitle>Adesso</SectionTitle>
        <div className="ow-kv"><span>Ordini in attesa</span><b className="num">{stats.pendingOrdersCount}</b></div>
        <div className="ow-kv"><span>Coperti (7 giorni)</span><b className="num">{stats.totalCovers}</b></div>
      </Card>

      {stats.topItems.length > 0 && (
        <Card pad={16}>
          <SectionTitle>Più venduti (7 giorni)</SectionTitle>
          {stats.topItems.slice(0, 5).map((t) => (
            <div key={t.name} className="ow-kv">
              <span>{t.name}</span>
              <b className="num">{t.qty}</b>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
