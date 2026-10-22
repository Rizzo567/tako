/** R10 (18/10/2026, QA dal vivo «Togli tutti i piatti dalla sezione altre proposte» → «Non esiste una sezione chiamata…»).
 * Il titolare chiama le sezioni con i nomi che vede nel menu digitale: la pagina pubblica le raggruppa in macro-categorie
 * («Primi», «Secondi e panini», «Dolci e frutta»… e «Altre proposte» per quelle non riconosciute). La logica dei gruppi è la
 * stessa della pagina pubblica (copia generata `menu-public-groups.ts`, mai a mano). Qui: nomi pubblici per sezione e
 * riconoscimento LETTERALE delle sezioni nominate in un testo (vincoli del validatore, nessuna decisione). Modulo puro. */
import {categoryGroups,macroCategoryGroups} from './menu-public-groups.js'
import {plain,type SectionRef} from './twilio-menu-ai.js'
import {sameSection} from './twilio-menu-structure.js'

/** Nome pubblico (macro-categoria della pagina pubblica) di ogni sezione di un menu, sottocategorie comprese. */
/** `manual` (dashboard editor 22/10): con `design.manualOrder` la pagina mostra i Sottomenu veri, senza accorpamenti. */
export function publicNames(menu:{sections:{id:string,name:string,parentSectionId?:string|null,items:{available?:boolean}[]}[]},manual=false):Map<string,string>{
 const out=new Map<string,string>()
 for(const g of (manual?categoryGroups:macroCategoryGroups)(menu.sections.map(s=>({id:s.id,name:s.name,parentSectionId:s.parentSectionId??null,items:s.items}))))for(const s of [g.section,...g.children])out.set(s.id,String(g.section.name??''))
 return out}

const STOP=new Set(['della','delle','degli','dello','alla','alle','agli','allo','dalla','dalle','dagli','nella','nelle','negli','sezione','categoria'])
const sig=(name:string)=>plain(name).split(' ').filter(w=>w.length>=4&&!STOP.has(w))
// Nomi pubblici: prefisso di 5 lettere (vocali storpiati: «altre propose»). Nomi delle sezioni: la parola meno l'ultima lettera
// (singolare/plurale: «panini»/«panino»), così «Sezione da spostare» non è detta da «sposta».
const pre=(w:string,pub:boolean)=>w.slice(0,pub?Math.min(5,w.length):Math.max(4,w.length-1))
const hasWord=(words:string[],w:string,pub=false)=>words.some(x=>x.startsWith(pre(w,pub))&&x.length>=Math.min(4,w.length))
/** Il nome compare nel testo: tutte le parole significative (prefisso di 5 lettere, per i vocali storpiati: «altre propose»),
 * oppure la stessa forma della sezione (singolare/plurale). Per i nomi pubblici basta la prima parola significativa, salvo
 * «Altre proposte» (servono tutte e due: «altre» da sola è troppo generica). */
export function nameInText(name:string,text:string,isPublic=false):boolean{
 const words=plain(text).split(' ').filter(Boolean),s=sig(name);if(!words.length)return false
 if(!s.length){const p=plain(name);return !!p&&(' '+words.join(' ')+' ').includes(' '+p+' ')}
 if(isPublic&&plain(name)!=='altre proposte')return hasWord(words,s[0]!,true)
 return s.every(w=>hasWord(words,w,isPublic))||(s.length===1&&words.some(x=>x.length>=4&&sameSection(name,x)))}

/** Sezioni nominate nel testo, col loro nome (o col nome pubblico: tutte le sezioni che vi cadono). */
export function namedSections(text:string,sections:SectionRef[]):{ids:string[],said:string[]}{
 const ids=new Set<string>(),said=new Set<string>()
 for(const s of sections)if(nameInText(s.name,text)){ids.add(s.id);said.add(s.name)}
 const pubs=[...new Set(sections.flatMap(s=>s.pub&&plain(s.pub)!==plain(s.name)?[s.pub]:[]))]
 for(const p of pubs)if(nameInText(p,text,true)&&!sections.some(s=>ids.has(s.id)&&plain(s.name)===plain(p))){said.add(p);for(const s of sections)if(s.pub===p)ids.add(s.id)}
 return{ids:[...ids],said:[...said]}}

/** «sezione X» / «categoria X» con X che nel menu non c'è (né come sezione né come nome pubblico): la frase detta. */
export function unknownSectionPhrase(text:string,sections:SectionRef[]):string|null{
 // Una sezione da creare («aggiungi un'altra categoria, chiamala speciali», «crea la sezione X») non è una sezione inesistente.
 if(/\b(?:cre[ai]\w*|nuov[ao]|altra|chiama\w*|apri|aggiungi (?:una|la) (?:categoria|sezione))\b/.test(plain(text)))return null
 for(const m of plain(text).matchAll(/\b(?:sezione|categoria|sezioni|categorie)\s+((?:[a-z0-9]+\s*){1,3})/g)){const phrase=m[1]!.trim().split(' ').filter(w=>!['che','si','chiama','nuova','nuovo','di','del','dei','della','e','tutta','tutto','intera'].includes(w)).slice(0,3).join(' ')
  if(!phrase||sig(phrase).length===0)continue
  if(namedSections(phrase,sections).ids.length)continue
  return phrase}
 return null}

/** Tutti/tutte riferito a sezioni nominate nella stessa parte del messaggio («togli tutti i piatti dalla sezione altre proposte»,
 * «i dolci e frutta tutti finiti»): le sezioni. */
export function allOfSections(text:string,sections:SectionRef[]):string[]{
 const ids=new Set<string>()
 for(const part0 of text.split(/[;.\n]|,\s*(?=\D)/)){if(!/\btutt[ieoa]\b/i.test(plain(part0)))continue
  // «sposta tutti i piatti di X nei primi»: la sezione di arrivo non è fra quelle di «tutti».
  const p=' '+plain(part0)+' ',dest=/ (?:spost\w*|mett\w*|port\w*|trasferisc\w*) /.test(p)?[...p.matchAll(/ (?:nei|negli|nelle|nel|nella|in|verso|sotto|dentro) ((?:\S+ ?){1,3})/g)].map(m=>m[1]!.trim()):[]
  const destIds=new Set(dest.flatMap(d=>namedSections(d,sections).ids)),rest=dest.reduce((t,d)=>t.replace(' '+d+' ',' '),p)
  for(const id of namedSections(p,sections).ids)if(!destIds.has(id)||namedSections(rest,sections).ids.includes(id))ids.add(id)}
 return[...ids]}

/** Elenco delle sezioni per il motivo di rifiuto / i fatti: «Piatti di prova (nel menu digitale: Altre proposte), Primi». */
export const sectionListText=(sections:SectionRef[])=>sections.map(s=>s.name+(s.pub&&plain(s.pub)!==plain(s.name)?' (nel menu digitale: '+s.pub+')':'')).join(', ')

/** Il testo nomina un nome pubblico diverso dai nomi delle sezioni (serve mostrare i nomi pubblici nella scheda del locale). */
export const mentionsPublicName=(text:string,sections:SectionRef[])=>!!text&&sections.some(s=>!!s.pub&&plain(s.pub)!==plain(s.name)&&nameInText(s.pub,text,true))
