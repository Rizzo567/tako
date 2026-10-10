// Sala — segnaposto del port nativo (F8.2). La piantina 2D arriva con la fase 2
// del piano (docs/PORT-NATIVE.md); intanto la voce esiste perché la tab bar
// nativa deve nascere completa, non crescere una tab alla volta sotto gli occhi
// del ristoratore.
import { EmptyState } from '../kit'
import { Screen } from '../Screen'

export default function SalaScreen() {
  return (
    <Screen title="Sala">
      <EmptyState
        icon="sala"
        title="La sala nativa è in arrivo"
        sub="Tavoli e piantina si stanno trasferendo dall'app web. Nel frattempo trovi tutto sul computer del locale."
      />
    </Screen>
  )
}
