// Primitivi UI del port nativo — le stesse forme di owner-src/ui/kit.tsx, in RN.
//
// Le tre regole che rendono una schermata "Tako" restano non negoziabili:
//   1. ogni card ha SIA il bordo hairline SIA l'ombra bassa: la profondità viene
//      dal bordo, non dal blur;
//   2. i numeri passano tutti da Nunito 900 (F.num) con tabular-nums;
//   3. tutto ciò che si tocca si schiaccia (scale .95) — qui via Pressable.
//
// Le icone: la PWA ha SVG propri (ui/icons.tsx); react-native-svg vorrebbe una
// rebuild nativa, quindi il port usa MaterialCommunityIcons di @expo/vector-icons
// (già in bundle) con una mappa nome→glifo. Stessi nomi delle schermate PWA.
import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { F, T } from '../theme'

export type Tone = 'ok' | 'wait' | 'info' | 'brand' | 'danger' | 'muted'

const TONE: Record<Tone, [string, string]> = {
  ok: [T.okBg, T.okDeep],
  wait: [T.waitBg, '#9A6912'],
  info: [T.infoBg, '#3A6587'],
  brand: [T.brandTint, T.brandDeep],
  danger: [T.dangerBg, T.danger],
  muted: [T.mutedBg, T.ink2],
}

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name']

// Mappa nome-icona PWA → glifo MCI. Se un nome manca si vede il fallback e si
// aggiunge qui: mai passare nomi MCI crudi dalle schermate.
const ICONS: Record<string, MciName> = {
  banknote: 'cash',
  cassa: 'cash-register',
  stats: 'chart-line',
  coins: 'hand-coin-outline',
  orders: 'receipt',
  sala: 'floor-plan',
  oggi: 'chart-box-outline',
  altro: 'view-grid-outline',
  sparkles: 'star-four-points-outline',
  x: 'close',
  bell: 'bell-outline',
  menu: 'silverware-fork-knife',
  staff: 'account-group-outline',
  magazzino: 'package-variant-closed',
  prenotazioni: 'clock-outline',
  copilot: 'creation',
  refresh: 'refresh',
  chevron: 'chevron-right',
}

export function Icon({ name, size = 18, color = T.ink2 }: { name: string; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={ICONS[name] ?? 'help-circle-outline'} size={size} color={color} />
}

export function Card({ children, pad = 16, style, onPress }: {
  children: ReactNode
  pad?: number
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}) {
  if (!onPress) return <View style={[s.card, { padding: pad }, style]}>{children}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { padding: pad }, pressed && s.pressed, style]}>
      {children}
    </Pressable>
  )
}

const BTN_KIND: Record<'brand' | 'soft' | 'ghost' | 'dark' | 'danger' | 'ok', { bg: string; fg: string; border?: string }> = {
  brand: { bg: T.brand, fg: T.onBrand },
  soft: { bg: T.brandTint, fg: T.brandDeep },
  ghost: { bg: 'transparent', fg: T.ink2, border: T.hairline },
  dark: { bg: T.ink, fg: '#fff' },
  danger: { bg: T.danger, fg: '#fff' },
  ok: { bg: T.ok, fg: '#fff' },
}

export function Btn({ children, onPress, kind = 'brand', size = 'md', icon, full, disabled }: {
  children?: ReactNode
  onPress?: () => void
  kind?: keyof typeof BTN_KIND
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  full?: boolean
  disabled?: boolean
}) {
  const k = BTN_KIND[kind]
  const height = size === 'sm' ? 36 : size === 'lg' ? 54 : 46
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 15
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: k.bg, height, borderRadius: T.rMd },
        k.border ? { borderWidth: 1, borderColor: k.border } : null,
        full && { alignSelf: 'stretch' },
        disabled && { opacity: 0.5 },
        pressed && s.pressed,
      ]}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={k.fg} />}
      {children != null && <Text style={{ color: k.fg, fontFamily: F.uiBold, fontSize }}>{children}</Text>}
    </Pressable>
  )
}

export function Badge({ children, tone = 'muted', dot, solid }: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  solid?: boolean
}) {
  const [bg, fg] = TONE[tone]
  return (
    <View style={[s.badge, { backgroundColor: solid ? fg : bg }]}>
      {dot && <View style={[s.dot, { backgroundColor: solid ? '#fff' : fg }]} />}
      <Text style={{ color: solid ? '#fff' : fg, fontFamily: F.uiBold, fontSize: 12 }}>{children}</Text>
    </View>
  )
}

/** Numero grande + etichetta: il mattone della schermata "Oggi". */
export function StatTile({ label, value, sub, icon, accent = T.brand }: {
  label: string
  value: string
  sub?: string
  icon?: string
  accent?: string
}) {
  return (
    <Card pad={14} style={{ flex: 1 }}>
      <View style={s.statHead}>
        <Text style={s.statLabel}>{label}</Text>
        {icon && (
          <View style={[s.statIco, { backgroundColor: `${accent}1F` }]}>
            <Icon name={icon} size={17} color={accent} />
          </View>
        )}
      </View>
      <Text style={s.statValue}>{value}</Text>
      {sub != null && <Text style={s.statSub}>{sub}</Text>}
    </Card>
  )
}

export function EmptyState({ icon = 'sparkles', title, sub, action }: {
  icon?: string
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIco}><Icon name={icon} size={26} color={T.ink3} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {sub != null && <Text style={s.emptySub}>{sub}</Text>}
      {action}
    </View>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionTitleText}>{children}</Text>
      {right}
    </View>
  )
}

/** Riga chiave→valore (la .ow-kv della PWA). */
export function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{String(value)}</Text>
    </View>
  )
}

/** Scheletro di caricamento: meglio di uno spinner quando la forma è già nota. */
export function Skeleton({ height = 64, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.6)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return <Animated.View style={[s.skel, { height, opacity: pulse }, style]} />
}

/** Euro formattati come nella dashboard: due decimali, separatore italiano. */
export function euro(n: number | null | undefined): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0
  return `€ ${v.toFixed(2).replace('.', ',')}`
}

/** "3′ fa" / "1h 12′ fa": la staff ragiona in minuti dal fatto, non in orari assoluti. */
export function since(iso: string | null | undefined): string {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'adesso'
  if (min < 60) return `${min}′ fa`
  return `${Math.floor(min / 60)}h ${min % 60}′ fa`
}

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return ''
  try { return new Date(iso).toTimeString().slice(0, 5) } catch { return '' }
}

const s = StyleSheet.create({
  card: {
    backgroundColor: T.raised,
    borderRadius: T.rLg,
    borderWidth: 1,
    borderColor: T.hairline,
    // Ombra bassa: la profondità viene dal bordo, l'ombra è solo appoggio.
    shadowColor: T.ink,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: T.rPill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontFamily: F.uiMedium, fontSize: 13, color: T.ink2 },
  statIco: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: F.num, fontSize: 26, color: T.ink, marginTop: 6, fontVariant: ['tabular-nums'] },
  statSub: { fontFamily: F.ui, fontSize: 12, color: T.ink3, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 46, paddingHorizontal: 26, gap: 6 },
  emptyIco: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: T.sunken, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontFamily: F.display, fontSize: 17, color: T.ink, textAlign: 'center' },
  emptySub: { fontFamily: F.ui, fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitleText: { fontFamily: F.display, fontSize: 16, color: T.ink },
  kv: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.hairline,
  },
  kvLabel: { fontFamily: F.ui, fontSize: 14.5, color: T.ink2, flexShrink: 1 },
  kvValue: { fontFamily: F.num, fontSize: 16, color: T.ink, fontVariant: ['tabular-nums'] },
  skel: { backgroundColor: T.sunken, borderRadius: T.rMd },
})
