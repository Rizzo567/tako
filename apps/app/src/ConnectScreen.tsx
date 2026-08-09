// Schermata nativa di collegamento (F7.2).
//
// Si vede in due soli momenti, ed è importante che siano questi due e non altri:
//   • al primissimo avvio, quando l'appliance non è ancora stata trovata;
//   • quando l'endpoint smette di rispondere (WiFi sbagliato, appliance spenta).
//
// Non è la schermata di LOGIN — quella è dentro la PWA (`/owner/` → EnrollScreen,
// col QR). Qui si risponde a una domanda sola: *dove* sta Tako. Per questo il testo
// parla di rete e non di account: chi la vede ha quasi sempre il telefono sulla
// rete sbagliata.

import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  hostSuggestions,
  MANUAL_PROBE_TIMEOUT_MS,
  normalizeBase,
  probe,
  type HostSuggestion,
} from './endpoint'
import { T } from './theme'
import LOGO from '../assets/icon.png'

export interface ConnectScreenProps {
  /** Messaggio dell'ultimo tentativo fallito, se c'è stato. */
  error?: string | null
  /** Host manuale già salvato, da riproporre nel campo. */
  initialHost?: string | null
  /** Ricerca automatica (host manuale → tako.local → tunnel). */
  onAutoRetry: () => void
  /** L'utente ha imposto un host e il probe è andato a buon fine. */
  onManualHost: (baseUrl: string) => void
}

export function ConnectScreen({ error, initialHost, onAutoRetry, onManualHost }: ConnectScreenProps) {
  const insets = useSafeAreaInsets()
  const [host, setHost] = useState(initialHost ?? '')
  const [testing, setTesting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const suggestions = hostSuggestions()
  const shown = localError ?? error ?? null

  const test = async (raw: string) => {
    const base = normalizeBase(raw)
    if (!base) {
      setLocalError('Scrivi l’indirizzo del computer del locale, per esempio tako.local:4317')
      return
    }
    setTesting(true)
    setLocalError(null)
    // Il probe non lancia mai: risponde sì/no. L'esito negativo qui è
    // un'informazione per l'utente, non un errore da propagare.
    const ok = await probe(base, MANUAL_PROBE_TIMEOUT_MS)
    setTesting(false)
    if (ok) onManualHost(base)
    else setLocalError(`Nessuna risposta da ${base}. Controlla che Tako sia acceso e che il telefono sia sulla stessa rete.`)
  }

  // NB: il nome non può iniziare per `use` — le regole degli Hook prenderebbero una
  // funzione qualunque chiamata dentro un callback per un hook fuori posto.
  const applySuggestion = (s: HostSuggestion) => {
    setHost(s.value)
    setLocalError(null)
    void test(s.value)
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Collega Tako</Text>
        <Text style={styles.sub}>
          L’app parla con il computer del locale sulla <Text style={styles.strong}>stessa rete WiFi</Text>.
          Accendi Tako sul computer e assicurati che il telefono sia sulla rete del locale, non sui dati mobili.
        </Text>

        {shown && (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{shown}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={onAutoRetry}
          disabled={testing}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed, testing && styles.btnDisabled]}
        >
          <Text style={styles.btnPrimaryText}>Cerca Tako sulla rete</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>Oppure scrivi l’indirizzo</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={(v) => {
              setHost(v)
              setLocalError(null)
            }}
            placeholder="tako.local:4317"
            placeholderTextColor={T.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            inputMode="url"
            returnKeyType="go"
            editable={!testing}
            onSubmitEditing={() => void test(host)}
            accessibilityLabel="Indirizzo del computer del locale"
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => void test(host)}
            disabled={testing || host.trim().length === 0}
            style={({ pressed }) => [
              styles.btn,
              styles.btnSecondary,
              pressed && styles.pressed,
              (testing || host.trim().length === 0) && styles.btnDisabled,
            ]}
          >
            {testing ? (
              <ActivityIndicator color={T.brandDeep} />
            ) : (
              <Text style={styles.btnSecondaryText}>Prova connessione</Text>
            )}
          </Pressable>

          {suggestions.map((s) => (
            <Pressable
              key={s.value}
              accessibilityRole="button"
              onPress={() => applySuggestion(s)}
              disabled={testing}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipValue}>{s.value}</Text>
              <Text style={styles.chipHint}>{s.hint}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.foot}>
          Il collegamento del telefono al ristorante (il QR) si fa dopo, dentro l’app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.surface },
  scroll: { paddingHorizontal: 24, alignItems: 'stretch' },
  logo: { width: 116, height: 116, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: T.ink, textAlign: 'center', marginTop: 4 },
  sub: { fontSize: 15, lineHeight: 22, color: T.ink2, textAlign: 'center', marginTop: 10 },
  strong: { fontWeight: '700', color: T.ink },

  errBox: {
    marginTop: 18,
    backgroundColor: T.dangerBg,
    borderRadius: T.rMd,
    padding: 14,
  },
  errText: { color: T.danger, fontSize: 14, lineHeight: 20 },

  btn: {
    minHeight: 52,
    borderRadius: T.rMd,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnPrimary: { backgroundColor: T.brand, marginTop: 20 },
  btnPrimaryText: { color: T.onBrand, fontSize: 16, fontWeight: '700' },
  btnSecondary: { backgroundColor: T.brandTint, marginTop: 12 },
  btnSecondaryText: { color: T.brandDeep, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },

  card: {
    marginTop: 22,
    backgroundColor: T.raised,
    borderRadius: T.rLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.hairline,
    padding: 16,
  },
  label: { fontSize: 13, fontWeight: '700', color: T.ink2, marginBottom: 8 },
  input: {
    minHeight: 50,
    borderRadius: T.rSm,
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.sunken,
    paddingHorizontal: 14,
    fontSize: 16,
    color: T.ink,
  },

  chip: {
    marginTop: 10,
    borderRadius: T.rSm,
    backgroundColor: T.sunken,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipValue: { fontSize: 15, fontWeight: '700', color: T.ink },
  chipHint: { fontSize: 12, color: T.ink3, marginTop: 2 },

  foot: { marginTop: 20, fontSize: 12, lineHeight: 18, color: T.ink3, textAlign: 'center' },
})
