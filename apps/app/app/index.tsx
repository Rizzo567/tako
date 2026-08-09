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
  Linking as RNLinking,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
/**
 * Le safe area le misura il NATIVO e le passa alla pagina come `--safe-top` /
 * `--safe-bottom` (F8.1). La PWA le ha già in `env(safe-area-inset-*)`, ma dentro
 * una WebView quei valori valgono solo se la vista arriva davvero fino ai bordi —
 * su Android, con l'edge-to-edge di SDK 56, `env()` torna 0 in più di un caso. Lo
 * stile inline su `:root` vince sui token e non tocca il caso Safari standalone,
 * dove questa iniezione semplicemente non gira e restano le `env()`.
 */
function insetsJs(top: number, bottom: number) {
  return `(function () {
  try {
    var d = document.documentElement;
    d.style.setProperty('--safe-top', '${Math.round(top)}px');
    d.style.setProperty('--safe-bottom', '${Math.round(bottom)}px');
    d.setAttribute('data-tako-shell', '1');
  } catch (e) {}
  true;
})();`
}

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
  /** Rimonta la WebView: unico rimedio quando il processo di rendering muore. */
  const [webKey, setWebKey] = useState(0)
  const insets = useSafeAreaInsets()

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

  // NB: il nome non può iniziare per `use` — le regole degli Hook lo scambierebbero
  // per un hook chiamato dentro un callback (il render lo passa a `onManualHost`).
  const applyManualHost = useCallback(async (baseUrl: string) => {
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

  // Le safe area cambiano con la rotazione e all'apertura della tastiera: la pagina
  // va riallineata subito, non al prossimo caricamento.
  const insetsScript = insetsJs(insets.top, insets.bottom)
  useEffect(() => {
    if (phase.name !== 'web') return
    webRef.current?.injectJavaScript(insetsScript)
  }, [insetsScript, phase.name])

  const fail = useCallback((message: string) => {
    canGoBack.current = false
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

  // ─────────────── Render ───────────────

  if (phase.name === 'boot') return <BootScreen />

  if (phase.name === 'connect') {
    return (
      <ConnectScreen
        error={phase.error}
        initialHost={cfg.manual}
        onAutoRetry={() => void resolve()}
        onManualHost={(url) => void applyManualHost(url)}
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
      //
      // ATTENZIONE al formato: react-native-webview confronta questi pattern con
      // l'ORIGINE nuda della richiesta (`schema://host:porta`, senza path). Un
      // pattern con lo slash finale — `http://tako.local:4317/*` — non combacia
      // MAI, e la conseguenza non è un errore: la libreria considera la pagina
      // "esterna" e la apre in Safari. In F7.3 l'app si è aperta nel browser di
      // sistema, con la PWA giusta e la barra degli indirizzi visibile.
      originWhitelist={[origin]}
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
      // Endpoint imparati dalla PWA → AsyncStorage del guscio. Le safe area viaggiano
      // insieme: devono valere già al primo paint, o l'header nasce sotto l'isola.
      injectedJavaScript={`${insetsScript}${LEARN_ENDPOINTS_JS}`}
      injectedJavaScriptBeforeContentLoaded={`${insetsScript}${LEARN_ENDPOINTS_JS}`}
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
      // Processo di rendering morto (Android `onRenderProcessGone`, iOS
      // `onContentProcessDidTerminate`): una `reload()` su una WebView morta non
      // fa nulla — la vista va RICREATA. Cambiare la key la rimonta da zero, e il
      // ristoratore ritrova la sua sessione (il token è in localStorage, che
      // sopravvive alla vista).
      onRenderProcessGone={() => setWebKey((k) => k + 1)}
      onContentProcessDidTerminate={() => setWebKey((k) => k + 1)}
      // ───────── F8.1 — questa non è una pagina web, è un'app ─────────
      //
      // Tutto ciò che segue serve a togliere alla WebView i gesti che tradiscono
      // il browser. Manuel ha bocciato la build di F7.3 con quattro parole:
      // «si può muovere tutta l'interfaccia».
      //
      // Il pannello che scorre è UNO SOLO ed è dentro la pagina (`.ow-scroll`);
      // il documento è grande esattamente quanto il viewport (body fissato in
      // `owner-src/app.css`). Quindi la scrollView della WebView non ha nulla da
      // scorrere — e senza `bounces` non può nemmeno fingere di averlo. Lo
      // scorrimento NON è disabilitato del tutto: quando si apre la tastiera,
      // WebKit usa proprio quella scrollView per portare in vista il campo a
      // fuoco, e toglierla lascerebbe l'input sotto i tasti.
      //
      // NB: react-native-webview NON espone `alwaysBounceHorizontal/Vertical`
      // (non sono in `IOSWebViewProps`): `bounces={false}` è la sola leva, e
      // spegne il rimbalzo su ENTRAMBI gli assi perché è `UIScrollView.bounces`.
      bounces={false}
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      // La pagina si dispone da sé sulle safe area (`viewport-fit=cover` + env()):
      // nessuno deve aggiungere insidie sopra, o il contenuto nasce spostato e la
      // WebView diventa scorrevole per la sola altezza dell'inset.
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      // Android: niente effetto "stiro" ai bordi e niente controlli di zoom.
      overScrollMode="never"
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      // La gesture di ritorno dal bordo fa scivolare l'istantanea della pagina
      // precedente: è l'animazione di Safari, e sulle navigazioni pushState della
      // PWA (le sotto-schermate di "Altro") scivola una copia identica di ciò che
      // si sta guardando. Il ritorno ce l'hanno già la freccia nell'header e il
      // tasto fisico di Android.
      allowsBackForwardNavigationGestures={false}
      // Anteprima al tocco prolungato: menù contestuale da browser su ogni link.
      allowsLinkPreview={false}
      nestedScrollEnabled={false}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled={false}
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      scalesPageToFit={false}
      webviewDebuggingEnabled={__DEV__}
      style={styles.web}
      containerStyle={styles.web}
    />
  )

  // Nessuna SafeAreaView: la WebView arriva ai bordi dello schermo, isola compresa.
  // Gli inset non spariscono, cambiano padrone — li applica la PWA in CSS, che è
  // l'unica a sapere quali elementi devono stare sotto l'isola (lo scrim sfocato)
  // e quali no. Un padding nativo qui è esattamente la banda che Manuel ha visto.
  return <View style={styles.root}>{webview}</View>
}

const styles = StyleSheet.create({
  // Lo sfondo è quello della pagina, non della schermata di collegamento: è ciò
  // che si intravede nel frame fra l'avvio della WebView e il primo paint.
  root: { flex: 1, backgroundColor: T.bg },
  web: { flex: 1, backgroundColor: T.bg },
})
