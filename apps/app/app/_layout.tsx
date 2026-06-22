import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

// Frontend unico dell'app = file standalone verbatim mostrato in WebView (vedi
// index.tsx). Nessun provider/tema RN: la UI vive dentro la pagina standalone.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FBF8F4' } }} />
    </>
  )
}
