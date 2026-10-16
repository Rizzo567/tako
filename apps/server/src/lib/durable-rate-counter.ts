import { createHmac } from 'node:crypto'

/** Only the fixed-window contract is implemented. Not wired into production yet. */
export type CounterResult = { current: number; ttl: number; iterationStartMs: number }
export type CounterExecutor = (namespace: string, keyHash: string, windowMs: number) => Promise<CounterResult>
export class DurableRateCounter {
  constructor(private execute: CounterExecutor, private secret: string, private namespace: string) {
    if (secret.length < 32) throw new Error('Durable counters require a dedicated secret of at least 32 characters')
    if (!namespace || namespace.length > 200) throw new Error('Invalid counter namespace')
  }
  async consume(key: string, windowMs: number): Promise<CounterResult> {
    if (!Number.isSafeInteger(windowMs) || windowMs < 1 || windowMs > 86400000) throw new Error('Invalid counter window')
    const keyHash = createHmac('sha256', this.secret).update(`tako-rate-v1:${this.namespace}\0${key}`).digest('hex')
    let result: CounterResult
    try { result = await this.execute(this.namespace, keyHash, windowMs) }
    catch {
      // A lost database response may already have consumed a hit. Retrying is conservative:
      // it can count twice, but never bypasses the limiter or lets an unverified request through.
      await new Promise(resolve=>setTimeout(resolve,150))
      try { result = await this.execute(this.namespace,keyHash,windowMs) }
      catch { throw Object.assign(new Error('Controllo accessi temporaneamente non disponibile'), { statusCode: 503, code: 'RATE_STORE_UNAVAILABLE' }) }
    }
    if (!Number.isSafeInteger(result.current) || result.current < 1 || !Number.isFinite(result.ttl) || result.ttl < 0 || result.ttl > windowMs || !Number.isFinite(result.iterationStartMs)) {
      throw Object.assign(new Error('Invalid durable counter response'), { statusCode: 503, code: 'RATE_STORE_UNAVAILABLE' })
    }
    return result
  }
}
