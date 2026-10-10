import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { T } from '../src/theme'

// Dal port nativo (F8.2) qui vive anche la UI vera, non solo la cornice della
// WebView: i font di marca (Nunito per display e numeri, DM Sans per la UI —
// gli stessi di tokens.css) si caricano una volta per tutta l'app.
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_800ExtraBold,
    Nunito_900Black,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  })

  // Meglio un attimo di crema in più che un flash di font di sistema sui numeri.
  if (!fontsLoaded) return null

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
