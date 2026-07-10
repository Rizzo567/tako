import Constants from 'expo-constants'
import { View } from 'react-native'
import { WebView } from 'react-native-webview'

// L'app nativa è un thin-client: carica la dashboard staff REALE (UI verbatim del
// prototipo, collegata al backend) servita dal server Tako sulla rete locale.
// Stessa identica UI del desktop (Tauri punta allo stesso URL).
//
// L'app DESKTOP (Tauri) è autosufficiente e serve Tako su :4317. Un telefono/tablet
// non può ospitare Postgres: è per forza un thin-client verso l'host. Default a
// tako.local:4317 (mDNS dell'host); override con app.json -> expo.extra.serverUrl
// o env EXPO_PUBLIC_SERVER_URL se serve un IP specifico.
const SERVER_URL =
  (Constants.expoConfig?.extra as any)?.serverUrl ||
  process.env.EXPO_PUBLIC_SERVER_URL ||
  'http://tako.local:4317'

const SERVER_ORIGIN = SERVER_URL.replace(/\/$/, '')
const STAFF_URL = `${SERVER_ORIGIN}/staff/index.html`

// Confina la WebView al solo origin del server Tako: nessuna navigazione off-host
// può ereditare la sessione staff (mitiga MITM/redirect su LAN cleartext).
const ALLOWED_ORIGINS = [SERVER_ORIGIN, 'http://tako.local:4317', 'http://127.0.0.1:4317']

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FBF8F4' }}>
      <WebView
        source={{ uri: STAFF_URL }}
        originWhitelist={ALLOWED_ORIGINS}
        onShouldStartLoadWithRequest={(req) =>
          ALLOWED_ORIGINS.some((o) => req.url.startsWith(o))
        }
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        style={{ flex: 1, backgroundColor: '#FBF8F4' }}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
      />
    </View>
  )
}
