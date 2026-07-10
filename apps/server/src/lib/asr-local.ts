// ─────────────────────────────────────────────────────────────────────────────
// Bridge verso il worker ASR locale (mlx-whisper su Apple Silicon).
//
// Il worker è un daemon Python (asr/asr_worker.py) lanciato col python del venv
// ~/.tako/asr-venv. Protocollo JSONL su stdio. Il modello resta caricato in
// memoria nel processo Python: spawn una volta, richieste veloci dopo.
//
// Robustezza: se il worker crasha le richieste pendenti falliscono e il
// prossimo transcribeLocal() lo rilancia; se lo spawn fallisce, l'esito
// negativo è cacheato 60s per non ritentare in loop (il chiamante fa fallback
// sul cloud).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const READY_TIMEOUT_MS = 180_000   // primo avvio: warmup Metal (+ eventuale download modello)
const REQUEST_TIMEOUT_MS = 60_000
const SPAWN_FAIL_CACHE_MS = 60_000

function pythonPath(): string {
  const env = process.env['TAKO_ASR_PYTHON']
  if (env) return env
  return join(homedir(), '.tako', 'asr-venv', 'bin', 'python')
}

function workerPath(): string | null {
  const env = process.env['TAKO_ASR_WORKER']
  if (env && existsSync(env)) return env
  // 1) accanto al bundle (packaged: resources/server/asr/asr_worker.py)
  // 2) cwd (dev: apps/server → asr/asr_worker.py)
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), 'asr', 'asr_worker.py'),
    join(dirname(fileURLToPath(import.meta.url)), '..', 'asr', 'asr_worker.py'),
    join(process.cwd(), 'asr', 'asr_worker.py'),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

/** Il locale è utilizzabile? (venv + worker presenti — lo spawn resta lazy) */
export function localAsrAvailable(): boolean {
  return existsSync(pythonPath()) && workerPath() !== null
}

interface Pending {
  resolve: (text: string) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

let proc: ChildProcessWithoutNullStreams | null = null
let readyPromise: Promise<void> | null = null
const pending = new Map<string, Pending>()
let lastSpawnFailAt = 0

function teardown(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer)
    p.reject(new Error(`worker ASR locale terminato: ${reason}`))
  }
  pending.clear()
  proc = null
  readyPromise = null
}

function ensureWorker(): Promise<void> {
  if (readyPromise) return readyPromise
  if (Date.now() - lastSpawnFailAt < SPAWN_FAIL_CACHE_MS) {
    return Promise.reject(new Error('worker ASR locale non disponibile (fallito di recente)'))
  }
  const py = pythonPath()
  const worker = workerPath()
  if (!existsSync(py) || !worker) {
    return Promise.reject(new Error('ASR locale non installato (manca venv o worker) — esegui scripts/setup-local-asr.sh'))
  }

  readyPromise = new Promise<void>((resolve, reject) => {
    const p = spawn(py, [worker], { stdio: ['pipe', 'pipe', 'pipe'] })
    proc = p
    let stderrTail = ''
    let ready = false
    let buf = ''

    const readyTimer = setTimeout(() => {
      p.kill()
      lastSpawnFailAt = Date.now()
      reject(new Error('worker ASR locale: timeout in avvio (modello non pronto)'))
    }, READY_TIMEOUT_MS)

    p.stderr.on('data', (d) => { stderrTail = (stderrTail + d.toString()).slice(-800) })
    p.stdout.on('data', (d) => {
      buf += d.toString()
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let msg: any
        try { msg = JSON.parse(line) } catch { continue }  // rumore (progress bar HF, ecc.)
        if (msg.ready) {
          ready = true
          clearTimeout(readyTimer)
          resolve()
        } else if (msg.fatal) {
          clearTimeout(readyTimer)
          lastSpawnFailAt = Date.now()
          reject(new Error(`worker ASR locale: ${msg.fatal}`))
        } else if (msg.id && pending.has(msg.id)) {
          const req = pending.get(msg.id)!
          pending.delete(msg.id)
          clearTimeout(req.timer)
          if (msg.error) req.reject(new Error(msg.error))
          else req.resolve(String(msg.text ?? ''))
        }
      }
    })
    p.on('error', (e) => {
      clearTimeout(readyTimer)
      lastSpawnFailAt = Date.now()
      teardown(e.message)
      if (!ready) reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(readyTimer)
      const reason = `exit ${code}${stderrTail ? ` — ${stderrTail.slice(-200)}` : ''}`
      if (!ready) { lastSpawnFailAt = Date.now(); reject(new Error(`worker ASR locale: ${reason}`)) }
      teardown(reason)
    })
  })
  return readyPromise
}

/** Trascrive un WAV (PCM16 mono) col motore locale. Lancia se non disponibile. */
export async function transcribeLocalWav(wav: Buffer, language: string): Promise<string> {
  await ensureWorker()
  const p = proc
  if (!p) throw new Error('worker ASR locale non attivo')
  const id = randomBytes(8).toString('hex')
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('ASR locale: timeout richiesta'))
    }, REQUEST_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    p.stdin.write(JSON.stringify({ id, wav_b64: wav.toString('base64'), language }) + '\n')
  })
}

/** Pre-avvia il worker (fire-and-forget): il primo Cmd+K non paga il cold start. */
export function warmupLocalAsr(): void {
  if (!localAsrAvailable()) return
  ensureWorker().catch(() => {})  // l'esito negativo è già cacheato
}
