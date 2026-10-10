// Oggi — port nativo di owner-src/screens/oggi.tsx. Stesse due letture, stessa
// regola sul fuso (il confine di mezzanotte lo decide il server), stessa
// separazione della mancia (pass-through allo staff, mai nel ricavo).
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useApp } from '../../src/native/app'
import { Card, EmptyState, KV, SectionTitle, Skeleton, StatTile, euro } from '../../src/native/kit'
import { useLiveEvent, useLiveReload } from '../../src/native/live'
import { Screen } from '../../src/native/Screen'
import { T } from '../../src/theme'

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

export default function OggiScreen() {
  const { api } = useApp()
  const [today, setToday] = useState<TodaySummary | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
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

  let body
  if (!today && failed) {
    body = <EmptyState icon="stats" title="Numeri non disponibili" sub="L'appliance non risponde: riprova quando torni in sala." />
  } else if (!today || !stats) {
    body = (
      <View style={s.grid}>
        <Skeleton height={108} style={s.half} /><Skeleton height={108} style={s.half} />
        <Skeleton height={108} style={s.half} /><Skeleton height={108} style={s.half} />
      </View>
    )
  } else {
    body = (
      <>
        <View style={s.grid}>
          <View style={s.half}><StatTile label="Incasso" value={euro(today.revenue)} icon="banknote" sub="mance escluse" /></View>
          <View style={s.half}><StatTile label="Conti chiusi" value={String(today.billsCount)} icon="cassa" accent={T.info} /></View>
          <View style={s.half}><StatTile label="Ticket medio" value={euro(today.avgTicket)} icon="stats" accent={T.ok} /></View>
          <View style={s.half}><StatTile label="Mance" value={euro(today.tips)} icon="coins" accent={T.wait} sub="allo staff" /></View>
        </View>

        <Card pad={16}>
          <SectionTitle>Adesso</SectionTitle>
          <KV label="Ordini in attesa" value={stats.pendingOrdersCount} />
          <KV label="Coperti (7 giorni)" value={stats.totalCovers} />
        </Card>

        {stats.topItems.length > 0 && (
          <Card pad={16}>
            <SectionTitle>Più venduti (7 giorni)</SectionTitle>
            {stats.topItems.slice(0, 5).map((t) => (
              <KV key={t.name} label={t.name} value={t.qty} />
            ))}
          </Card>
        )}
      </>
    )
  }

  return <Screen onRefresh={load}>{body}</Screen>
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Due per riga: metà larghezza meno metà del gap.
  half: { flexBasis: '47%', flexGrow: 1 },
})
