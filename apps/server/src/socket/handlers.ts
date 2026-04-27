import type { Server } from 'socket.io'

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    // Staff: join restaurant room
    socket.on('join:restaurant', (restaurantId: string) => {
      socket.join(`restaurant:${restaurantId}`)
    })

    // Customer: join table room for order tracking
    socket.on('join:table', (tableId: string) => {
      socket.join(`table:${tableId}`)
    })

    socket.on('disconnect', () => {
      // Socket.io handles room cleanup automatically
    })
  })
}
