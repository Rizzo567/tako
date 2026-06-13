import Anthropic from '@anthropic-ai/sdk'

// Default model for the Tako assistant. Haiku 4.5 is fast enough for a live
// ordering flow and reliable at tool use; override with TAKO_AI_MODEL.
export const AI_MODEL = process.env['TAKO_AI_MODEL'] ?? 'claude-haiku-4-5'

let _client: Anthropic | null = null

/** Returns the Anthropic client, or null if no key is configured. */
export function getAnthropic(): Anthropic | null {
  const key = process.env['ANTHROPIC_API_KEY']
  if (!key) return null
  if (!_client) _client = new Anthropic({ apiKey: key })
  return _client
}

export function aiConfigured(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'])
}
