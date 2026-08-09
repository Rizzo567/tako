// Realtime: un solo socket per tutta l'app.
//
// Tre cose che qui non sono dettagli:
//
//  • AUTENTICAZIONE. Il socket entra nella room con `join:restaurant(restaurantId,
//    token)` — la via che funziona senza cookie (socket/handlers.ts). In più il token
//    viaggia in QUERY (`?token=`) nell'handshake: dal tunnel il gate di F1.3 filtra
//    anche le connessioni socket, e la query è l'unico canale che un browser ha
//    all'upgrade WebSocket (un header Authorization non si può impostare).
//  • RICONNESSIONE = RICARICA. Alla RI-connessione (non alla prima) le schermate
//    devono rifare il fetch: mentre eravamo scollegati sono successe cose che nessun
//    evento ci racconterà più. È lo stesso pattern della dashboard staff (01-data.js).
//  • REVOCA. Il server rivalida la sessione del socket ogni 60 s e chiude quelli
//    revocati; qui non serve altro che accorgersene.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useApp } from './app'

type Handler = (payload: Record<string, unknown>) => void

interface LiveValue {
  connected: boolean
  /** Iscrive un handler a un evento del server. Ritorna la funzione di disiscrizione. */
  on: (event: string, fn: Handler) => () => void
  /** Iscrive un handler alla RI-connessione (ricarica completa dei dati). */
  onReload: (fn: () => void) => () => void
}

const Ctx = createContext<LiveValue | null>(null)

export function useLive(): LiveValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLive fuori da <LiveProvider>')
  return v
}

/** Iscrizione a un evento, con pulizia automatica. */
export function useLiveEvent(event: string, fn: Handler): void {
  const live = useLive()
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => live.on(event, (p) => ref.current(p)), [live, event])
}

/** Ricarica completa dei dati a ogni RI-connessione. */
export function useLiveReload(fn: () => void): void {
  const live = useLive()
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => live.onReload(() => ref.current()), [live])
}

// Gli eventi staff che l'app owner ascolta. Elenco esplicito: un socket che si
// iscrive "a tutto" riceverebbe anche traffico che non sa gestire.
const EVENTS = [
  'order:new',
  'order:updated',
  'table:updated',
  'waiter:called',
  'waiter:resolved',
  'inventory:alert',
  // Wave 2 (F4.2): la disponibilità cambiata da un altro telefono, dalla dashboard o
  // dall'assistente deve vedersi anche qui. È lo STESSO evento che riceve il cliente
  // al tavolo (room pubblica `menu:{id}`), emesso da routes/menu.ts.
  'menu:item_availability',
  'menu:updated',
  // Wave 3 (F5.2/F5.3): la sera cambia anche da altre mani — la dashboard, il
  // cliente che prenota, un altro telefono che timbra. Sono gli stessi eventi che
  // routes/reservations.ts e routes/shifts.ts emettono già nella room del ristorante.
  'reservation:changed',
  'shift:updated',
  'connectivity',
]

export function LiveProvider({ children }: { children: ReactNode }) {
  const { session, base, online } = useApp()
  const [connected, setConnected] = useState(false)
  const handlers = useRef(new Map<string, Set<Handler>>())
  const reloaders = useRef(new Set<() => void>())

  useEffect(() => {
    const token = session?.token
    const restaurantId = session?.restaurant?.id
    if (!token || !restaurantId || !online) return

    const socket: Socket = io(base || window.location.origin, {
      transports: ['websocket', 'polling'],
      // In query perché è l'unico canale disponibile all'handshake di un browser
      // (vedi socketAllowRequest in middleware/remoteGate.ts).
      query: { token },
      reconnectionDelay: 800,
      reconnectionDelayMax: 6000,
    })

    let firstConnect = true
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join:restaurant', restaurantId, token)
      if (firstConnect) firstConnect = false
      else for (const fn of reloaders.current) fn()
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    for (const ev of EVENTS) {
      socket.on(ev, (payload: Record<string, unknown>) => {
        for (const fn of handlers.current.get(ev) ?? []) fn(payload ?? {})
      })
    }

    return () => { socket.close(); setConnected(false) }
  }, [session?.token, session?.restaurant?.id, base, online])

  const value: LiveValue = {
    connected,
    on: (event, fn) => {
      const set = handlers.current.get(event) ?? new Set<Handler>()
      set.add(fn)
      handlers.current.set(event, set)
      return () => { set.delete(fn) }
    },
    onReload: (fn) => {
      reloaders.current.add(fn)
      return () => { reloaders.current.delete(fn) }
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
