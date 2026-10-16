/** Operational writes commit first. Edge consumers observe authorized DB snapshots,
 * not volatile socket events. This is not a push/outbox delivery guarantee. */
export const POLLING_EVENT_SNAPSHOTS = {
  'menu:updated': ['/api/menus', '/api/menus/:menuId', '/api/customer/restaurant/:restaurantId/menu'],
  'menu:item_availability': ['/api/menus/:menuId', '/api/customer/restaurant/:restaurantId/menu'],
  'order:new': ['/api/orders/active'],
  'order:updated': ['/api/orders/active', '/api/customer/orders/:orderId'],
  'table:updated': ['/api/tables/rooms'],
  'waiter:called': ['/api/tables/waiter-calls'],
  'waiter:resolved': ['/api/tables/waiter-calls'],
  'reservation:changed': ['/api/reservations'],
} as const
export type PersistedEvent = keyof typeof POLLING_EVENT_SNAPSHOTS
export type SocketDelivery = { to(room: string): { emit(event: string, payload: unknown): unknown } }
export function usesPollingDelivery(runtime = process.env.TAKO_EXECUTION_RUNTIME): boolean { return runtime === 'edge' }
export function deliverPersistedEvent(socket: SocketDelivery | undefined, room: string, event: PersistedEvent, payload: unknown, options: {
  persisted: boolean
  runtime?: string
  onError?: (error: unknown) => void
}) {
  if (usesPollingDelivery(options.runtime)) {
    if (!options.persisted) throw new Error('Polling delivery requires a committed database mutation')
    if (!Object.hasOwn(POLLING_EVENT_SNAPSHOTS,event)) throw new Error('Event has no supported polling snapshot')
    return { mode: 'polling' as const, snapshots: POLLING_EVENT_SNAPSHOTS[event] }
  }
  // A notification outage cannot turn an already committed write into an HTTP
  // failure and encourage clients to repeat that mutation.
  try {
    if (!socket) throw new Error('Socket delivery unavailable')
    socket.to(room).emit(event,payload)
    return { mode: 'socket' as const, delivered: true }
  } catch (error) {
    try { options.onError?.(error) } catch { /* logging cannot invalidate a committed write */ }
    return { mode: 'socket' as const, delivered: false }
  }
}
