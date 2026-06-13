import { ToolRegistry } from './registry.js'
import { customerTools } from './tools/customer.js'
import { ownerTools } from './tools/owner.js'

export const registry = new ToolRegistry()
  .registerAll(customerTools)
  .registerAll(ownerTools)

export { runAgentTurn } from './agent.js'
export { customerSystem, ownerSystem } from './personas.js'
export { aiConfigured } from './provider.js'
