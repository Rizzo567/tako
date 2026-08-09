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
import { CopilotScreen } from './screens/copilot'
import { PrenotazioniScreen } from './screens/prenotazioni'
import { MagazzinoScreen } from './screens/magazzino'
import { MenuScreen } from './screens/menu'
import { AndamentoScreen } from './screens/andamento'
import { PushPrompt } from './screens/notifiche'
import { BottomBar, Header, SECTIONS, SUBS, type SectionId, type SubId } from './ui/shell'

const LS_SECTION = 'tako.owner.section'

/** Sezione contenuta in una URL/fragment di deep-link ('/owner/#ordini'). */
function sectionFromUrl(url: string): SectionId | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  return SECTIONS.some((s) => s.id === hash) ? (hash as SectionId) : null
}

function initialSection(): SectionId {
  // Il deep-link della notifica VINCE sull'ultima sezione visitata: se il telefono si
  // è aperto perché il ristoratore ha toccato "Nuovo ordine", deve trovarsi negli
  // ordini — non dove era rimasto tre ore prima.
  const fromHash = sectionFromUrl(window.location.hash)
  if (fromHash) return fromHash
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
  // Sotto-schermata di Wave 2 aperta dall'hub "Altro" (null = nessuna). Non è una
  // sesta linguetta: vedi la nota su SUBS in ui/shell.tsx.
  const [sub, setSub] = useState<SubId | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { compact, reset } = useScrollCompact(scrollRef)

  const go = (id: SectionId) => {
    setSection(id)
    setSub(null)
    try { localStorage.setItem(LS_SECTION, id) } catch { /* best-effort */ }
    scrollRef.current?.scrollTo({ top: 0 })
    reset()
  }

  // Il tasto "indietro" fisico di Android deve chiudere la sotto-schermata, non
  // l'app: entrare in una sotto-schermata spinge una voce nella cronologia, uscirne
  // la consuma. Su iOS è la gesture di scorrimento dal bordo, stesso effetto.
  const openSub = (id: SubId) => {
    setSub(id)
    scrollRef.current?.scrollTo({ top: 0 })
    reset()
    try { history.pushState({ takoSub: id }, '', `#${id}`) } catch { /* best-effort */ }
  }
  const closeSub = () => {
    // history.back() fa scattare popstate, che è l'unico posto in cui si azzera
    // `sub`: così il tasto in alto e quello del telefono passano dalla stessa porta.
    if (history.state?.takoSub) history.back()
    else setSub(null)
  }
  useEffect(() => {
    const onPop = () => { setSub(null); reset() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep-link da una notifica toccata mentre l'app era GIÀ APERTA. Il service worker
  // manda la rotta invece di ricaricare la pagina: un reload butterebbe via lo stato
  // (il conto a metà, la lista già scorsa) proprio nel momento peggiore.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null
      if (data?.type !== 'tako:navigate' || !data.url) return
      const id = sectionFromUrl(data.url)
      if (id) go(id)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
    // `go` è stabile quanto basta: dipende solo da setter e ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const title = sub
    ? SUBS.find((s) => s.id === sub)!.label
    : section === 'altro'
      ? (session?.restaurant?.name ?? 'Tako')
      : SECTIONS.find((s) => s.id === section)!.label

  return (
    <div className="ow-app">
      <Header title={title} net={net} onNetClick={recheck} onBack={sub ? closeSub : undefined} />
      <div className="ow-scroll" ref={scrollRef}>
        {sub === 'copilot' && <CopilotScreen />}
        {sub === 'prenotazioni' && <PrenotazioniScreen />}
        {sub === 'magazzino' && <MagazzinoScreen />}
        {sub === 'menu' && <MenuScreen />}
        {sub === 'andamento' && <AndamentoScreen />}
        {!sub && section === 'sala' && <SalaScreen />}
        {!sub && section === 'ordini' && <OrdiniScreen />}
        {!sub && section === 'cassa' && <CassaScreen />}
        {!sub && section === 'oggi' && <OggiScreen />}
        {!sub && section === 'altro' && <AltroScreen onOpen={openSub} />}
      </div>
      <BottomBar active={section} onGo={go} compact={compact} />
      {/* Vive nella shell e non in una schermata: deve poter comparire qualunque
          sezione sia aperta, perché l'evento che lo fa scattare arriva da solo. */}
      <PushPrompt />
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
