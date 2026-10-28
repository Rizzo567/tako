// Verifica avversaria X della fase A (A6.4, 17/10/2026): sonde unitarie sulle cause dei GRAVI trovati da tests/eval/eval-adv-a.test.ts.
// Ogni test descrive il comportamento GIUSTO: oggi sono rossi (gap del codice), vanno verdi con i fix. Disattivato di default per non
// cambiare il conteggio dei rossi noti della suite:  TAKO_ADV=1 npx vitest run tests/owner-brain-adv-a.test.ts
// Report: docs/webapp/bot-correzioni-2026-10-17/avversaria/REPORT-X.md
import {describe,expect,it} from 'vitest'
import {g9Prices} from '../apps/server/src/lib/twilio-menu-ai.js'
import {mixedMessage} from '../apps/server/src/lib/owner-brain-plan.js'
import {parseIntent,sameWord} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {parseCreate} from '../apps/server/src/lib/twilio-menu-create.js'

const secs=[{id:'s1',name:'Piatti di prova',menu:'Menu'}] as any

describe.skipIf(!process.env.TAKO_ADV)('avversaria X: cause dei GRAVI (fase A)',()=>{
 // X-G1 (adv-relativi-*, adv-prezzi-013/015, adv-deixis-008): «alza/abbassa/aumenta di N» → il validatore accetta N come prezzo assoluto.
 it.each(['aumenta la gricia di 1 euro','alza la gricia di 1 euro','abbassa la tagliata di 2 euro','la gricia +1','alla carbonara togli 2 euro'])('«%s»: N è una differenza, non un prezzo detto',m=>{
  const n=Number(m.match(/\d+/)![0]);expect(g9Prices(m)).not.toContain(n)})
 // X-G2 (adv-cent2-*, adv-parole-005/015, adv-centesimi-013): la parte intera (o i centesimi da soli) di un prezzo coi centesimi vale come «detta».
 it.each([['la carbonara tredici e novanta',13,90],['la carbonara 13 virgola 50',13,50],['il tiramisù a 7 euro 90',7,90],['la gricia undici e novanta',11,90]])('«%s»: mai %d né %d da soli',(m,a,b)=>{
  const p=g9Prices(m);expect(p).not.toContain(a);expect(p).not.toContain(b)})
 // X-G3 (adv-toglieuro-001..003, adv-relativi-004): «togli N euro alla X» diventa «nascondi X».
 it.each(['togli 2 euro alla tagliata','togli 1 euro alla carbonara','leva 2 euro alla tagliata'])('«%s»: non è nascondere',m=>{
  const i=parseIntent(m) as any;expect(i?.kind).not.toBe('hidden')})
 // X-G4 (adv-suono-001/002/007, adv-lev1-001, adv-asr-021/022): parole a una lettera da un nome valgono come la stessa parola.
 it.each([['torna','torta'],['pollo','polpo'],['tolta','torta'],['torno','tonno']])('«%s» non è «%s»',(a,b)=>{expect(sameWord(a,b)).toBe(false)})
 // X-G5 (adv-nomi-008/026/027/030, adv-code-*): code di cortesia/menu/tempo restano nel nome del piatto nuovo.
 it.each(['aggiungi la burrata a 9 se puoi','aggiungi la burrata a 9 dai','aggiungi la burrata a 9 va bene?','aggiungi la burrata a 9 nel menu','aggiungi la burrata a 9 per stasera','aggiungi la burrata a 9 da domani','aggiungi la burrata a 9 che ne dici?','aggiungi al menu la burrata a 9','inserisci sul menu la burrata a 9','aggiungi nella lista la burrata a 9'])('«%s» → nome «Burrata»',m=>{
  expect(parseCreate(m,secs)?.name).toBe('Burrata')})
 // X-M1 (adv-misti-001/002/003/012, adv-misti2-*): misti modifica + domanda non riconosciuti → la modifica si perde senza dirlo.
 it.each(['metti la carbonara a 13, e la gricia quanto la tengo?',"la tagliata è finita, il polpo c'è ancora?",'nascondi la bomba. quanti piatti ho nei primi?','la carbonara a 13, e la gricia quanto costa?',"la tagliata è finita, ma il polpo c'è?"])('«%s» è un misto',m=>{expect(mixedMessage(m)).not.toBeNull()})
})
