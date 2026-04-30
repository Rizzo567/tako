// ——— Socket.io event types ———

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
export type TableStatus = 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved'
export type UserRole = 'owner' | 'manager' | 'waiter' | 'chef' | 'cashier'

export interface SocketEvents {
  // Server → Client
  'order:new': (order: OrderPayload) => void
  'order:updated': (data: { orderId: string; status: OrderStatus; itemId?: string }) => void
  'table:updated': (data: { tableId: string; status: TableStatus }) => void
  'waiter:called': (data: { tableId: string; tableNumber: string; type: 'help' | 'bill' | 'water' }) => void
  'inventory:alert': (data: { itemId: string; name: string; quantity: number }) => void

  // Client → Server
  'join:restaurant': (restaurantId: string) => void
  'join:table': (tableId: string) => void
  'order:create': (order: CreateOrderPayload) => void
  'order:status': (data: { orderId: string; status: OrderStatus; userId: string }) => void
  'waiter:call': (data: { tableId: string; type: 'help' | 'bill' | 'water' }) => void
}

export interface OrderPayload {
  id: string
  tableId: string | null
  tableNumber: string | null
  type: 'table' | 'takeaway'
  status: OrderStatus
  total: number
  notes?: string
  items: OrderItemPayload[]
  createdAt: string
}

export interface OrderItemPayload {
  id: string
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
  notes?: string
  kitchenStation?: string
  status: 'pending' | 'preparing' | 'ready' | 'served'
}

export interface CreateOrderPayload {
  tableId?: string
  tableNumber?: string
  type: 'table' | 'takeaway'
  items: {
    menuItemId: string
    variantId?: string
    quantity: number
    notes?: string
  }[]
  notes?: string
  idempotencyKey: string
}

// ——— API response types ———

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  data?: never
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

// ——— Auth types ———

export interface AuthUser {
  id: string
  restaurantId: string
  name: string
  email: string
  role: UserRole
}

export interface AuthSession {
  user: AuthUser
  token: string
  expiresAt: string
}

// ——— Menu public types (for customer PWA) ———

export interface PublicMenu {
  id: string
  name: string
  sections: PublicSection[]
}

export interface PublicSection {
  id: string
  name: string
  items: PublicItem[]
}

export interface PublicItem {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  allergens: string[]
  tags: string[]
  available: boolean
  variants?: PublicVariant[]
}

export interface PublicVariant {
  id: string
  name: string
  priceModifier: number
}

export interface PublicRestaurant {
  id: string
  name: string
  slug: string
  logoUrl?: string
  primaryColor: string
  defaultLanguage: string
  languages: string[]
  aiEnabled: boolean
}

// ——— Menu Engineering / Insights ———

export type MenuQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown'

export interface MenuItemMetrics {
  menuItemId: string
  name: string
  totalQty: number
  totalRevenue: number
  avgPrice: number
  revenueShare: number
  velocityPerDay: number
  costPrice: number | null
  marginPercent: number | null
  isFeatured: boolean
  quadrant: MenuQuadrant
}

export type AiSuggestionType =
  | 'increase_price'
  | 'decrease_price'
  | 'feature'
  | 'reposition'
  | 'remove'
  | 'bundle'
  | 'cost_check'

export interface AiSuggestion {
  menuItemId: string
  itemName: string
  type: AiSuggestionType
  action: string
  reason: string
  estimatedMonthlyImpact: string
}
