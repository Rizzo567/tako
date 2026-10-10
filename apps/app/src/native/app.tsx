// Stato condiviso del port nativo — versione RN di owner-src/lib/app.tsx.
//
// Una sola fonte di verità per le tre cose che ogni schermata dà per scontate:
// DOVE parlare (endpoint LAN-first di src/endpoint.ts), CON QUALE token (sessione
// nativa in AsyncStorage), e cosa fare sul 401 (sessione revocata → si torna al
// collegamento, che qui significa session = null e l'index rimanda alla WebView
// o all'enroll).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { configuredOverride, loadConfig, resolveEndpoint, type EndpointKind } from '../endpoint'
import { createApi, type Api } from './api'
import { clearNativeSession, saveNativeSession, type Session } from './session'

export type NetKind = EndpointKind | 'checking' | 'offline'

interface AppValue {
  net: NetKind
  base: string
  session: Session | null
  api: Api
  /** Ri-prova la selezione dell'endpoint adesso. */
  recheck: () => void
  setSession: (s: Session | null) => void
  logout: () => void
  remote: boolean
  online: boolean
}

const Ctx = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp fuori da <NativeAppProvider>')
  return v
}

export function NativeAppProvider({ children, initialSession, initialBase }: {
  children: ReactNode
  /** Sessione già caricata dall'index (che decide nativo vs WebView). */
  initialSession: Session | null
  /** Base già risolta dall'index: si parte da qui senza ri-sondare. */
  initialBase: string
}) {
  const [session, setSessionState] = useState<Session | null>(initialSession)
  const [net, setNet] = useState<NetKind>(initialBase ? 'lan' : 'checking')
  const [base, setBase] = useState(initialBase)

  const tokenRef = useRef<string | null>(initialSession?.token ?? null)
  const baseRef = useRef<string>(initialBase)

  const setSession = useCallback((s: Session | null) => {
    tokenRef.current = s?.token ?? null
    setSessionState(s)
    if (s) void saveNativeSession(s)
    else void clearNativeSession()
  }, [])

  const logout = useCallback(() => setSession(null), [setSession])

  const api = useMemo(() => createApi({
    base: () => baseRef.current,
    token: () => tokenRef.current,
    // Revoca dalla dashboard o scadenza: un token morto resta morto, non si ritenta.
    onUnauthorized: () => setSession(null),
  }), [setSession])

  const recheck = useCallback(() => {
    void (async () => {
      setNet('checking')
      const override = configuredOverride()
      if (override) {
        baseRef.current = override
        setBase(override)
        setNet('manual')
        return
      }
      const found = await resolveEndpoint(await loadConfig())
      if (found) {
        baseRef.current = found.baseUrl
        setBase(found.baseUrl)
        setNet(found.kind)
      } else {
        setNet('offline')
      }
    })()
  }, [])

  // La base iniziale viene dall'index già sondata: qui si riclassifica solo
  // (lan/manual/remote) senza bloccare il primo render delle schermate.
  useEffect(() => { recheck() }, [recheck])

  const value: AppValue = {
    net,
    base,
    session,
    api,
    recheck,
    setSession,
    logout,
    remote: net === 'remote',
    online: net === 'lan' || net === 'manual' || net === 'remote',
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
