import type Anthropic from '@anthropic-ai/sdk'

// Context passed to every tool handler. Scopes what a tool can touch.
export interface ToolContext {
  restaurantId: string
  // Customer-side binding: a customer agent may only act on its own table/session.
  tableId?: string | null
  tableNumber?: string | null
  sessionId?: string | null
  // Staff-side binding.
  userId?: string | null
  role?: string | null
  // Side channel so a tool can surface a structured UI action (card) to the client.
  emit: (action: AgentAction) => void
}

// Structured UI hint emitted alongside the text answer. The client renders these
// as cards/buttons (e.g. an order summary, a created dish, a stat block).
export interface AgentAction {
  type: string
  [key: string]: unknown
}

export type ToolScope = 'customer' | 'staff' | 'owner'

export interface ToolDef {
  name: string
  description: string
  scope: ToolScope
  // Mutating/irreversible tools must be previewed first: when called without
  // input.confirm === true they return a preview and do NOT mutate.
  requiresConfirmation?: boolean
  inputSchema: Anthropic.Tool.InputSchema
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>()

  register(def: ToolDef) {
    this.tools.set(def.name, def)
    return this
  }

  registerAll(defs: ToolDef[]) {
    for (const d of defs) this.register(d)
    return this
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  // Tools visible to a given scope. owner sees everything; staff sees staff+customer;
  // customer sees only customer tools.
  forScope(scope: ToolScope): ToolDef[] {
    const visible = (t: ToolDef): boolean => {
      if (scope === 'owner') return true
      if (scope === 'staff') return t.scope !== 'owner'
      return t.scope === 'customer'
    }
    return [...this.tools.values()].filter(visible)
  }

  toAnthropicTools(scope: ToolScope): Anthropic.Tool[] {
    return this.forScope(scope).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }))
  }
}
