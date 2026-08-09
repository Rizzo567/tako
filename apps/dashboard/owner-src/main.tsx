// Tako Owner — l'app del ristoratore.
//
// Vincoli di questa app, validi da qui in avanti:
//   - mobile-only: nessun ramo desktop (al contrario di staff/src/07-app-root.js)
//   - zero Babel a runtime: si compila a build-time, non nel browser
//   - stessa identità visiva della dashboard (owner-src/tokens.css + fonts.css)
//   - il token viaggia SEMPRE come Bearer, mai come cookie
import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider, useApp } from './lib/app'
import { LiveProvider } from './lib/live'
import { EnrollScreen } from './screens/enroll'
import { SalaScreen } from './screens/sala'
import { OrdiniScreen } from './screens/ordini'
import { CassaScreen } from './screens/cassa'
import { OggiScreen } from './screens/oggi'
import { AltroScreen } from './screens/altro'
import { BottomBar, Header, SECTIONS, type SectionId } from './ui/shell'

const LS_SECTION = 'tako.owner.section'

function initialSection(): SectionId {
  try {
    const v = localStorage.getItem(LS_SECTION)
    if (SECTIONS.some((s) => s.id === v)) return v as SectionId
  } catch { /* storage disabilitato: si parte dalla Sala */ }
  return 'sala'
}

/**
 * Compact-on-scroll della barra inferiore, con la stessa dead-zone di 6 px della
 * staff (03-shell-nav.js): senza, la barra tremola a ogni micro-movimento del dito.
 */
function useScrollCompact(ref: React.RefObject<HTMLDivElement | null>) {
  const [compact, setCompact] = useState(false)
  const last = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const t = el.scrollTop
      if (Math.abs(t - last.current) < 6) return
      setCompact(t > last.current && t > 40)
      last.current = t
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])
  return { compact, reset: () => setCompact(false) }
}

function Shell() {
  const { net, session, recheck } = useApp()
  const [section, setSection] = useState<SectionId>(initialSection)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { compact, reset } = useScrollCompact(scrollRef)

  const go = (id: SectionId) => {
    setSection(id)
    try { localStorage.setItem(LS_SECTION, id) } catch { /* best-effort */ }
    scrollRef.current?.scrollTo({ top: 0 })
    reset()
  }

  const title = section === 'altro'
    ? (session?.restaurant?.name ?? 'Tako')
    : SECTIONS.find((s) => s.id === section)!.label

  return (
    <div className="ow-app">
      <Header title={title} net={net} onNetClick={recheck} />
      <div className="ow-scroll" ref={scrollRef}>
        {section === 'sala' && <SalaScreen />}
        {section === 'ordini' && <OrdiniScreen />}
        {section === 'cassa' && <CassaScreen />}
        {section === 'oggi' && <OggiScreen />}
        {section === 'altro' && <AltroScreen />}
      </div>
      <BottomBar active={section} onGo={go} compact={compact} />
    </div>
  )
}

function Root() {
  const { session } = useApp()
  // Il socket vive SOLO dentro la sessione: senza token non c'è nessuna room in cui
  // entrare, e una connessione anonima è esattamente ciò che il gate di F1.3 rifiuta.
  return session
    ? <LiveProvider><Shell /></LiveProvider>
    : <EnrollScreen />
}

const mount = document.getElementById('root')
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <AppProvider>
        <Root />
      </AppProvider>
    </StrictMode>,
  )
}
