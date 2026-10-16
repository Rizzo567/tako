// Property test (giro 3): replays EVERY message phrase of verify/, verify2/ and of the onboarding fix tests through the
// real chat pipeline (verification + clause guardrail + merge) and asserts the invariant for each clause with a price:
// (a) applied with a value literally in the text, (b) a simple question, (c) an explanation — never a wrong value,
// never silence. Two model behaviours per phrase: it returns nothing (worst case: the guardrail alone), and it
// returns every grounded «dish a N euro» it can read (a plausible model).
import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {extractOnboardingMenu,onboardingUncoveredClauses} from '../apps/server/src/lib/onboarding-planner.js'
import {onboardingClauses,onboardingAmounts,onboardingRelativePrice} from '../apps/server/src/lib/onboarding-clauses.js'
import {mergeOnboardingRows} from '../apps/server/src/lib/onboarding-menu-merge.js'
import {mentionsOnboardingDish} from '../apps/server/src/lib/onboarding-dish-name.js'
const files=['docs/webapp/whatsapp-fix-2026-10-16/verify/adversarial.test.ts','docs/webapp/whatsapp-fix-2026-10-16/verify2/adversarial2.test.ts','tests/onboarding-whatsapp-fix-1016.test.ts']
const recordedPhrases: string[]=JSON.parse(readFileSync(new URL('./fixtures/onboarding-live-message-corpus.json',import.meta.url),'utf8'))
const phrases=[...new Set([...recordedPhrases,...files.flatMap(f=>{let t='';try{t=readFileSync(new URL('../'+f,import.meta.url),'utf8')}catch{return []}return [...t.matchAll(/'((?:[^'\\\n]|\\.){16,400})'/g)].map(m=>m[1]!.replace(/\\'/g,"'").replace(/\\n/g,'\n'))}).filter(p=>/euro|€/i.test(p)&&/\s/.test(p)&&!/[{}()=>$]|\.test\(|toContain|expect/.test(p))])]
const base=()=>workspaceSchema.parse({menus:[{id:randomUUID(),name:'Pranzo',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Pasta al pomodoro',price:10},{id:randomUUID(),name:'Risotto ai funghi',price:14}]},{id:randomUUID(),name:'Bevande',items:[{id:randomUUID(),name:'Acqua',price:2}]}]},{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Panini',items:[{id:randomUUID(),name:'Burger classico',price:12}]}]}]})
const items=(w:any)=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,menu:m.name}))))
// A plausible model: every «Name a N euro» chunk it can read, grounded (name = words before «a N euro» in the clause).
function plausibleRows(text:string){return onboardingClauses(text).flatMap(c=>{const m=c.text.match(/([\p{L}][\p{L}' ]{2,40}?)\s+a\s+(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:euro|€)/iu);if(!m)return [];const name=m[1]!.replace(/^(?:.*\s)?(?:aggiungi|metti|porta|alza|tieni|mantieni|il|la|lo|e)\s+/i,'').trim();if(name.length<3)return [];return [{section:'Menu',name,price:Number(m[2]!.replace(',','.')),description:'',evidence:m[0]}]})}
async function run(text:string,rows:any[]){
 const fetcher=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({rows,issues:[]})}}]}),{status:200})) as any
 const w=base(),before=items(w),extracted=await extractOnboardingMenu(text,'k',fetcher)
 const guard=onboardingUncoveredClauses(text,extracted.rows,before.map((i:any)=>i.name),w.menus.map(m=>m.name))
 const merged=mergeOnboardingRows(w,[...extracted.rows,...guard.rows],false)
 return{before,after:items(w),said:[...extracted.issues,...guard.issues,...merged.issues,...merged.notes,...merged.changes]}
}
const literal=(text:string)=>new Set(onboardingClauses(text).flatMap(c=>[...onboardingAmounts(c.text),...[...c.text.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)/g)].map(m=>Number(m[1]!.replace(',','.')))]))
const placeInfo=/coperto|consegna|spedizione|servizio|sopra|oltre|sotto|meno di|più di|per tutti|ore\b/i
describe(`invariant over ${phrases.length} phrases`,()=>{
 it('the corpus is not empty',()=>expect(phrases.length).toBeGreaterThan(60))
 for(const text of phrases)for(const mode of ['model returns nothing','plausible model'] as const)it(`${mode}: ${text.slice(0,90)}`,async()=>{
  const r=await run(text,mode==='plausible model'?plausibleRows(text):[]),nums=literal(text)
  for(const item of r.after){const old=r.before.find((b:any)=>b.id===item.id)
   if(!old){expect(text.toLocaleLowerCase('it'),`new dish not in the text: ${item.name}`).toContain(item.name.toLocaleLowerCase('it'));expect(nums.has(item.price),`new dish price not literal: ${item.name} ${item.price}`).toBe(true);continue}
   if(old.price===item.price)continue
   const deltas=onboardingClauses(text).map(c=>onboardingRelativePrice(c.text)).flatMap(x=>x&&'delta' in x?[old.price+x.delta]:[])
   expect(nums.has(item.price)||deltas.some(d=>Math.abs(d-item.price)<0.001),`changed price not in the text: ${item.name} ${old.price}→${item.price}`).toBe(true)}
  // No silence: a clause with a price that names a dish of the draft ends up changed, said (change/question/note) or already equal.
  for(const c of onboardingClauses(text)){if(!/euro|€/i.test(c.text)||placeInfo.test(c.text))continue
   for(const dish of r.before.filter((b:any)=>mentionsOnboardingDish(c.text,b.name))){
    const after=r.after.find((a:any)=>a.id===dish.id),cited=onboardingAmounts(c.text)
    const accounted=!after||after.price!==dish.price||r.said.some(x=>mentionsOnboardingDish(x,dish.name)||x.includes(c.text.slice(0,30)))||cited.includes(dish.price)||cited.length===0
    expect(accounted,`clause lost in silence: «${c.text}» about ${dish.name} → ${JSON.stringify(r.said)}`).toBe(true)}}
 })
})
