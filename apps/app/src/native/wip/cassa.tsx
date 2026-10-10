// Cassa — segnaposto del port nativo (F8.2). Vedi docs/PORT-NATIVE.md, fase 2.
import { EmptyState } from '../kit'
import { Screen } from '../Screen'

export default function CassaScreen() {
  return (
    <Screen title="Cassa">
      <EmptyState
        icon="cassa"
        title="La cassa nativa è in arrivo"
        sub="Conti aperti e chiusure si stanno trasferendo dall'app web. Nel frattempo trovi tutto sul computer del locale."
      />
    </Screen>
  )
}
