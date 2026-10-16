import { describe, it, expect, vi, afterEach } from 'vitest'
import { ocrOnboardingImage, ocrOnboardingPdf } from '../apps/server/src/lib/onboarding-ocr.js'
const image = Buffer.from('image'), pdf = Buffer.from('%PDF-1.7\n')
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
describe('onboarding OCR adapters', () => {
  it('sends transcription-only image payload and conserves visible prices', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Pasta — 12 €' } }] })); vi.stubGlobal('fetch', fetcher)
    expect(await ocrOnboardingImage(image, 'image/png', 'private-key')).toBe('Pasta — 12 €')
    const request = fetcher.mock.calls[0]![1], body = JSON.parse(request.body)
    expect(body.max_completion_tokens).toBe(4000)
    expect(body.messages[0].content[0].text).toContain('Non aggiungere')
    expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/)
    expect(request.redirect).toBe('error')
  })
  it('sends inline PDF to fixed Google endpoint and omits thought parts', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'thinking', thought: true }, { text: 'Risotto 14 €' }] } }] })); vi.stubGlobal('fetch', fetcher)
    expect(await ocrOnboardingPdf(pdf, 'secret')).toBe('Risotto 14 €')
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).contents[0].parts[1].inline_data.mime_type).toBe('application/pdf')
  })
  it('never fabricates OCR when keys or valid media are missing', async () => {
    vi.stubEnv('GROQ_API_KEY', ''); vi.stubEnv('GEMINI_API_KEY', '')
    await expect(ocrOnboardingImage(image, 'image/png')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    await expect(ocrOnboardingPdf(pdf)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    await expect(ocrOnboardingPdf(image, 'secret')).rejects.toMatchObject({ code: 'INVALID_MEDIA' })
    await expect(ocrOnboardingImage(Buffer.alloc(8 * 1024 * 1024 + 1), 'image/png', 'secret')).rejects.toMatchObject({ code: 'INVALID_MEDIA' })
  })
  it.each([{}, { choices: [{ message: { content: 42 } }] }, { choices: [{ finish_reason: 'length', message: { content: 'truncated' } }] }])('rejects malformed or truncated provider results', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
    await expect(ocrOnboardingImage(image, 'image/png', 'secret')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('does not expose provider error bodies or network details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-key-leaked-here', { status: 429 })))
    await expect(ocrOnboardingImage(image, 'image/png', 'secret')).rejects.toThrow('429')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret-key-leaked-here')))
    await expect(ocrOnboardingImage(image, 'image/png', 'secret')).rejects.not.toThrow('secret-key')
  })
  it('aborts provider requests within a bounded timeout', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))))
    const result = expect(ocrOnboardingImage(image, 'image/png', 'secret')).rejects.toThrow('troppo tempo')
    await vi.advanceTimersByTimeAsync(25001); await result
  })
  it('rejects oversized provider response bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(129 * 1024))))
    await expect(ocrOnboardingImage(image, 'image/png', 'secret')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
