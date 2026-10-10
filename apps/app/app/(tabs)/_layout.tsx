// Tab bar del port nativo (F8.2): le stesse cinque voci della PWA owner, ma
// componenti di sistema veri — è il punto della decisione del 14/08 (il feel
// browser della WebView non è all'altezza di HearFlow).
import { Redirect, Tabs } from 'expo-router'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { NativeAppProvider, useApp } from '../../src/native/app'
import { clearNativeBoot, disableWebImport, getNativeBoot } from '../../src/native/bootstrap'
import { Icon } from '../../src/native/kit'
import { LiveProvider } from '../../src/native/live'
import { F, T } from '../../src/theme'

// Sala e Cassa restano fuori dalla 1.0: erano segnaposto "in arrivo" e una
// schermata vuota costa il rifiuto in review (App Store 2.1). Rientrano quando
// la piantina 2D e il conto sono portati davvero — fase 2 in docs/PORT-NATIVE.md.
const TABS = [
  { name: 'ordini', title: 'Ordini', icon: 'orders' },
  { name: 'oggi', title: 'Oggi', icon: 'oggi' },
  { name: 'altro', title: 'Altro', icon: 'altro' },
] as const

/**
 * Dentro il provider: quando la sessione muore (logout, revoca dalla dashboard,
 * 401) si esce dalle tab e si torna alla radice. `disableWebImport` impedisce
 * all'index di re-importare al volo la sessione parallela della WebView, che
 * farebbe rimbalzare il ristoratore dentro l'app da cui si è appena scollegato.
 */
function SessionGate({ children }: { children: ReactNode }) {
  const { session } = useApp()
  if (!session) {
    disableWebImport()
    clearNativeBoot()
    return <Redirect href="/" />
  }
  return children
}

export default function TabsLayout() {
  const boot = getNativeBoot()
  // Montaggio freddo senza decisione a monte (reload in sviluppo, deep link):
  // si torna alla radice, che rifà la scelta nativo/WebView con calma.
  if (!boot) return <Redirect href="/" />

  return (
    <NativeAppProvider initialSession={boot.session} initialBase={boot.base}>
      <SessionGate>
      <LiveProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: T.bg },
            tabBarActiveTintColor: T.brandDeep,
            tabBarInactiveTintColor: T.ink3,
            tabBarStyle: { backgroundColor: T.surface, borderTopColor: T.hairline },
            tabBarLabel: ({ color, children }) => (
              <Text style={{ color, fontFamily: F.uiBold, fontSize: 10.5 }}>{children}</Text>
            ),
          }}
        >
          {TABS.map((t) => (
            <Tabs.Screen
              key={t.name}
              name={t.name}
              options={{
                title: t.title,
                tabBarIcon: ({ color, size }) => (
                  <View><Icon name={t.icon} size={size} color={String(color)} /></View>
                ),
              }}
            />
          ))}
        </Tabs>
      </LiveProvider>
      </SessionGate>
    </NativeAppProvider>
  )
}
