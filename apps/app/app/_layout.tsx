import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { T } from '../src/theme'

// Il frontend dell'app è la PWA `/owner/` mostrata in WebView (vedi index.tsx).
// Qui non vive nessuna UI: solo la cornice — status bar di marca, sfondo che non
// lampeggia bianco fra una schermata e l'altra, e il provider delle safe area di
// cui hanno bisogno la schermata di collegamento e il contenitore della WebView.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Icone scure: lo sfondo del guscio è il crema di marca, mai scuro. Su
          Android non si passa `backgroundColor` (rimosso in SDK 56 con l'edge-to-edge
          obbligatorio): il colore dietro la status bar lo dà la SafeAreaView. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.surface } }} />
    </SafeAreaProvider>
  )
}
