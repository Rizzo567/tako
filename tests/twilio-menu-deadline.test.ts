import {describe,expect,it,vi,afterEach} from 'vitest'
import {beginWrite,raceDeadline,type WriteBudget} from '../apps/server/src/lib/twilio-menu-command.js'
// notte 22/10 (sicurezza dati): «non disponibile / non ho cambiato nulla» allo scadere del tempo MAI con il menu che cambia dopo.
const DOWN='Sono momentaneamente non disponibile, riprova tra un minuto.'
afterEach(()=>{vi.useRealTimers()})
// Turno finto: modello lento (modelMs), poi la scrittura (writeMs) solo se beginWrite lo permette; ritorna i fatti scritti.
function turn(b:WriteBudget,menu:{price:number},modelMs:number,writeMs:number){return (async()=>{await new Promise(r=>setTimeout(r,modelMs));if(!beginWrite(b))throw new Error('expired');await new Promise(r=>setTimeout(r,writeMs));if(b.expired)throw new Error('expired');menu.price=10;return 'prezzo da 9,00 € a *10,00 €*'})().catch(()=>'')}
describe('tempo massimo del turno e scritture',()=>{
 it('modello più lento del tempo massimo: testo fisso e nessuna scrittura, nemmeno dopo',async()=>{vi.useFakeTimers();const b:WriteBudget={expired:false},menu={price:9}
  const p=raceDeadline(turn(b,menu,120_000,1000),b,90_000,()=>DOWN);await vi.advanceTimersByTimeAsync(90_000);expect(await p).toBe(DOWN)
  await vi.advanceTimersByTimeAsync(60_000);expect(menu.price).toBe(9);expect(b.committing).toBeFalsy()})
 it('scrittura già partita allo scadere: si aspetta e il titolare riceve cosa è cambiato',async()=>{vi.useFakeTimers();const b:WriteBudget={expired:false},menu={price:9}
  const p=raceDeadline(turn(b,menu,89_000,5000),b,90_000,()=>DOWN);await vi.advanceTimersByTimeAsync(95_000);expect(await p).toContain('10,00');expect(menu.price).toBe(10);expect(b.expired).toBe(false)})
 it('scrittura bloccata oltre la tolleranza: testo fisso e la scrittura non va a buon fine',async()=>{vi.useFakeTimers();const b:WriteBudget={expired:false},menu={price:9}
  const p=raceDeadline(turn(b,menu,89_000,120_000),b,90_000,()=>DOWN,30_000);await vi.advanceTimersByTimeAsync(121_000);expect(await p).toBe(DOWN);await vi.advanceTimersByTimeAsync(120_000);expect(menu.price).toBe(9)})
 it('beginWrite dopo lo scadere: false',()=>{const b:WriteBudget={expired:true};expect(beginWrite(b)).toBe(false);expect(b.committing).toBeFalsy()})
 it('turno veloce: risultato e timer cancellato',async()=>{vi.useFakeTimers();const b:WriteBudget={expired:false},menu={price:9}
  const p=raceDeadline(turn(b,menu,2000,100),b,90_000,()=>DOWN);await vi.advanceTimersByTimeAsync(3000);expect(await p).toContain('10,00');expect(vi.getTimerCount()).toBe(0)})})
