// Misura offline dei token del contesto (nessuna chiamata di rete). Uso: npx tsx tests/owner-brain-measure.ts
import {buildBrainContext,GENERAL_CARD,estimateTokens} from '../apps/server/src/lib/owner-brain-context.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'
import {typicalWorkspace,largeWorkspace} from './owner-brain-fixture.js'
const now=Date.now()
for(const [label,w] of [['tipico',typicalWorkspace()],['grande',largeWorkspace(320)]] as const){const {refs,sections}=catalogOf(w)
 const memory=refs.slice(0,8).map((r,i)=>({phrase:'alias'+i,kind:'alias' as const,itemId:r.id,meaning:r.name,state:'active' as const,confirmations:2,uses:0,lastUsedAt:now}))
 const history=Array.from({length:20},(_,i)=>({role:i%2?'bot' as const:'owner' as const,text:i%2?'Quale piatto intendi? Tagliata di manzo o Tagliata di tonno?':'la tagliata mettila a 21 euro',at:now-60000+i*1000}))
 const min=buildBrainContext({refs,sections,message:'la carbonara è finita',now})
 const max=buildBrainContext({refs,sections,memory,history,message:'la carbonara è finita e metti la amatriciana allo stesso prezzo della cacio e pepe',now,pending:{proposal:[{kind:'price',id:refs[0]!.id,price:13}]}})
 console.log(label,refs.length,'piatti','| senza cronologia',JSON.stringify(min.tokens),'| pieno',JSON.stringify(max.tokens),'compressione',max.compression)}
console.log('scheda generale caratteri',GENERAL_CARD.length,'stima',estimateTokens(GENERAL_CARD))
