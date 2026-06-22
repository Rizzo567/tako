import Constants from 'expo-constants'
import { View } from 'react-native'
import { WebView } from 'react-native-webview'

// L'app nativa è un thin-client: carica la dashboard staff REALE (UI verbatim del
// prototipo, collegata al backend) servita dal server Tako sulla rete locale.
// Stessa identica UI del desktop (Tauri punta allo stesso URL).
//
// Su simulatore/stesso Mac va bene `localhost`. Su un telefono vero serve l'IP LAN
// del mini-PC che fa girare Tako: impostalo in app.json -> expo.extra.serverUrl
// (es. "http://192.168.1.34:3000") oppure via env EXPO_PUBLIC_SERVER_URL.
const SERVER_URL =
  (Constants.expoConfig?.extra as any)?.serverUrl ||
  process.env.EXPO_PUBLIC_SERVER_URL ||
  'http://localhost:3000'

const STAFF_URL = `${SERVER_URL.replace(/\/$/, '')}/staff/index.html`

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FBF8F4' }}>
      <WebView
        source={{ uri: STAFF_URL }}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        style={{ flex: 1, backgroundColor: '#FBF8F4' }}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
      />
    </View>
  )
}
