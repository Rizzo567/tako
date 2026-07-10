// ─────────────────────────────────────────────────────────────────────────────
// Layer di CLEANUP del trascritto — la "magia" della dettatura moderna.
//
// Prende il testo grezzo dell'ASR e lo ripulisce: via i filler (ehm, cioè…),
// punteggiatura e maiuscole corrette, false partenze riparate. Il significato
// non si tocca. Due backend, fallback automatico:
//   • LOCALE — Ollama (http://localhost:11434), modello preferito qwen2.5:7b
//     (o TAKO_CLEANUP_MODEL), temperature 0.1.
//   • CLOUD  — Groq chat (llama-3.1-8b-instant), stessa consegna.
// Se entrambi falliscono → si restituisce il testo grezzo: il cleanup non deve
// MAI bloccare la dettatura.
// ─────────────────────────────────────────────────────────────────────────────
import OpenAI from 'openai'

export type CleanupEngine = 'ollama' | 'groq' | 'none'

export interface CleanupResult {
  text: string
  engine: CleanupEngine
  ms: number
}

// URL letto a runtime (non a import-time): TAKO_OLLAMA_URL può cambiare.
function ollamaUrl(): string {
  return process.env['TAKO_OLLAMA_URL'] ?? 'http://127.0.0.1:11434'
}
const OLLAMA_TIMEOUT_MS = 20_000
const GROQ_TIMEOUT_MS = 10_000
// Preferenza modelli locali per il cleanup (primo presente vince).
const PREFERRED_MODELS = ['qwen2.5:7b', 'gemma2:9b', 'qwen2.5:14b', 'llama3.1:8b']

const SYSTEM_PROMPT =
  'Sei il correttore di una dettatura vocale in italiano. Ricevi il trascritto grezzo. ' +
  'Correggi punteggiatura e maiuscole, togli i filler (ehm, uhm, cioè, tipo, allora se usati come riempitivo), ' +
  'ripara le false partenze e le autocorrezioni del parlante. NON cambiare il significato, NON aggiungere nulla, ' +
  'NON rispondere a domande contenute nel testo. Rispondi SOLO col testo pulito, senza virgolette né commenti.'

// ── Ollama ───────────────────────────────────────────────────────────────────
interface OllamaTag { name: string }
// Cache del modello scelto, legata all'URL (se l'URL cambia, il check si rifà).
let modelCache: { url: string; model: string | null; at: number } = { url: '', model: null, at: 0 }

async function pickOllamaModel(): Promise<string | null> {
  const url = ollamaUrl()
  const envModel = process.env['TAKO_CLEANUP_MODEL']
  if (modelCache.url === url && Date.now() - modelCache.at < 30_000) return modelCache.model
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 2_000)
    const res = await fetch(`${url}/api/tags`, { signal: ac.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`tags ${res.status}`)
    const data = (await res.json()) as { models?: OllamaTag[] }
    const names = (data.models ?? []).map((m) => m.name)
    let chosen: string | null = null
    if (envModel && names.some((n) => n === envModel || n.startsWith(envModel + ':'))) chosen = envModel
    else chosen = PREFERRED_MODELS.find((p) => names.some((n) => n === p)) ?? names[0] ?? null
    modelCache = { url, model: chosen, at: Date.now() }
    return chosen
  } catch {
    modelCache = { url, model: null, at: Date.now() }
    return null
  }
}

async function cleanupOllama(raw: string): Promise<string> {
  const model = await pickOllamaModel()
  if (!model) throw new Error('Ollama non raggiungibile o senza modelli')
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), OLLAMA_TIMEOUT_MS)
  try {
    const res = await fetch(`${ollamaUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: raw },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Ollama chat ${res.status}`)
    const data = (await res.json()) as { message?: { content?: string } }
    return sanitize(data.message?.content ?? '')
  } finally {
    clearTimeout(t)
  }
}

// ── Groq ─────────────────────────────────────────────────────────────────────
let groqClient: OpenAI | null = null
let groqClientKey = ''
function getGroq(): OpenAI {
  const key = process.env['GROQ_API_KEY']
  if (!key) throw new Error('GROQ_API_KEY non configurata')
  if (!groqClient || groqClientKey !== key) {
    groqClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1', timeout: GROQ_TIMEOUT_MS })
    groqClientKey = key
  }
  return groqClient
}

async function cleanupGroq(raw: string): Promise<string> {
  const client = getGroq()
  const res = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: raw },
    ],
  })
  return sanitize(res.choices[0]?.message?.content ?? '')
}

// Difesa dalla loquacità degli LLM: via virgolette avvolgenti e prefissi tipo
// "Testo pulito:". Se il modello restituisce vuoto, il chiamante usa il grezzo.
function sanitize(out: string): string {
  let t = out.trim()
  t = t.replace(/^(testo pulito|testo corretto|output|risultato)\s*:\s*/i, '')
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('«') && t.endsWith('»'))) {
    t = t.slice(1, -1).trim()
  }
  return t
}

export function getCleanupStatus(): { local: boolean; cloud: boolean } {
  // "local" qui = Ollama raggiungibile all'ultimo check (cache 30s, best-effort)
  return { local: modelCache.model !== null, cloud: !!process.env['GROQ_API_KEY'] }
}

/**
 * Ripulisce il trascritto. Ordine: Ollama locale → Groq cloud → testo grezzo.
 * Non lancia MAI: nel peggiore dei casi torna il grezzo con engine 'none'.
 */
export async function cleanupText(raw: string): Promise<CleanupResult> {
  const started = Date.now()
  const trimmed = raw.trim()
  // Testi brevissimi: il cleanup non aggiunge valore, evita latenza inutile.
  if (trimmed.length < 3) return { text: trimmed, engine: 'none', ms: 0 }

  const order: Array<'ollama' | 'groq'> =
    process.env['TAKO_CLEANUP_PREFER'] === 'cloud' ? ['groq', 'ollama'] : ['ollama', 'groq']

  for (const engine of order) {
    try {
      const text = engine === 'ollama' ? await cleanupOllama(trimmed) : await cleanupGroq(trimmed)
      if (text) return { text, engine, ms: Date.now() - started }
    } catch { /* prova il prossimo */ }
  }
  return { text: trimmed, engine: 'none', ms: Date.now() - started }
}
