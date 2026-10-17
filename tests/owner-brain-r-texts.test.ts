// Fase R (R3.2, 17/10/2026 notte): col cervello acceso nessuna risposta del bot contiene i testi fissi del percorso a regole.
// Scansiona le risposte di TUTTE le batterie col cervello acceso (fix-a, fix-b, X, Y, V, banco E; oracolo, Groq giù, avversario)
// già scritte dai runner in docs/webapp/…/results-*.json. Ammessi solo: la riga «assistente automatico» (AI Act), il testo
// «non disponibile» (copy.brainDown) e i FATTI del server (righe dei piatti, stato del menu): vedi MAPPA-TESTI-R.md.
// Rifare dopo i runner:  npx vitest run tests/owner-brain-r-texts.test.ts
import {describe,expect,it} from 'vitest'
import {existsSync,readFileSync} from 'node:fs'
import {copy} from '../apps/server/src/lib/twilio-menu-copy.js'

const R='docs/webapp/'
const FILES=[
 ...['oracle','off','adversary'].flatMap(m=>[`bot-correzioni-2026-10-17/batterie/results-a-${m}.json`,`bot-correzioni-2026-10-17/batterie/results-b-${m}.json`,`bot-correzioni-2026-10-17/avversaria/results-x-${m}.json`,`bot-correzioni-2026-10-17/avversaria-y/results-y-${m}.json`]),
 ...['oracle','off'].flatMap(m=>[`bot-cervello-2026-10-17/verifica-v/results-R-dopo-${m}.json`,`bot-cervello-2026-10-17/eval/results-R-dopo-${m}.json`])]
// Testi che col cervello acceso spariscono (MAPPA-TESTI-R.md, sezione «Spariscono»).
const GONE=['help','proposal','typedOk','applied','nothingToCancel','cancelled','nothingToConfirm','notUnderstood','choosePrice','choosePriceNow','choosePriceNoDish','choosePriceMulti','choosePriceAgain','chooseInvalid','chooseAgain','negatedOnly','whichDish','dishNotFound','sameName','createMissing','createCategories','alreadyExists','notVerbatim','unreadAsk','aiDown','noAi','failed','thanks','wait','busy','noMatch','notFoundNamed','choose','chooseFirst','brainWhatFor','brainNoContext','brainWhichRecent','pendingEmpty','holdHead','holdRemove','holdPrice','holdNotTouched','holdAskRemove','holdAskPrice','holdAskChoose','holdAskConfirm','holdAskUnknown','holdAskFooter','holdAskFooterOne','holdAskFooterOnly','holdAskFooterChoose','holdDropped','holdExists','holdRestUnclear','deleteAsk','draftDropped','batchStill','pendingStill','deleteUndoHint','sectionAsk','sectionExists','hiddenNotDeletedPlain','hiddenNotDeleted','undoDone','jobTimeout','voiceFailed'] as const
// Frammenti fissi (≥18 caratteri tra i segnaposto) + i testi scritti a mano nel route e in composeReply.
// I fatti ammessi (stato del menu) non contano: un frammento che sta dentro uno di loro non è un testo vietato.
const ALLOWED=[copy.noChanges,'Non ho cambiato nulla.',copy.menuChanged,copy.notPublished,copy.dashboardPending,copy.undoConflict,copy.undoExpired].map(x=>x.replace(/\s+/g,' '))
const fragments0=[...new Set(GONE.flatMap(k=>String((copy as any)[k]??'').split(/\{\w+\}/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>=18)).concat(['Confermato.* Ho aggiornato il menu','Va bene, non cambio nulla.','Non ho una modifica recente su','La richiesta è *troppo lunga*','Dimmi pure cosa vuoi cambiare nel menu.']))]
const fragments=fragments0.filter(fr=>!ALLOWED.some(a=>a.includes(fr)))

describe('fase R: nessun testo fisso vietato nelle risposte col cervello acceso',()=>{
 const present=FILES.filter(f=>existsSync(R+f))
 it('ci sono i risultati delle batterie (lanciare prima i runner)',()=>{expect(present.length,'nessun results-*.json: lanciare le batterie').toBeGreaterThan(0)})
 it(`0 frammenti vietati in ${present.length} file di risultati`,()=>{
  const hits:string[]=[];let replies=0
  for(const f of present){const j=JSON.parse(readFileSync(R+f,'utf8'));for(const v of j.verdicts)for(const r of v.replies as string[]){replies++;const t=r.replace(/\s+/g,' ');for(const fr of fragments)if(t.includes(fr))hits.push(`${f.split('/').pop()} ${v.id}: «${fr.slice(0,50)}»`)}}
  expect(replies).toBeGreaterThan(1000)
  expect(hits.length,hits.slice(0,20).join('\n')).toBe(0)})
})
