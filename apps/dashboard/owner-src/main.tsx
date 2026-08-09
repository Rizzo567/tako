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

type Health = 'checking' | 'online' | 'offline'

const LABEL: Record<Health, string> = {
  checking: 'Verifico…',
  online: 'Appliance raggiungibile',
  offline: 'Appliance non raggiungibile',
}

/** Sonda /health: esiste già nel server e non richiede autenticazione. */
function useApplianceHealth(): Health {
  const [state, setState] = useState<Health>('checking')

  useEffect(() => {
    let alive = true
    const probe = async () => {
      try {
        const res = await fetch('/health', { cache: 'no-store' })
        if (alive) setState(res.ok ? 'online' : 'offline')
      } catch {
        if (alive) setState('offline')
      }
    }
    void probe()
    const timer = window.setInterval(() => void probe(), 15000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return state
}

function App() {
  const health = useApplianceHealth()

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
        <span className="ow-badge" data-state={health === 'checking' ? undefined : health}>
          <span className="dot" />
          {LABEL[health]}
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
