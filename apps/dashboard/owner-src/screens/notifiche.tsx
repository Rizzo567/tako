// Notifiche push: la card in "Altro" e la richiesta di permesso al momento giusto (F3.3).
//
// IL MOMENTO GIUSTO. Il permesso alle notifiche si può chiedere UNA volta sola per
// installazione: un "no" non si ritira da codice. Chiederlo all'apertura, davanti a
// una schermata che il ristoratore non ha ancora capito, significa bruciare quell'unica
// occasione. Qui si chiede quando la risposta è ovvia: subito dopo il PRIMO evento
// vero — un ordine che entra, un tavolo che chiama — con l'app aperta. In quel momento
// "vuoi che te lo dica anche quando l'app è chiusa?" si risponde da sé.
//
// SU iOS non c'è niente da chiedere finché la PWA non è sulla schermata Home: la
// richiesta diventa una guida all'installazione, che è l'unica azione possibile.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useLiveEvent } from '../lib/live'
import { Badge, Btn, Card, Sheet, SectionTitle } from '../ui/kit'
import { Icon } from '../ui/icons'
import { disablePush, enablePush, hasSubscription, isIOS, pushState, syncPush, type PushState } from '../lib/push'

const LS_ASKED = 'tako.owner.push.asked'

function asked(): boolean {
  try { return localStorage.getItem(LS_ASKED) === '1' } catch { return true }
}
function markAsked(): void {
  try { localStorage.setItem(LS_ASKED, '1') } catch { /* storage disabilitato */ }
}

/** Le istruzioni di installazione: su iOS è l'unica strada verso le notifiche. */
function InstallGuide() {
  return (
    <ol className="ow-guide">
      <li>Tocca <b>Condividi</b> nella barra di Safari (il quadrato con la freccia).</li>
      <li>Scorri e scegli <b>Aggiungi a Home</b>.</li>
      <li>Apri Tako dall&apos;icona sulla schermata Home: da lì le notifiche funzionano.</li>
    </ol>
  )
}

/** Testo di stato: dice sempre cosa succede adesso, mai un codice. */
function stateLabel(s: PushState, subscribed: boolean): { tone: 'ok' | 'wait' | 'danger' | 'muted'; badge: string; text: string } {
  switch (s) {
    case 'granted':
      return subscribed
        ? { tone: 'ok', badge: 'Attive', text: 'Ti avviso su questo telefono anche con l’app chiusa: ordini, chiamate dai tavoli e scorte in esaurimento.' }
        : { tone: 'wait', badge: 'Da attivare', text: 'Il permesso c’è ma questo telefono non è ancora iscritto. Tocca Attiva.' }
    case 'denied':
      return { tone: 'danger', badge: 'Bloccate', text: 'Le notifiche sono bloccate per Tako. Si riattivano solo dalle impostazioni del telefono, alla voce Notifiche.' }
    case 'needs-install':
      return { tone: 'wait', badge: 'Installa Tako', text: 'Su iPhone e iPad le notifiche arrivano solo se Tako è sulla schermata Home.' }
    case 'unsupported':
      return { tone: 'muted', badge: 'Non disponibili', text: 'Questo browser non supporta le notifiche. In sala resta tutto live con l’app aperta.' }
    default:
      return { tone: 'wait', badge: 'Spente', text: 'Con l’app chiusa non ricevi nulla. Attivale per sapere di un ordine o di una chiamata mentre sei in cucina.' }
  }
}

/** Card di "Altro": lo stato delle notifiche e l'interruttore, sempre raggiungibile. */
export function NotificheCard() {
  const { api } = useApp()
  const [state, setState] = useState<PushState>(() => pushState())
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setState(pushState())
    setSubscribed(await hasSubscription())
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const attiva = async () => {
    setBusy(true)
    markAsked()
    const next = await enablePush(api)
    setState(next)
    setSubscribed(await hasSubscription())
    setBusy(false)
  }

  const spegni = async () => {
    setBusy(true)
    await disablePush(api)
    setSubscribed(false)
    setBusy(false)
  }

  const prova = async () => {
    setBusy(true)
    setTested(null)
    try {
      const r = await api.post<{ sent: number; failed: number; removed: number; skipped?: string }>('/push/test')
      setTested(
        r.sent > 0 ? `Inviata a ${r.sent} dispositivo${r.sent > 1 ? 'i' : ''}. Dovrebbe arrivare entro pochi secondi.`
          : r.skipped === 'offline' ? 'L’appliance non ha internet: le notifiche partono solo quando torna.'
            : r.skipped === 'no-subscriptions' ? 'Nessun telefono iscritto: attiva le notifiche qui sopra.'
              : 'Non è partita. Riprova fra poco.',
      )
    } catch {
      setTested('Non è stato possibile inviare la prova adesso.')
    }
    setBusy(false)
  }

  const s = stateLabel(state, subscribed)

  return (
    <Card pad={16}>
      <SectionTitle right={<Badge tone={s.tone} dot>{s.badge}</Badge>}>Notifiche</SectionTitle>
      <p className="ow-muted">{s.text}</p>

      {state === 'needs-install' && <InstallGuide />}

      <div className="ow-row-btns">
        {(state === 'default' || (state === 'granted' && !subscribed)) && (
          <Btn kind="brand" size="sm" icon="bell" onClick={attiva} disabled={busy}>Attiva le notifiche</Btn>
        )}
        {state === 'granted' && subscribed && (
          <>
            <Btn kind="soft" size="sm" icon="bell" onClick={prova} disabled={busy}>Provane una</Btn>
            <Btn kind="ghost" size="sm" icon="x" onClick={spegni} disabled={busy}>Spegni su questo telefono</Btn>
          </>
        )}
      </div>
      {tested && <p className="ow-muted" style={{ marginTop: 10 }}>{tested}</p>}
    </Card>
  )
}

/**
 * Il foglio che chiede il permesso. Si apre da solo UNA volta, al primo evento vero;
 * poi non si ripresenta mai più da solo — la card in "Altro" resta il posto dove
 * cambiare idea.
 */
export function PushPrompt() {
  const { api } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<PushState>(() => pushState())

  // All'avvio: ri-registra la subscription già presente. Un telefono ri-arruolato ha
  // perso la sua riga sul server (CASCADE) e resterebbe muto senza dare segno di sé.
  useEffect(() => { void syncPush(api) }, [api])

  const maybeAsk = useCallback(() => {
    if (asked()) return
    const s = pushState()
    // 'granted' → è già tutto fatto; 'denied'/'unsupported' → non c'è niente da
    // chiedere, e insistere sarebbe solo un ostacolo davanti a un ordine che arriva.
    if (s !== 'default' && s !== 'needs-install') return
    setState(s)
    setOpen(true)
    markAsked()
  }, [])

  // I due eventi che rendono la domanda ovvia. Nient'altro la fa scattare.
  useLiveEvent('order:new', maybeAsk)
  useLiveEvent('waiter:called', maybeAsk)

  const attiva = async () => {
    setBusy(true)
    const next = await enablePush(api)
    setBusy(false)
    setState(next)
    if (next === 'granted') setOpen(false)
  }

  const close = () => setOpen(false)

  return (
    <Sheet
      open={open}
      onClose={close}
      title={state === 'needs-install' ? 'Metti Tako sulla schermata Home' : 'Vuoi che te lo dica anche a app chiusa?'}
      footer={
        state === 'needs-install'
          ? <Btn kind="soft" full onClick={close}>Ho capito</Btn>
          : (
            <div className="ow-row-btns">
              <Btn kind="ghost" onClick={close} disabled={busy}>Non adesso</Btn>
              <Btn kind="brand" icon="bell" onClick={attiva} disabled={busy}>Sì, avvisami</Btn>
            </div>
          )
      }
    >
      {state === 'needs-install'
        ? (
          <>
            <p className="ow-muted">
              Su iPhone e iPad le notifiche arrivano solo alle app installate. Sono tre tocchi,
              una volta sola.
            </p>
            <InstallGuide />
          </>
        )
        : (
          <>
            <p className="ow-muted">
              Adesso l&apos;hai visto perch&eacute; l&apos;app era aperta. Con le notifiche te lo dico
              anche quando il telefono &egrave; in tasca.
            </p>
            <ul className="ow-list-plain" style={{ marginTop: 12 }}>
              <li><Icon name="orders" size={16} /> Ogni ordine che entra</li>
              <li><Icon name="bell" size={16} /> Ogni tavolo che chiama</li>
              <li><Icon name="coins" size={16} /> Le scorte che stanno finendo</li>
            </ul>
            <p className="ow-muted" style={{ marginTop: 12 }}>
              Puoi spegnerle quando vuoi da <b>Altro &rarr; Notifiche</b>.
            </p>
          </>
        )}
    </Sheet>
  )
}

/** Vero se questo dispositivo è un iPhone/iPad fuori dalla schermata Home. */
export const needsHomeScreen = () => isIOS() && pushState() === 'needs-install'
