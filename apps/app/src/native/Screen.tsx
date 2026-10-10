// Cornice comune delle schermate native: header col nome del locale e il badge
// di rete (come la shell della PWA), contenuto in ScrollView con refresh a
// trascinamento — il gesto che una WebView non darà mai con la molla giusta.
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { F, T } from '../theme'
import { useApp } from './app'
import { Badge } from './kit'

export function Screen({ title, children, onRefresh }: {
  /** Titolo della schermata; l'header mostra anche il nome del ristorante. */
  title?: string
  children: ReactNode
  /** Ricarica i dati della schermata (pull-to-refresh). */
  onRefresh?: () => Promise<void>
}) {
  const insets = useSafeAreaInsets()
  const { session, net } = useApp()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try { await onRefresh() } finally { setRefreshing(false) }
  }, [onRefresh])

  const netBadge = net === 'checking'
    ? <Badge tone="muted">…</Badge>
    : net === 'offline'
      ? <Badge tone="danger" dot>Offline</Badge>
      : net === 'remote'
        ? <Badge tone="info" dot>Da remoto</Badge>
        : <Badge tone="ok" dot>In sala</Badge>

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Text style={s.headTitle} numberOfLines={1}>
          {title ?? session?.restaurant?.name ?? 'Tako'}
        </Text>
        {netBadge}
      </View>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={onRefresh
          ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={T.brand} />
          : undefined}
      >
        {children}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10,
  },
  headTitle: { fontFamily: F.display, fontSize: 26, color: T.ink, flexShrink: 1, marginRight: 12 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 14, paddingBottom: 28, gap: 12 },
})
