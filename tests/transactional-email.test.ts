import { describe, it, expect } from 'vitest'
import { emailCatalog } from '../apps/server/src/lib/transactional-email/catalog.js'
import { renderTransactionalEmail } from '../apps/server/src/lib/transactional-email/render.js'

const values = {
  nome_titolare: '<script>alert(1)</script>', nome_locale: 'Locale & Test', utente: 'qa@example.invalid',
  link_dashboard: 'https://example.invalid/staff/', link_menu: 'https://example.invalid/menu',
  numero_bot: '+390000000000', minuti_validita: '30', link_reset: 'https://example.invalid/reset?token=synthetic&x=1',
  data_ora: '19 ottobre 2026 alle 12:00', nuova_email: 'new@example.invalid',
  link_conferma: 'https://example.invalid/confirm', data_scadenza: '30 ottobre 2026',
  giorni_rimanenti: '7', link_abbonamento: 'https://example.invalid/billing', importo: '10,00 €',
  frequenza: 'mensile', data_prossimo_rinnovo: '30 novembre 2026', data_fine_accesso: '30 novembre 2026',
  titolo: 'Avviso', testo: '<img src=x onerror=alert(1)>', link_azione: 'https://example.invalid/action', etichetta_bottone: 'Leggi',
}

describe('transactional email catalog', () => {
  for (const id of Object.keys(emailCatalog) as (keyof typeof emailCatalog)[]) {
    it(`renders ${id} with escaped customer data and no unresolved tokens`, () => {
      const email = renderTransactionalEmail(id, values)
      expect(email.html).not.toMatch(/\{[a-z_]+\}/)
      expect(email.html).not.toContain('<script>')
      expect(email.html).not.toContain('<img src=x')
      expect(email.html).toContain('manuelrizzo474@gmail.com')
      expect(email.subject).not.toMatch(/[\r\n]/)
      expect(email.text).toBeTruthy()
    })
  }
  it('allows service notices without an action', () => {
    const email = renderTransactionalEmail('servizio', { nome_titolare: 'QA', titolo: 'Avviso', testo: 'Servizio ripristinato.' })
    expect(email.html).not.toContain('bgcolor=')
  })
  it('rejects a partial service action', () => expect(() => renderTransactionalEmail('servizio', { ...values, etichetta_bottone: '' })).toThrow('both'))
  it('rejects missing variables', () => expect(() => renderTransactionalEmail('reset-password', {})).toThrow('Missing'))
  it.each(['javascript:alert(1)', 'http://example.invalid', 'https://user:secret@example.invalid'])('rejects unsafe action %s', link_reset => {
    expect(() => renderTransactionalEmail('reset-password', { ...values, link_reset })).toThrow()
  })
  it('escapes query separators in HTML but preserves the raw action URL in text', () => {
    const email = renderTransactionalEmail('reset-password', values)
    expect(email.html).toContain('synthetic&amp;x=1')
    expect(email.text).toContain('synthetic&x=1')
  })
})
