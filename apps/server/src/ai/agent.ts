import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, AI_MODEL } from './provider.js'
import type { ToolRegistry, ToolScope, ToolContext, AgentAction } from './registry.js'

export interface AgentTurnInput {
  scope: ToolScope
  system: string
  history: { role: 'user' | 'assistant'; content: string }[]
  message: string
  ctx: Omit<ToolContext, 'emit'>
  registry: ToolRegistry
}

export interface AgentTurnResult {
  message: string
  actions: AgentAction[]
}

const MAX_STEPS = 6

/**
 * One assistant turn: runs the Anthropic tool-use loop, executing tool handlers
 * server-side until the model produces a final text answer. Tool handlers may
 * emit structured `actions` (cards) that the client renders.
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const client = getAnthropic()
  if (!client) throw new Error('AI_NOT_CONFIGURED')

  const actions: AgentAction[] = []
  const ctx: ToolContext = { ...input.ctx, emit: (a) => actions.push(a) }

  const tools = input.registry.toAnthropicTools(input.scope)

  const messages: Anthropic.MessageParam[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ]

  let finalText = ''

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system: input.system,
      tools,
      messages,
    })

    // Collect any text the model produced this step.
    const stepText = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (stepText) finalText = stepText

    if (res.stop_reason !== 'tool_use') break

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) break

    // Preserve the assistant turn (tool_use blocks) before sending results.
    messages.push({ role: 'assistant', content: res.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      const def = input.registry.get(use.name)
      let payload: unknown
      let isError = false
      if (!def || !input.registry.forScope(input.scope).some((t) => t.name === use.name)) {
        payload = { error: 'Strumento non disponibile in questo contesto.' }
        isError = true
      } else {
        try {
          payload = await def.handler((use.input ?? {}) as Record<string, unknown>, ctx)
        } catch (err) {
          payload = { error: err instanceof Error ? err.message : 'Errore strumento.' }
          isError = true
        }
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(payload),
        is_error: isError,
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return { message: finalText || 'Fatto.', actions }
}
