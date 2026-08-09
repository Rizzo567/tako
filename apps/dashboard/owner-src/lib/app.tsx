// Stato condiviso dell'app: endpoint corrente, sessione, client API.
//
// Una sola fonte di verità per tre cose che ogni schermata deve poter dare per
// scontate: DOVE parlare (LAN o tunnel), CON QUALE token, e cosa fare quando il
// server risponde 401 (sessione revocata dalla dashboard → si torna al collegamento).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createApi, type Api } from './api'
import {
  createEndpointManager,
  learnEndpoints,
  loadEndpoints,
  type EndpointKind,
  type EndpointManager,
  type EndpointState,
} from './endpoint'
import { clearSession, loadSession, saveSession, type Session } from './session'

export type NetKind = EndpointKind | 'checking'

interface AppValue {
  net: NetKind
  base: string
  session: Session | null
  api: Api
  /** Ri-prova la selezione dell'endpoint adesso (pulsante sul badge di stato). */
  recheck: () => void
  setSession: (s: Session | null) => void
  logout: () => void
  /** true quando siamo online ma passiamo dal tunnel: alcune azioni fisiche si disabilitano. */
  remote: boolean
  online: boolean
}

const Ctx = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp fuori da <AppProvider>')
  return v
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => loadSession())
  const [endpoint, setEndpoint] = useState<EndpointState | null>(null)

  // Il token vive in un ref oltre che nello stato: il client API lo legge a ogni
  // richiesta senza dover essere ricreato quando la sessione cambia.
  const tokenRef = useRef<string | null>(session?.token ?? null)
  const baseRef = useRef<string>('')
  const managerRef = useRef<EndpointManager | null>(null)

  const setSession = useCallback((s: Session | null) => {
    tokenRef.current = s?.token ?? null
    setSessionState(s)
    if (s) saveSession(s)
    else clearSession()
  }, [])

  const logout = useCallback(() => setSession(null), [setSession])

  const api = useMemo(() => createApi({
    base: () => baseRef.current,
    token: () => tokenRef.current,
    // Revoca dalla dashboard o scadenza: si torna alla schermata di collegamento.
    // Non si ritenta: un token morto resta morto.
    onUnauthorized: () => setSession(null),
  }), [setSession])

  useEffect(() => {
    // L'origine da cui l'app è stata caricata NON si passa più come se fosse la LAN:
    // `resolveEndpoint` la sonda da sé e la classifica (rete locale o tunnel). Così
    // l'appliance raggiunta per IP risulta «in sala» e il tunnel resta «da remoto».
    const manager = createEndpointManager({
      endpoints: loadEndpoints(),
      token: tokenRef.current,
      onChange: (s) => { baseRef.current = s.baseUrl; setEndpoint(s) },
    })
    managerRef.current = manager

    void manager.refresh().then(async (s) => {
      baseRef.current = s.baseUrl
      setEndpoint(s)
      if (s.kind !== 'offline') await learnEndpoints(s.baseUrl, tokenRef.current)
    })

    return () => { manager.stop(); managerRef.current = null }
  }, [])

  const recheck = useCallback(() => {
    void managerRef.current?.refresh().then((s) => { baseRef.current = s.baseUrl; setEndpoint(s) })
  }, [])

  const net: NetKind = endpoint ? endpoint.kind : 'checking'

  const value: AppValue = {
    net,
    base: endpoint?.baseUrl ?? '',
    session,
    api,
    recheck,
    setSession,
    logout,
    remote: net === 'remote',
    online: net === 'lan' || net === 'remote',
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
