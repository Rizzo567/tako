// Ordini in arrivo — port nativo di owner-src/screens/ordini.tsx.
// Stessa paginazione a cursore (?limit=&before=), stesso ottimismo controllato
// sull'avanzamento di stato (la riga cambia subito, il server resta l'arbitro).
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useApp } from '../../src/native/app'
import { NEXT_STATUS, ORDER_STATUS, orderTag, type OrderRow } from '../../src/native/domain'
import { Badge, Btn, Card, EmptyState, Skeleton, euro, hhmm, since } from '../../src/native/kit'
import { useLiveEvent, useLiveReload } from '../../src/native/live'
import { Screen } from '../../src/native/Screen'
import { F, T } from '../../src/theme'

const PAGE = 25

export default function OrdiniScreen() {
  const { api, online } = useApp()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fresh = useRef(new Set<string>())

  const load = useCallback(async () => {
    try {
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
    setOrders((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, status: next.to } : x)))
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next.to })
    } catch {
      await load()
    } finally {
      setBusy(null)
    }
  }

  let body
  if (orders === null) {
    body = <><Skeleton height={92} /><Skeleton height={92} /><Skeleton height={92} /></>
  } else if (!orders.length) {
    body = <EmptyState icon="orders" title="Nessun ordine in corso" sub="Gli ordini nuovi compaiono qui da soli, senza ricaricare." />
  } else {
    body = (
      <>
        {orders.map((o) => {
          const next = NEXT_STATUS[o.status]
          const portate = (o.items ?? []).reduce((sum, i) => sum + i.quantity, 0) || 1
          return (
            <Card key={o.id} pad={0}>
              <View style={[s.head, o.status === 'ready' && s.headReady]}>
                <Text style={s.tag}>{orderTag(o)}</Text>
                <View style={s.headTitle}>
                  <Text style={s.portate}>{portate} portate</Text>
                  <Text style={s.when}>{hhmm(o.createdAt)} · {since(o.createdAt)}</Text>
                </View>
                <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
              </View>
              <View style={s.body}>
                {(o.items ?? []).map((i) => (
                  <View key={i.id} style={s.item}>
                    <Text style={s.qty}>{i.quantity}×</Text>
                    <Text style={s.itemName} numberOfLines={2}>{i.name}</Text>
                    {i.notes ? <Text style={s.notes} numberOfLines={1}>{i.notes}</Text> : null}
                  </View>
                ))}
                <View style={s.foot}>
                  <Text style={s.total}>{euro(o.total)}</Text>
                  {next && (
                    <Btn size="sm" onPress={() => void advance(o)} disabled={busy === o.id || !online}>{next.label}</Btn>
                  )}
                </View>
              </View>
            </Card>
          )
        })}

        {nextBefore && <Btn kind="ghost" full onPress={() => void more()}>Carica altri</Btn>}
      </>
    )
  }

  return <Screen title="Ordini" onRefresh={load}>{body}</Screen>
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline,
  },
  headReady: { backgroundColor: T.okBg, borderTopLeftRadius: T.rLg, borderTopRightRadius: T.rLg },
  tag: {
    fontFamily: F.num, fontSize: 15, color: T.brandDeep,
    backgroundColor: T.brandTint, borderRadius: T.rSm,
    minWidth: 38, textAlign: 'center', paddingVertical: 6, overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  headTitle: { flex: 1 },
  portate: { fontFamily: F.uiBold, fontSize: 15, color: T.ink },
  when: { fontFamily: F.ui, fontSize: 12, color: T.ink3, marginTop: 1 },
  body: { padding: 12, gap: 7 },
  item: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  qty: { fontFamily: F.num, fontSize: 14, color: T.ink2, minWidth: 26, fontVariant: ['tabular-nums'] },
  itemName: { fontFamily: F.ui, fontSize: 14.5, color: T.ink, flexShrink: 1 },
  notes: { fontFamily: F.ui, fontSize: 12.5, color: T.ink3, fontStyle: 'italic', flexShrink: 1 },
  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 5, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.hairline,
  },
  total: { fontFamily: F.num, fontSize: 17, color: T.ink, fontVariant: ['tabular-nums'] },
})
