import { io } from 'socket.io-client'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'

export const socket = io(SERVER_URL, { autoConnect: false, reconnectionAttempts: 10, reconnectionDelay: 1000 })

export function connectSocket(restaurantId: string) {
  if (!socket.connected) socket.connect()
  socket.emit('join:restaurant', restaurantId)
}

export function disconnectSocket() {
  socket.disconnect()
}
