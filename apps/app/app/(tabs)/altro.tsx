// Altro — hub del port nativo: stato del collegamento, chi è connesso, scollega.
// Le sotto-schermate della PWA (menu, magazzino, staff, prenotazioni, assistente,
// notifiche, andamento) arrivano con le fasi 3-4 del piano (docs/PORT-NATIVE.md).
import { useApp } from '../../src/native/app'
import { Btn, Card, KV, SectionTitle } from '../../src/native/kit'
import { Screen } from '../../src/native/Screen'

export default function AltroScreen() {
  const { session, base, net, recheck, logout } = useApp()

  return (
    <Screen title="Altro">
      <Card pad={16}>
        <SectionTitle>Collegamento</SectionTitle>
        <KV label="Indirizzo" value={base || '—'} />
        <KV label="Rete" value={net === 'lan' || net === 'manual' ? 'In sala' : net === 'remote' ? 'Da remoto' : net === 'checking' ? 'Verifica…' : 'Offline'} />
        <KV label="Account" value={session?.user.name ?? '—'} />
        <KV label="Locale" value={session?.restaurant?.name ?? '—'} />
      </Card>

      <Btn kind="soft" full icon="refresh" onPress={recheck}>Ricontrolla la rete</Btn>
      <Btn kind="ghost" full onPress={logout}>Scollega questo telefono</Btn>
    </Screen>
  )
}
