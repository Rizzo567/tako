import {describe,it,expect} from 'vitest'
import {renderTransactionalEmail} from '../apps/server/src/lib/transactional-email/render.js'
import {emailCatalog} from '../apps/server/src/lib/transactional-email/catalog.js'
const v={nome_titolare:'Manuel',nome_locale:'Locale QA',utente:'qa@example.invalid',link_dashboard:'https://example.invalid/staff/',link_menu:'https://example.invalid/menu',numero_bot:'+390000000000',minuti_validita:'30',link_reset:'https://example.invalid/reset?token=synthetic&x=1',data_ora:'23 ottobre 2026',nuova_email:'nuova@example.invalid',link_conferma:'https://example.invalid/confirm',titolo:'Avviso QA',testo:'Un aggiornamento\nDue righe'}
describe('approved email design integration',()=>{
 for(const id of Object.keys(emailCatalog) as (keyof typeof emailCatalog)[])it(id+' uses operational table layout without demo code or relative assets',()=>{
  const {html}=renderTransactionalEmail(id,v)
  expect(html).toContain('x-takomenu-email-design')
  expect(html).toContain('20261023')
  expect(html).toContain('#19434c')
  expect(html).toContain('#f16a4c')
  expect(html).not.toMatch(/<script|<button|<dialog|<svg|data-demo|src="assets\/|\{[a-z_]+\}/)
  expect(Buffer.byteLength(html)).toBeLessThan(90000)
  expect(html).not.toContain('Iscrivimi')
  expect(html).not.toContain('Victoria Bar è pronto')
 })
 it('preserves reset token destination without linking to a demo',()=>{
  const r=renderTransactionalEmail('reset-password',v);expect(r.html).toContain('href="https://example.invalid/reset?token=synthetic&amp;x=1"');expect(r.text).toContain(v.link_reset)
 })
 it('does not fabricate credentials or announce delivery over WhatsApp',()=>{
  const r=renderTransactionalEmail('benvenuto',v);expect(r.html).toContain(v.utente);expect(r.html).not.toContain('La password ti arriva su WhatsApp');expect(r.html).not.toContain('password_temporanea');expect(r.html).toContain('Password dimenticata')
 })
 it('escapes optional temporary credentials supplied by the caller',()=>{
  const r=renderTransactionalEmail('benvenuto',{...v,password_temporanea:'<fake&synthetic>'});expect(r.html).toContain('&lt;fake&amp;synthetic&gt;');expect(r.html).not.toContain('<fake')
 })
 it('rejects non HTTPS or credential-bearing asset bases',()=>{
  for(const base of ['http://bad.invalid','https://user:secret@example.invalid'])expect(()=>renderTransactionalEmail('reset-password',v,undefined,base)).toThrow()
 })
})
