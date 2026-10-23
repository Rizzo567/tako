/** 23/10/2026 — lessico dei piatti per locale (divisione con la «e», dish-split.ts). Fonti: nomi attuali (passati dal chiamante), storico
 * (ultime 25 versioni del workspace: anche i piatti eliminati), regole imparate (righe `habit` di tako_owner_brain_memory via lo store del
 * cervello: nessuna migrazione). Mai bloccante: statement_timeout 1,5 s nel DB + tetto 2,5 s lato server; in errore → solo i nomi attuali.
 * Le due letture sono indipendenti (una che fallisce non toglie l'altra). Cache per locale 2 minuti, svuotata quando si salva una regola. */
import {sql} from 'drizzle-orm'
import {sqlBrainStore} from './owner-brain-memory.js'
import {ruleMeaning,ruleOfMeaning,lexKey,type Lexicon,type SplitRule} from './dish-split.js'

type Tx={execute(q:ReturnType<typeof sql>):Promise<any>}
type Db=Tx&{transaction<T>(f:(tx:Tx)=>Promise<T>):Promise<T>}
const cache=new Map<string,{at:number,names:string[],rules:SplitRule[]}>()
const TTL=2*60*1000
const within=<T>(p:Promise<T>,ms:number,fallback:T):Promise<T>=>new Promise(res=>{const t=setTimeout(()=>res(fallback),ms);p.then(v=>{clearTimeout(t);res(v)},()=>{clearTimeout(t);res(fallback)})})
const timed=<T>(db:Db,f:(tx:Tx)=>Promise<T>)=>db.transaction(async tx=>{await tx.execute(sql`SET LOCAL statement_timeout = '1500ms'`);return f(tx)})

export async function loadLexicon(db:Db,tenant:string,current:string[]):Promise<Lexicon>{
 const hit=cache.get(tenant)
 if(hit&&Date.now()-hit.at<TTL)return{names:[...new Set([...current,...hit.names])],rules:hit.rules}
 const [names,rules]=await Promise.all([
  within(timed(db,async tx=>(await tx.execute(sql`SELECT DISTINCT x#>>'{}' AS n FROM (SELECT snapshot FROM menu_workspace_versions WHERE restaurant_id=${tenant} ORDER BY created_at DESC LIMIT 25) v, LATERAL jsonb_path_query(v.snapshot,'lax $.menus[*].sections[*].items[*].name') x LIMIT 3000`) as any[]??[]).map(r=>String(r.n??'')).filter(Boolean)) as Promise<string[]>,2500,null as string[]|null),
  within(timed(db,async tx=>(await sqlBrainStore(tx).listMemory(tenant)).filter(m=>m.kind==='habit'&&m.state!=='review').map(m=>ruleOfMeaning(m.meaning)).filter((r):r is SplitRule=>!!r)),2500,null as SplitRule[]|null)])
 if(names&&rules)cache.set(tenant,{at:Date.now(),names,rules})
 return{names:[...new Set([...current,...(names??hit?.names??[])])],rules:rules??hit?.rules??[]}}

/** Salva (o sostituisce: stessa frase) le regole imparate. Mai eccezioni verso il chiamante. */
export async function saveSplitRules(db:Db,tenant:string,rules:SplitRule[],origin:'correction'|'clarify'):Promise<number>{
 let n=0
 for(const r of rules){const phrase=lexKey(r.phrase).slice(0,60);if(phrase.length<2)continue
  const ok=await within(timed(db,async tx=>{const store=sqlBrainStore(tx),now=Date.now()
    const old=(await store.listMemory(tenant)).filter(m=>m.kind==='habit'&&m.phrase===phrase)
    for(const m of old)await store.deleteMemory(tenant,m.id)
    const id=crypto.randomUUID()
    await store.saveMemory({id,restaurantId:tenant,phrase,kind:'habit',itemId:null,meaning:ruleMeaning({...r,phrase}),state:'active',confirmations:1,uses:0,lastUsedAt:now,origin,createdAt:now,updatedAt:now})
    await store.log(tenant,{memoryId:id,phrase,op:'create',itemId:null,detail:{via:'divisione',kind:r.kind,parts:r.parts,replaced:old.length}})
    return true}),3000,false)
  if(ok)n++}
 cache.delete(tenant)
 return n}
/** Solo test. */
export const _lexiconCache=cache
