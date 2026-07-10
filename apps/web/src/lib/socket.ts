import { io, type Socket } from 'socket.io-client'

// Socket cliente condiviso, same-origin (inoltrato dal rewrite Next al server).
// Singleton: una sola connessione per tab, con riconnessione automatica e
// re-join della table room ad ogni (ri)connessione — il tracking resta vivo
// anche dopo un drop di rete o un cambio Wi-Fi/4G.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002'

export const socket: Socket = io(ORIGIN, {
  path: '/socket.io',
  autoConnect: false,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 4000,
})

let joinedTableId: string | null = null
let joinedMenuRestaurantId: string | null = null
let joinedOrderId: string | null = null

function emitJoin() {
  if (joinedTableId) socket.emit('join:table', joinedTableId)
  if (joinedMenuRestaurantId) socket.emit('join:menu', joinedMenuRestaurantId)
  if (joinedOrderId) socket.emit('join:order', joinedOrderId)
}

if (typeof window !== 'undefined') {
  socket.on('connect', emitJoin) // re-join garantito ad ogni riconnessione
}

// Entra (o resta) nella room del tavolo. Idempotente.
export function joinTable(tableId: string) {
  joinedTableId = tableId
  if (!socket.connected) socket.connect()
  else emitJoin()
}

// Entra nella room PUBBLICA del menu (disponibilità/prezzi live). Idempotente.
export function joinMenu(restaurantId: string) {
  joinedMenuRestaurantId = restaurantId
  if (!socket.connected) socket.connect()
  else emitJoin()
}

// Entra nella room del PROPRIO ordine asporto (nessun tavolo → nessuna table room).
// Il server autorizza via JWT asporto (sid). Idempotente; re-join a ogni riconnessione.
export function joinOrder(orderId: string) {
  joinedOrderId = orderId
  if (!socket.connected) socket.connect()
  else emitJoin()
}

export function leaveTableSocket() {
  joinedTableId = null
  joinedMenuRestaurantId = null
  joinedOrderId = null
  socket.disconnect()
}
