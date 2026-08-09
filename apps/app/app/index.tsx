// ───────────────── Tako — guscio nativo dell'app ristoratore (F7.2) ─────────────────
//
// L'app nativa è un thin-client: la UI è la PWA `/owner/` servita dall'appliance
// sulla rete del locale (un telefono non può ospitare Postgres). Un solo codebase
// UI per web, iOS e Android — è la ragione per cui questo file resta piccolo.
//
// Fa tre cose, e nessun'altra:
//   1. TROVA l'appliance (LAN-first: host manuale → tako.local → tunnel). Vedi
//      `src/endpoint.ts`, porta nativa della logica di F1.4.
//   2. Mostra `/owner/` in una WebView confinata a quell'origine.
//   3. Quando l'appliance non risponde, mostra la schermata NATIVA di collegamento
//      invece della pagina di errore del browser — che a un ristoratore non dice nulla.
//
// Nota storica: fino a F7.1 questo file puntava a `/staff/index.html` (la dashboard
// desktop dentro un telefono). Da F7.2 punta a `/owner/`, che è la UI pensata per
// il pollice.

import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BackHandler,
  Platform,
  RefreshControl,
  Linking as RNLinking,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { BootScreen } from '../src/BootScreen'
import { ConnectScreen } from '../src/ConnectScreen'
import {
  configuredOverride,
  enrollFromDeepLink,
  loadConfig,
  originOf,
  parseLearnedEndpoints,
  resolveEndpoint,
  saveConfig,
  type StoredConfig,
} from '../src/endpoint'
import { T } from '../src/theme'

/** Percorso della PWA owner sull'appliance (registrato in `apps/server/src/index.ts`). */
const OWNER_PATH = '/owner/'

type Phase =
  | { name: 'boot' }
  | { name: 'connect'; error: string | null }
  | { name: 'web'; base: string }

/**
 * Girato dentro la pagina appena caricata: rilancia al nativo gli endpoint che la
 * PWA ha imparato dall'appliance (`learnEndpoints()` in owner-src/lib/endpoint.ts),
 * sia quelli già in `localStorage` sia quelli scritti dopo. Così il guscio impara
 * l'indirizzo del tunnel senza duplicare la chiamata a `/api/system/info` — che
 * peraltro non potrebbe fare, non avendo il token.
 */
const LEARN_ENDPOINTS_JS = `(function () {
  try {
    var KEY = 'tako.owner.endpoints';
    var send = function (raw) {
      if (!raw) return;
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'endpoints', value: JSON.parse(raw) })); } catch (e) {}
    };
    send(localStorage.getItem(KEY));
    if (!window.__takoEndpointHook) {
      window.__takoEndpointHook = true;
      var orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k, v) { orig(k, v); if (k === KEY) send(v); };
    }
  } catch (e) {}
  true;
})();`

export default function Index() {
  const [phase, setPhase] = useState<Phase>({ name: 'boot' })
  const [cfg, setCfg] = useState<StoredConfig>({ manual: null, remote: null })
  const [refreshing, setRefreshing] = useState(false)
  /** Rimonta la WebView: unico rimedio quando il processo di rendering muore. */
  const [webKey, setWebKey] = useState(0)

  const webRef = useRef<WebView>(null)
  const canGoBack = useRef(false)

  const deepLink = Linking.useURL()
  const enrollCode = enrollFromDeepLink(deepLink)

  // ─────────────── Risoluzione dell'endpoint ───────────────

  const resolve = useCallback(async () => {
    setPhase({ name: 'boot' })
    // Un override esplicito (app.json extra.serverUrl o EXPO_PUBLIC_SERVER_URL) è
    // una decisione di chi costruisce la build: si rispetta senza sondare nulla.
    const override = configuredOverride()
    if (override) {
      setPhase({ name: 'web', base: override })
      return
    }
    const loaded = await loadConfig()
    setCfg(loaded)
    const found = await resolveEndpoint(loaded)
    if (found) setPhase({ name: 'web', base: found.baseUrl })
    else {
      setPhase({
        name: 'connect',
        error: loaded.manual
          ? `Nessuna risposta da ${loaded.manual} né da tako.local.`
          : null,
      })
    }
  }, [])

  useEffect(() => {
    void resolve()
  }, [resolve])

  const useManualHost = useCallback(async (baseUrl: string) => {
    const next = await saveConfig({ manual: baseUrl })
    setCfg(next)
    setPhase({ name: 'web', base: baseUrl })
  }, [])

  // ─────────────── WebView ───────────────

  const base = phase.name === 'web' ? phase.base : null
  const origin = base ? originOf(base) : ''
  const startUrl = base ? `${base}${OWNER_PATH}` : ''

  // `source` va memoizzato sull'URL: un oggetto nuovo a ogni render farebbe
  // ricaricare la pagina a ogni cambio di stato (e con essa la sessione in corso).
  const source = useMemo(() => ({ uri: startUrl }), [startUrl])

  // Il codice di arruolamento NON entra nella `source`: cambiare solo il fragment
  // di un URL già caricato è una navigazione interna al documento, la pagina non
  // si rimonta e `takeEnrollCodeFromUrl()` — che gira in un effect al mount — non
  // scatterebbe mai. Si scrive il fragment e si RICARICA, che è l'unico modo per
  // far ripartire la PWA con il codice in mano.
  useEffect(() => {
    if (!enrollCode || phase.name !== 'web') return
    const hash = JSON.stringify(`#enroll=${encodeURIComponent(enrollCode)}`)
    webRef.current?.injectJavaScript(`(function(){ location.hash = ${hash}; location.reload(); })(); true;`)
  }, [enrollCode, phase.name])

  const fail = useCallback((message: string) => {
    canGoBack.current = false
    setRefreshing(false)
    setPhase({ name: 'connect', error: message })
  }, [])

  // Back di Android = indietro nella cronologia della WebView. Solo quando c'è
  // cronologia: altrimenti si restituisce false e il sistema chiude l'app, che è
  // ciò che l'utente si aspetta dalla prima schermata.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase.name === 'web' && canGoBack.current) {
        webRef.current?.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [phase.name])

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; value?: unknown }
      if (msg?.type !== 'endpoints') return
      const learned = parseLearnedEndpoints(msg.value)
      if (learned?.remote) void saveConfig({ remote: learned.remote }).then(setCfg)
    } catch {
      /* la pagina può postare messaggi suoi: quelli non nostri si ignorano */
    }
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    webRef.current?.reload()
  }, [])

  // ─────────────── Render ───────────────

  if (phase.name === 'boot') return <BootScreen />

  if (phase.name === 'connect') {
    return (
      <ConnectScreen
        error={phase.error}
        initialHost={cfg.manual}
        onAutoRetry={() => void resolve()}
        onManualHost={(url) => void useManualHost(url)}
      />
    )
  }

  const webview = (
    <WebView
      key={webKey}
      ref={webRef}
      source={source}
      // Confina la WebView all'origine dell'appliance: nessuna navigazione
      // off-host può ereditare la sessione del ristoratore (MITM/redirect su LAN
      // in chiaro). I link esterni si aprono nel browser di sistema, fuori di qui.
      originWhitelist={[`${origin}/*`]}
      onShouldStartLoadWithRequest={(req) => {
        const url = req.url
        if (url.startsWith(origin) || url === 'about:blank' || url.startsWith('blob:') || url.startsWith('data:')) {
          return true
        }
        if (/^(https?|tel|mailto|sms|whatsapp):/i.test(url)) void RNLinking.openURL(url).catch(() => {})
        return false
      }}
      onNavigationStateChange={(nav) => {
        canGoBack.current = nav.canGoBack
      }}
      // Il token di sessione vive in localStorage (vedi owner-src/lib/session.ts):
      // senza domStorage l'app si scollegherebbe a ogni avvio.
      javaScriptEnabled
      domStorageEnabled
      // Endpoint imparati dalla PWA → AsyncStorage del guscio.
      injectedJavaScript={LEARN_ENDPOINTS_JS}
      injectedJavaScriptBeforeContentLoaded={LEARN_ENDPOINTS_JS}
      onMessage={onMessage}
      // Errori di rete sul documento principale: si torna alla schermata nativa.
      // Il codice -999 di WebKit è la richiesta ANNULLATA (una navigazione ne ha
      // soppiantata un'altra): non è un guasto e non deve buttare fuori nessuno.
      onError={({ nativeEvent }) => {
        if (nativeEvent.code === -999) return
        fail(`Non riesco a caricare Tako da ${origin}. ${nativeEvent.description ?? ''}`.trim())
      }}
      onHttpError={({ nativeEvent }) => {
        // Solo il documento principale: un 404 su un'icona non è un motivo per
        // sbattere fuori il ristoratore dalla sua app.
        const failed = (nativeEvent.url ?? '').split('#')[0]
        if (failed !== startUrl.split('#')[0]) return
        fail(
          nativeEvent.statusCode === 404
            ? `Tako risponde su ${origin} ma non da questa rete (serve il collegamento in LAN).`
            : `Tako ha risposto ${nativeEvent.statusCode} su ${origin}.`,
        )
      }}
      onLoadEnd={() => setRefreshing(false)}
      // Processo di rendering morto (Android `onRenderProcessGone`, iOS
      // `onContentProcessDidTerminate`): una `reload()` su una WebView morta non
      // fa nulla — la vista va RICREATA. Cambiare la key la rimonta da zero, e il
      // ristoratore ritrova la sua sessione (il token è in localStorage, che
      // sopravvive alla vista).
      onRenderProcessGone={() => setWebKey((k) => k + 1)}
      onContentProcessDidTerminate={() => setWebKey((k) => k + 1)}
      pullToRefreshEnabled
      nestedScrollEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled={false}
      allowsInlineMediaPlayback
      allowsBackForwardNavigationGestures
      setSupportMultipleWindows={false}
      scalesPageToFit={false}
      webviewDebuggingEnabled={__DEV__}
      style={styles.web}
      containerStyle={styles.web}
    />
  )

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Su iOS il pull-to-refresh è nativo della WebView (`pullToRefreshEnabled`,
          prop iOS-only). Su Android non esiste: lo dà il RefreshControl del
          ScrollView, che riceve l'overscroll grazie a `nestedScrollEnabled`. */}
      {Platform.OS === 'android' ? (
        <ScrollView
          style={styles.web}
          contentContainerStyle={styles.fill}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[T.brand]}
              tintColor={T.brand}
              progressBackgroundColor={T.surface}
            />
          }
        >
          {webview}
        </ScrollView>
      ) : (
        webview
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.surface },
  web: { flex: 1, backgroundColor: T.surface },
  fill: { flexGrow: 1 },
})
