// Schermata di avvio del guscio: logo Tako su fondo di marca mentre si cerca
// l'appliance sulla rete.
//
// Non è lo splash del sistema operativo (quello lo genera `expo prebuild` ed è
// materia di F7.3/F7.4): è ciò che si vede SUBITO DOPO, per il tempo del probe
// LAN — al massimo ~1,2 s. Serve perché senza, fra lo splash di sistema e la
// prima pittura della WebView, resterebbe un rettangolo vuoto.

import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import LOGO from '../assets/icon.png'
import { T } from './theme'

export function BootScreen({ label = 'Cerco Tako sulla rete…' }: { label?: string }) {
  return (
    <View style={styles.root}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={T.brand} style={styles.spin} />
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 132, height: 132 },
  spin: { marginTop: 20 },
  label: { marginTop: 14, fontSize: 14, color: T.ink2, textAlign: 'center' },
})
