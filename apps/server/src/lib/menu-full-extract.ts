// Menu intero da messaggio o vocale (Feature 1): estrazione con il parser dell'onboarding, riusato così com'è.
// extractOnboardingMenu fa la chiamata (stesso prompt, stessi modelli Groq, stessi retry); qui si rilegge la sua risposta
// grezza, si convertono in cifre SOLO le citazioni dei prezzi parlati e si ricontrolla ogni riga con lo stesso cancello
// verifyOnboardingMenuRow (nome e prezzo letterali nella fonte). Spike 16/10: 27/27 contro 16/27 senza normalizzazione.
import {extractOnboardingMenu,verifyOnboardingMenuRow,type OnboardingFetcher,type OnboardingMenuRow} from './onboarding-planner.js'
import {onboardingDishKey,sameOnboardingDish} from './onboarding-dish-name.js'
import {normalizeSpokenPrices} from './menu-spoken-prices.js'
import {onboardingAmounts} from './onboarding-clauses.js'

export type FullMenuRow={section:string,name:string,price:number,description:string,evidence:string}
/** A dish the owner named without a usable price: never published at 0 €. */
export type FullMenuMissing={name:string,section:string|null,reason:'price'|'prices'}
export type FullMenuExtraction={rows:FullMenuRow[],missing:FullMenuMissing[],issues:string[],source:string}

const lower=(s:string)=>s.toLocaleLowerCase('it')
const unstar=(s:string)=>s.replace(/[*_~`<>]/g,'').trim()
/** Rows that are not plain dish lines in a full menu («mantieni», «togli», «da 12 a 13» relative…) are asked, not applied. */
const plainIntents=new Set([undefined,'add','set','change'])

function rawRows(contents:unknown[]):Record<string,unknown>[]{
 const out:Record<string,unknown>[]=[]
 for(const content of contents){const object=content&&typeof content==='object'&&!Array.isArray(content)?content as Record<string,unknown>:null;if(!object||!Array.isArray(object.rows))continue
  for(const r of object.rows.slice(0,2000)){if(!r||typeof r!=='object'||Array.isArray(r))continue;const clean:Record<string,unknown>={};for(const [k,v] of Object.entries(r as Record<string,unknown>)){if(v===null||v===undefined||typeof v==='string'&&!v.trim())continue;clean[k]=v}
   if(typeof clean.price==='string'&&/^\d{1,6}(?:[.,]\d{1,2})?$/.test(clean.price.trim()))clean.price=Number(clean.price.trim().replace(',','.'))
   out.push(clean)}}
 return out
}
const modelIssues=(contents:unknown[])=>contents.flatMap(c=>c&&typeof c==='object'&&Array.isArray((c as any).issues)?((c as any).issues as unknown[]).filter((x):x is string=>typeof x==='string'&&!!x.trim()).map(x=>x.slice(0,300)):[])

/** Replaces the first case-insensitive occurrence of `from` in `text`. */
function replaceOnce(text:string,from:string,to:string){const at=lower(text).indexOf(lower(from));return at<0?text:text.slice(0,at)+to+text.slice(at+from.length)}

/** «Tagliere 12 e 50» as a name: the amount belongs to the price, not to the dish. */
const trailingAmount=/\s+(?:a\s+)?\d{1,4}(?:[.,]\d{1,2})?(?:\s*(?:€|euro|euri))?(?:\s+e\s+\d{2})?\s*$/i
/** The literal amounts written after the dish name in the (normalized) citation. */
function literalAmounts(evidence:string,name:string){const at=lower(evidence).indexOf(lower(name));return at<0?[]:onboardingAmounts(evidence.slice(at+name.length))}

/** Pure part, testable without network: model contents (one per chunk) → verified rows on the citation-normalized source.
 * Values are only ever literal text: the model delimits the line, the server reads name and amount from the citation. */
export function verifyFullMenu(text:string,contents:unknown[]):FullMenuExtraction{
 const candidates=rawRows(contents);let source=text
 // 1) normalize each citation and write it back into the source, so the literal-price gate still holds.
 for(const c of candidates){const evidence=typeof c.evidence==='string'?c.evidence:'';if(!evidence||!lower(source).includes(lower(evidence)))continue;const normalized=normalizeSpokenPrices(evidence);if(normalized!==evidence){source=replaceOnce(source,evidence,normalized);c.evidence=normalized}}
 const rows:FullMenuRow[]=[],missing:FullMenuMissing[]=[],issues:string[]=[]
 const addMissing=(name:string,section:string|null,reason:FullMenuMissing['reason'])=>{const n=unstar(name).replace(/\s*\([^)]*\)\s*$/,'').trim().slice(0,120);if(n.length<2||missing.some(m=>sameOnboardingDish(m.name,n))||rows.some(r=>sameOnboardingDish(r.name,n)))return;missing.push({name:n,section,reason})}
 const accept=(c:Record<string,unknown>,section:string)=>{
  let name=typeof c.name==='string'?c.name.trim():'';if(!name)return
  const evidence=typeof c.evidence==='string'?c.evidence:''
  // The model sometimes writes the price inside the name («tagliere 12 e 50») or leaves it empty: read it from the citation.
  const bare=normalizeSpokenPrices(name).replace(trailingAmount,'').trim();if(bare&&bare!==name&&lower(evidence).includes(lower(bare)))name=bare
  const literal=evidence?literalAmounts(evidence,name):[]
  let price=typeof c.price==='number'&&Number.isFinite(c.price)&&c.price>0?c.price:null
  if(literal.length===1&&literal[0]!>0&&price!==literal[0])price=literal[0]!
  if(price===null||!evidence){addMissing(name,section,literal.length>1?'prices':'price');return}
  const verified=verifyOnboardingMenuRow({section,name,price,description:typeof c.description==='string'?c.description:'',evidence} as OnboardingMenuRow,source)
  const row=verified.row
  if(!row){if(verified.issue&&/prezzo/i.test(verified.issue))addMissing(name,section,literal.length>1?'prices':'price');else if(verified.issue)issues.push(verified.issue);return}
  if(!plainIntents.has(row.intent as any)){issues.push(`Non ho capito questa parte: «${unstar(row.evidence).slice(0,120)}».`);return}
  if(row.priceRange){addMissing(row.dishName??row.name,row.section,'prices');return}
  const finalName=row.dishName??row.name,dup=rows.find(r=>sameOnboardingDish(r.name,finalName))
  if(dup){if(dup.price!==row.price){rows.splice(rows.indexOf(dup),1);addMissing(finalName,row.section,'prices')}return}
  if(verified.issue)issues.push(verified.issue)
  rows.push({section:row.section,name:finalName,price:row.price,description:row.description,evidence:row.evidence})
 }
 for(const c of candidates)accept(c,typeof c.section==='string'&&c.section.trim()?c.section.trim():'Menu')
 // 2) the model's own doubts: «*Tagliata*: manca il prezzo» / «Arrosto senza prezzo» become a missing dish, the rest stays a note.
 for(const issue of modelIssues(contents)){
  const named=issue.match(/\*([^*]{2,120})\*/)?.[1]??issue.match(/^([^:*,(]{2,60}?)\s+(?:con|senza|ha|:|-|ambiguo|non)\b/i)?.[1]
  if(named&&/prezz/i.test(issue)&&lower(source).includes(lower(named.trim()))){addMissing(named.trim(),sectionBefore(source,named.trim(),rows),/due prezzi|più prezzi|piu prezzi|ambigu|dimension|\d\s*\/\s*\d/i.test(issue)?'prices':'price');continue}
  issues.push(issue)}
 // 3) deterministic guards on punctuated text: a priced «nome prezzo» clause the model skipped is read literally
 //    (same gate); any other priced clause left out becomes a question; a dish under a heading without any number is missing.
 for(const {clause,section} of menuClauses(source,rows)){
  const covered=rows.some(r=>lower(clause).includes(lower(r.evidence))||lower(r.evidence).includes(lower(clause))||lower(clause).includes(lower(r.name)))||missing.some(m=>lower(clause).includes(lower(m.name)))
  if(covered)continue
  const priced=/\d/.test(clause)
  if(!priced){if(section&&!fillers.test(clause)&&clause.split(/\s+/).length<=6&&/\p{L}{3}/u.test(clause))addMissing(clause.replace(/^(?:e\s+)?(?:(?:il|lo|la|i|gli|le)\s+|l['’]\s*)/i,'').trim(),section,'price');continue}
  const simple=clause.match(/^(?:e\s+)?([\p{L}'’ ]{2,60}?)\s+(?:a\s+)?(\d{1,4}(?:,\d{2})?)\s*(?:€|euro|euri)?$/iu)
  if(simple&&simple[1]!.trim().split(/\s+/).length<=6&&!fillers.test(simple[1]!.trim())&&!nonDish.test(simple[1]!)){const before=rows.length;accept({name:simple[1]!.trim(),price:Number(simple[2]!.replace(',','.')),evidence:clause},section??'Menu');if(rows.length>before)continue}
  if(!rows.some(r=>lower(clause).includes(lower(r.name))))issues.push(`Non ho capito questa parte: «${unstar(clause).slice(0,120)}». Riscrivila con nome e prezzo.`)
 }
 return{rows,missing,issues:[...new Set(issues)].filter(i=>!missing.some(m=>lower(i).includes(lower(m.name)))).slice(0,20),source}
}

/** The category heading nearest before the first mention of `name`, among the categories of the accepted rows. */
function sectionBefore(source:string,name:string,rows:FullMenuRow[]):string|null{
 const at=lower(source).indexOf(lower(name));if(at<0)return null;let best:string|null=null,bestAt=-1
 for(const s of new Set(rows.map(r=>r.section))){const p=lower(source).lastIndexOf(lower(s),at);if(p>bestAt){best=s;bestAt=p}}
 return best
}
const fillers=/^(?:men[uù](?:\s+(?:di|del|per)\s+\S+)*(?:\s+(?:a\s+)?(?:pranzo|cena))?|(?:il\s+)?men[uù]|oggi(?:\s+abbiamo)?|(?:pranzo|cena)(?:\s+di\s+\S+)?|allora|poi|per finire|ecco(?:\s+il\s+men[uù])?|ciao|buongiorno|buonasera|grazie|e|ok)$/i
/** Priced clauses that are not dishes (cover charge, fixed-price note…): never reconstructed as a dish. */
const nonDish=/\b(?:coperto|servizio|consegna|sconto|men[uù]|prezzo fisso|a persona|totale|mancia)\b/i
const knownHeading=/^(?:antipast[oi]|prim[oi]|second[oi]|contorn[oi]|dolc[ei]|dessert|pizze|pizza|insalat[ae]|bevande|fritti|zuppe|panini|carne|pesce|piatti(?:\s+del\s+giorno)?|men[uù])$/i
/** Clauses of a punctuated menu with the category heading in force («Primi: carbonara 10, amatriciana 9»). */
export function menuClauses(source:string,rows:FullMenuRow[]):{clause:string,section:string|null}[]{
 const out:{clause:string,section:string|null}[]=[],headings=new Set(rows.map(r=>onboardingDishKey(r.section)));let section:string|null=null
 const isHeading=(s:string)=>headings.has(onboardingDishKey(s))||knownHeading.test(s.trim())
 for(const raw of source.split(/[;\n]|(?<!\d)[.,]|[.,](?!\d)/)){
  let clause=raw.trim();if(!clause)continue
  const head=clause.match(/^([^:]{2,40}):\s*(.*)$/);if(head){section=head[1]!.trim();clause=head[2]!.trim();if(!clause)continue}
  if(isHeading(clause)){section=clause;continue}
  if(fillers.test(clause))continue
  out.push({clause,section})
 }
 return out
}
/** Same request as the onboarding extractor, two bounds for the shared free quota (as the owner bot planner):
 * reasoning_effort low and at most 4000 output tokens; GROQ_API_BASE is honoured for local tests. */
export function fullMenuFetcher(base:OnboardingFetcher=fetch):OnboardingFetcher{
 return (url,init)=>{
  const target=String(url).replace('https://api.groq.com/openai/v1',process.env.GROQ_API_BASE||'https://api.groq.com/openai/v1')
  let body=init?.body;if(typeof body==='string'){try{const json=JSON.parse(body);if(json&&typeof json==='object'){json.reasoning_effort='low';json.max_completion_tokens=Math.min(Number(json.max_completion_tokens)||4000,4000);body=JSON.stringify(json)}}catch{}}
  return base(target,{...init,body})
 }
}
/** Groq call through the onboarding extractor; contents are tapped from the same responses it validates. */
export async function extractFullMenu(text:string,key:string,fetcher:OnboardingFetcher=fetch):Promise<FullMenuExtraction>{
 const contents:unknown[]=[]
 const tap:OnboardingFetcher=async(url,init)=>{const response=await fetcher(url,init);if(response.ok){try{const raw=(await response.clone().json() as any)?.choices?.[0]?.message?.content;if(typeof raw==='string'){try{contents.push(JSON.parse(raw))}catch{}}}catch{}}return response}
 await extractOnboardingMenu(text,key,tap)
 // Retries (JSON malformed) push more than one content per chunk: keep only the last valid one per call order is not
 // recoverable here, so duplicates are removed by verifyFullMenu (same dish once).
 return verifyFullMenu(text,contents)
}
