import { io } from 'socket.io-client'
import { useAuthStore } from './store'

// Connessione same-origin: il path /socket.io è inoltrato dal rewrite Next al
// server (:3001), così il browser allega il cookie HttpOnly tako_session del
// dashboard e il server autentica il join alla room dal cookie dell'handshake.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export const socket = io(ORIGIN, {
  path: '/socket.io',
  autoConnect: false,
  withCredentials: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 4000,
})

// Ultima room richiesta: ad OGNI (ri)connessione il socket ri-entra da solo,
// così un drop di rete o un reload non lascia il dashboard "muto".
let lastRestaurantId: string | null = null

function emitJoin() {
  if (!lastRestaurantId) return
  const token = useAuthStore.getState().token ?? undefined // fallback se il cookie non c'è
  socket.emit('join:restaurant', lastRestaurantId, token)
}

// Registrato una sola volta: 'connect' scatta sia alla prima connessione sia ad
// ogni riconnessione automatica → re-join garantito.
if (typeof window !== 'undefined') {
  socket.on('connect', emitJoin)
}

export function connectSocket(restaurantId: string) {
  lastRestaurantId = restaurantId
  if (!socket.connected) socket.connect()
  else emitJoin()
}

export function disconnectSocket() {
  lastRestaurantId = null
  socket.disconnect()
}
