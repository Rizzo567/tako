// Tako Owner — guscio minimo dell'app del ristoratore (F0.2).
//
// Qui c'è SOLO la shell che monta e prova che la pipeline esbuild funziona: niente
// dati, niente navigazione, niente auth. La UI vera (sala, ordini, cassa) arriva in F2.
// Vincoli di questa app, validi da qui in avanti:
//   - mobile-only: nessun ramo desktop (al contrario di staff/src/07-app-root.js)
//   - zero Babel a runtime: si compila qui, non nel browser
//   - design token identici alla staff (owner-src/tokens.css)
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createEndpointManager,
  learnEndpoints,
  loadEndpoints,
  type EndpointKind,
  type EndpointState,
} from './lib/endpoint'

type Shown = EndpointKind | 'checking'

// I tre stati di rete di D4: mai ambigui, sempre visibili in cima allo schermo.
const LABEL: Record<Shown, string> = {
  checking: 'Verifico…',
  lan: 'In sala',
  remote: 'Da remoto',
  offline: 'Appliance non raggiungibile',
}

// Mappa sugli stati grafici già esistenti del badge (verde/rosso): il giallo del
// "da remoto" arriva con la UI vera in F2.
const BADGE_STATE: Record<Shown, string | undefined> = {
  checking: undefined,
  lan: 'online',
  remote: 'online',
  offline: 'offline',
}

/**
 * Selezione dell'endpoint LAN-first. Gli URL dei due endpoint si imparano dall'appliance
 * (`/api/system/info`) e restano in localStorage; finché non sono noti si usa l'origine da
 * cui l'app è stata caricata, che è per definizione un endpoint funzionante.
 */
function useEndpoint(): EndpointState & { shown: Shown } {
  const [state, setState] = useState<EndpointState | null>(null)

  useEffect(() => {
    const stored = loadEndpoints()
    const endpoints = { lan: stored.lan ?? window.location.origin, remote: stored.remote }
    const manager = createEndpointManager({ endpoints, onChange: setState })

    void manager.refresh().then(async (s) => {
      setState(s)
      // Raggiungibili → aggiorna la mappa degli endpoint (il tunnel può essere stato
      // acceso, spento o ricreato dall'ultima volta).
      if (s.kind !== 'offline') await learnEndpoints(s.baseUrl)
    })

    return () => manager.stop()
  }, [])

  return { ...(state ?? { kind: 'offline', baseUrl: '', since: 0 }), shown: state ? state.kind : 'checking' }
}

function App() {
  const { shown } = useEndpoint()

  return (
    <div className="ow-app">
      <header className="ow-head">
        <div className="ow-mark" aria-hidden="true">T</div>
        <div>
          <h1 className="ow-title">Tako Owner</h1>
          <div className="ow-sub">Il tuo ristorante, dal telefono</div>
        </div>
      </header>

      <div>
        <span className="ow-badge" data-state={BADGE_STATE[shown]} data-endpoint={shown}>
          <span className="dot" />
          {LABEL[shown]}
        </span>
      </div>

      <section className="ow-card">
        <h2>Fondamenta pronte</h2>
        <p>
          Questa è la shell dell&apos;app del ristoratore: viene servita dall&apos;appliance su
          <code> /owner/</code>, è compilata a build-time e installabile sulla schermata Home.
          Sala, ordini e cassa arrivano nelle fasi successive.
        </p>
      </section>

      <footer className="ow-foot">Tako · app owner</footer>
    </div>
  )
}

const mount = document.getElementById('root')
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
