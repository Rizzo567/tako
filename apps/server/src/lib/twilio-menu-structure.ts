/** Fase B (17/10/2026, docs/webapp/bot-correzioni-2026-10-17/PIANO.md): eliminare, spostare e rinominare piatti, creare e
 * rinominare categorie dal bot WhatsApp del titolare. Modulo puro (gira anche nell'edge Deno): tipi delle azioni, verbi,
 * applicazione al documento del menu e lettura deterministica dei comandi più comuni.
 * Regole (decisioni 17/10): «elimina / cancella / rimuovi completamente / levalo proprio» = eliminare, SEMPRE dopo conferma,
 * recuperabile con «annulla» per 10 minuti; «togli» resta nascondere. Le categorie nuove vanno in un ordine sensato
 * (antipasti → primi → secondi → contorni → dolci → bevande); mai due categorie con lo stesso nome. */

export type StructAction=
 |{kind:'delete',id:string,undoCreate?:boolean} // undoCreate: «no, X lascialo stare» subito dopo averlo aggiunto (senza conferma)
 |{kind:'rename',id:string,name:string}
 |{kind:'move',id:string,sectionId:string}
 |{kind:'create_section',newSectionId:string,name:string,menuId:string,menuName?:string}
 // run Haiku 21/10: Menu nuovo (livello menus[]), vuoto; i Sottomenu dello stesso piano lo indicano con menuId=newMenuId.
 |{kind:'create_menu',newMenuId:string,name:string,type:'main'|'lunch'|'dinner'|'drinks'}
 |{kind:'rename_section',sectionId:string,name:string}
export const STRUCT_KINDS=new Set(['delete','rename','move','create_section','rename_section','create_menu'])
export const isStructAction=(a:{kind:string}):a is StructAction=>STRUCT_KINDS.has(a.kind)

const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export const plainName=fold
const cap=(x:string)=>x.charAt(0).toLocaleUpperCase('it')+x.slice(1)

// Verbi (sul testo «piano»: minuscole, senza accenti né punteggiatura).
export const DELETE_VERB=/\b(?:elimin\w*|cancell\w*|rimuov\w* (?:\w+ ){0,4}?(?:completamente|definitivamente|del tutto|per sempre|proprio)|(?:lev|togl)\w* (?:\w+ ){0,4}?(?:proprio|del tutto|definitivamente|per sempre)|(?:completamente|definitivamente) (?:rimuov|lev|togl)\w*)\b/
export const RENAME_VERB=/\b(?:rinomin\w*|cambi\w* (?:il |anche il )?nome|chiamal[aoie]\b|chiamamel[aoie]|chiama (?:il|la|lo|l)\b|da oggi si chiama|ora si chiama|adesso si chiama|si chiamera|mettici (?:come nome)?|nuovo nome)\b/
export const MOVE_VERB=/\b(?:spost\w*|trasferisc\w*|porta\w*)\b/
export const SECTION_WORD=/\b(?:categori[ae]|sezion[ei])\b/
export const CREATE_SECTION_VERB=/\b(?:cre\w*|aggiung\w*|apri|fai|inserisc\w*|nuov[ao]|un altra)\b/

// Ordine delle portate per inserire una categoria nuova in un posto sensato.
const COURSES:[RegExp,number][]=[[/^(?:antipast|stuzzic|apert|crud|fritt)/,1],[/^(?:prim|pasta|risott|zupp)/,2],[/^(?:second|carn|pesc|grigl)/,3],[/^(?:contorn|insalat|verdur)/,4],[/^(?:pizz|focacc|panin|burger|piadin)/,5],[/^(?:formagg|tagli)/,6],[/^(?:dolc|dessert|gelat|frutt)/,7],[/^(?:bevand|bibit|vin|birr|cocktail|caff|aperitiv|amar|distillat|liquor)/,8]]
export const courseRank=(name:string)=>{const p=fold(name);for(const [re,n] of COURSES)if(re.test(p))return n;return 0}
/** Varianti singolare/plurale per riconoscere una categoria («primo» = «Primi»). */
export const sectionForms=(name:string)=>{const p=fold(name);return new Set([p,p.replace(/i$/,'o'),p.replace(/e$/,'a'),p.replace(/i$/,'e'),p.replace(/o$/,'i'),p.replace(/a$/,'e')])}
export const sameSection=(a:string,b:string)=>{const x=sectionForms(a);return [...sectionForms(b)].some(f=>x.has(f))}

type Sec={id:string,name:string,menu?:string,menuId?:string}
/** Menu in cui va una categoria nuova: quello della categoria più vicina per portata, altrimenti il primo menu non di bevande. */
export function menuForSection(name:string,w:any):string|null{
 const menus=(w?.menus??[]).filter((m:any)=>m.active!==false),rank=courseRank(name)
 if(!menus.length)return null
 if(rank===8){const d=menus.find((m:any)=>m.type==='drinks');if(d)return d.id}
 const food=menus.filter((m:any)=>m.type!=='drinks')
 if(rank){let best:{id:string,d:number}|null=null;for(const m of food)for(const s of m.sections??[]){const r=courseRank(s.name);if(!r)continue;const d=Math.abs(r-rank);if(!best||d<best.d)best={id:m.id,d}};if(best)return best.id}
 return (food[0]??menus[0]).id}

/** Applica un'azione di struttura al documento. Restituisce il nome toccato (per la risposta). */
export function applyStructAction(w:any,a:StructAction):string{
 const sections=w.menus.flatMap((m:any)=>m.sections),find=(id:string)=>{for(const s of sections){const k=s.items.findIndex((i:any)=>i.id===id);if(k>=0)return{s,k,item:s.items[k]}}return null}
 if(a.kind==='create_menu'){if(w.menus.some((m:any)=>m.id===a.newMenuId||fold(m.name)===fold(a.name)))return a.name
  w.menus.push({id:a.newMenuId,name:a.name,description:null,type:a.type,active:true,translations:{},sections:[]});return a.name}
 if(a.kind==='create_section'){const menu=w.menus.find((m:any)=>m.id===a.menuId)??w.menus.find((m:any)=>m.id===menuForSection(a.name,w));if(!menu)throw new Error('Menu missing');if(w.menus.some((m:any)=>m.sections.some((s:any)=>s.id===a.newSectionId)))return a.name
  const rank=courseRank(a.name),section={id:a.newSectionId,name:a.name,items:[]}
  const at=rank?menu.sections.findIndex((s:any)=>!s.parentSectionId&&courseRank(s.name)>rank):-1
  if(at>=0)menu.sections.splice(at,0,section);else{const drinks=rank===8?-1:menu.sections.findIndex((s:any)=>!s.parentSectionId&&courseRank(s.name)===8);if(drinks>=0)menu.sections.splice(drinks,0,section);else menu.sections.push(section)}
  return a.name}
 if(a.kind==='rename_section'){const s=sections.find((x:any)=>x.id===a.sectionId);if(!s)throw new Error('Section missing');s.name=a.name;return a.name}
 const hit=find(a.id);if(!hit)throw new Error('Item missing')
 if(a.kind==='delete'){hit.s.items.splice(hit.k,1);return hit.item.name}
 if(a.kind==='rename'){const old=hit.item.name;hit.item.name=a.name;return old}
 const target=sections.find((x:any)=>x.id===a.sectionId);if(!target)throw new Error('Section missing');if(target===hit.s)return hit.item.name
 hit.s.items.splice(hit.k,1);target.items.push(hit.item);return hit.item.name}
/** Le categorie nuove prima dei piatti che le usano; le eliminazioni per ultime. */
export const orderActions=<T extends {kind:string}>(xs:T[])=>[...xs.filter(a=>a.kind==='create_menu'),...xs.filter(a=>a.kind==='create_section'),...xs.filter(a=>a.kind!=='create_menu'&&a.kind!=='create_section'&&a.kind!=='delete'),...xs.filter(a=>a.kind==='delete')]

// ---------------------------------------------------------------------------------------------------------------------------
// Lettura deterministica (senza IA) dei comandi più comuni. null = non è un comando di struttura chiaro.
type Ref={id:string,name:string,sectionId?:string|null,section?:string,menu?:string}
const TAIL=/\s+(?:dal|dai|dalla|dalle|del|nel|in)\s+menu\b.*$|\s+(?:completamente|definitivamente|del tutto|per sempre|proprio|pure|grazie|subito|per favore)\b.*$/
const ARTS=/^(?:il|lo|la|l|i|gli|le|un|una|uno|piatto|piatti|anche)\s+/
const clean=(s:string)=>{let t=fold(s).replace(TAIL,'').trim();for(let i=0;i<4;i++)t=t.replace(ARTS,'').replace(/^(?:completamente|definitivamente|del tutto|per sempre|proprio)\s+/,'').trim();return t}
/** Il piatto di un pezzo di frase: nome esatto, oppure un solo piatto il cui nome contiene tutte le parole. */
export function dishOf(part:string,refs:Ref[]):Ref[]{
 const t=clean(part);if(!t)return []
 // M6: «il primo», «il secondo», «l'ultimo» da soli sono posizioni (in un elenco del bot), non «Primo/Secondo del giorno».
 if(/^(?:prim[oaie]|second[oaie]|terz[oaie]|quart[oaie]|ultim[oaie])$/.test(t)&&!refs.some(r=>fold(r.name)===t))return []
 const exact=refs.filter(r=>fold(r.name)===t||fold(r.name).replace(ARTS,'')===t);if(exact.length)return exact
 const ws=t.split(' ').filter(w=>w.length>=3&&!['del','della','con','alla','allo','alle','agli'].includes(w));if(!ws.length)return []
 return refs.filter(r=>{const n=' '+fold(r.name)+' ';return ws.every(w=>n.includes(' '+w+' ')||n.includes(' '+w.slice(0,Math.max(4,w.length-1))))})}
export const sectionOf=(text:string,sections:Sec[])=>{const t=clean(text).replace(/^(?:categoria|sezione)\s+/,'');return t?sections.filter(s=>sameSection(s.name,t)):[]}

// A8.0 (Y4/Y5): un nome nuovo finisce dove comincia un secondo verbo, un'altra parte («e la panna cotta pure», «, poi…») o
// una cortesia in coda («se puoi», «per favore»). Se dopo il nome resta qualcosa che non è cortesia, la frase non è un
// comando di struttura semplice: la legge il cervello (o, a Groq spento, si chiede).
const VERB0='(?:mett|nascond|togl|lev|elimin|cancell|rimuov|aggiung|inserisc|spost|port|rinomin|chiam|crea|cre[ao]|alz|abbass|aument|ridu|rimett|segn|fai|fall|cambi|imposta)\\w*'
const SLOT_STOP=new RegExp('\\s+(?:e|ed|poi|e poi|e anche|anche)\\s+(?='+VERB0+'\\b)|\\s+(?:e|ed)\\s+(?=(?:il|lo|la|l|i|gli|le|un|una)\\s)|\\s*[,;]\\s*|\\s+poi\\s+|\\s+(?='+VERB0+'\\b)|\\s+(?=(?:se puoi|se riesci|per favore|per piacere|per cortesia|grazie|ok|dai|please|thx|subito|quando puoi|appena puoi|mi raccomando)\\b)')
const COURTESY_ONLY=/^\s*(?:(?:se puoi|se riesci|per favore|per piacere|per cortesia|grazie(?: mille)?|ok|okay|dai|please|thx|subito|quando puoi|appena puoi|mi raccomando|eh|grazie eh|top|perfetto)[\s,.!]*)*$/
export function nameSlot(part:string):{name:string,rest:string}{const m=SLOT_STOP.exec(part);if(!m)return{name:part.trim(),rest:''};return{name:part.slice(0,m.index).trim(),rest:part.slice(m.index).trim()}}
const courtesyOnly=(rest:string)=>!rest||COURTESY_ONLY.test(rest)
/** Nome tra virgolette («Tagliata di manzo», "Gricia romana", 'Crudi'): è il nome esatto. */
export function quotedName(raw:string):string|null{const all=[...raw.matchAll(/[«“"]([^«»“”"]{1,80})[»”"]/g)];if(all.length)return all.at(-1)![1]!.trim();const m=raw.match(/(?:^|\s)'([^']{2,80})'(?=\s|[.,!?]|$)/);return m?m[1]!.trim():null}

export type StructParse={kind:'delete',ids:string[]}|{kind:'rename',id:string,name:string}|{kind:'move',ids:string[],sectionId:string|null,sectionName:string}
 |{kind:'create_section',name:string,rest:string}|{kind:'rename_section',sectionId:string,name:string}|{kind:'ask',text:string}
/** Comando di struttura detto in modo esplicito. Con piatti ambigui o non trovati → null (decide il resto del bot). */
export function parseStructure(raw:string,refs:Ref[],sections:Sec[]):StructParse|null{
 const t=fold(raw).replace(/^(?:(?:ok|allora|senti|ciao|e|ed|poi|anzi|no|si|per favore|scusa|adesso|ora|devi|dovresti|puoi|potresti|mi|vorrei|voglio|fai una cosa|fammi)\s+)+/,'')
 // Rinomina categoria: «rinomina la categoria X in Y», «cambia il nome della categoria X in Y», «la categoria X chiamala Y».
 {const m=t.match(/^(?:rinomin\w*|cambi\w* (?:il )?nome (?:al|alla|della|del)?)\s*(?:la |alla )?(?:categoria|sezione)\s+(.+?)\s+(?:in|con|a)\s+(.+)$/)??t.match(/^(?:la )?(?:categoria|sezione)\s+(.+?)\s+(?:chiamal\w*|rinominal\w*|da oggi si chiama|ora si chiama)\s+(.+)$/)
  if(m){const q=quotedName(raw),sl=nameSlot(m[2]!);if(!q&&!courtesyOnly(sl.rest))return null;const s=sectionOf(m[1]!,sections),name=q?cap(q):cleanName(raw,sl.name);if(s.length===1&&name&&!sections.some(x=>x.id!==s[0]!.id&&sameSection(x.name,name)))return{kind:'rename_section',sectionId:s[0]!.id,name};return null}}
 // Crea categoria: «crea (una) categoria (che si chiama|chiamata)? X (e mettici …)», «aggiungi un'altra categoria X».
 {const m=t.match(/^(?:cre\w*|aggiung\w*|apri|fai|inserisc\w*|metti)\s+(?:anche\s+)?(?:una?\s+|un altra\s+|l altra\s+|la\s+|le\s+)?(?:nuova\s+|altra\s+)?(?:categoria|sezione)\s+(?:nuova\s+)?(?:che si chiama\s+|chiamata\s+|di nome\s+|dei\s+|degli\s+|delle\s+)?(.+)$/)
  // Frasi lunghe o con rimandi («ovvero primi, e lì aggiungi quei due piatti che ti ho detto…»): le legge il cervello.
  if(m&&(/\b(?:quei|quelli|quelle|questi|queste|li|che ti ho detto|categoria|sezione)\b/.test(m[1]!)||m[1]!.split(' ').length>10))return null
  if(m){const body=m[1]!.replace(/^(?:ovvero|cioe|tipo|chiamata|chiamandola|di nome)\s+/,''),split=body.match(/^(.+?)\s+(?:e\s+(?:li\s+|la\s+|ci\s+)?(?:mettici|metti|aggiungi|aggiungici|inserisci|dentro)\b|con\s+(?:il|la|lo|l|i|gli|le|dentro)?\b|e\s+(?:mettici|aggiungici)|,)\s*(.*)$/)
   const q=quotedName(raw),sl=nameSlot((split?split[1]!:body).replace(/\s+(?:nel|al)\s+menu\b.*$/,''));if(!q&&!courtesyOnly(sl.rest))return null
   const name=q?cap(q):cleanName(raw,sl.name);if(!name)return null
   // Il resto («il caviale a 150», «tiramisù al pistacchio a 7,50») dal testo ORIGINALE: accenti e decimali intatti.
   const rawRest=split?raw.match(/(?:\s+e\s+(?:li\s+|la\s+|ci\s+)?(?:mettici|metti|aggiungi|aggiungici|inserisci|dentro)\b|\s+con\s+|,)\s*(.*)$/i)?.[1]??split[2]!:''
   return{kind:'create_section',name,rest:rawRest.trim()}}}
 // Rinomina piatto: «rinomina X in Y», «cambia il nome di X in Y», «X chiamalo Y», «X da oggi si chiama Y», «cambia il nome del piatto X, mettici Y».
 {const m=t.match(/^(?:rinomin\w*|cambi\w* (?:il )?nome (?:a|al|alla|allo|ai|di|del|della|dello)?)\s*(?:il piatto |piatto )?(.+?)\s*(?:\s(?:in|con)\s|,?\s*(?:mettici|metti|chiamal\w*)\s+)(.+)$/)??t.match(/^(?:il piatto |piatto )?(.+?)\s+(?:chiamal[aoie]|da oggi si chiama|ora si chiama|adesso si chiama|si chiamera)\s+(.+)$/)
  // «chiama la margherita pizza margherita»: il piatto è il pezzo più lungo che indica un solo piatto, il resto è il nome.
  const ch=!m?t.match(/^chiama\s+(?:il |la |lo |l |i |gli |le )?(.+)$/):null
  if(ch){const ws=ch[1]!.split(' ');for(let k=ws.length-1;k>=1;k--){const d=dishOf(ws.slice(0,k).join(' '),refs);if(d.length===1){const q=quotedName(raw),sl=nameSlot(ws.slice(k).join(' '));if(!q&&!courtesyOnly(sl.rest))return null;const name=q?cap(q):cleanName(raw,sl.name);if(name&&fold(name)!==fold(d[0]!.name)&&!refs.some(r=>r.id!==d[0]!.id&&fold(r.name)===fold(name)))return{kind:'rename',id:d[0]!.id,name};break}}}
  if(m&&!SECTION_WORD.test(m[1]!)){const q=quotedName(raw),sl=nameSlot(m[2]!);if(!q&&!courtesyOnly(sl.rest))return null;const d=dishOf(m[1]!,refs),name=q?cap(q):cleanName(raw,sl.name);if(d.length===1&&name&&fold(name)!==fold(d[0]!.name)){if(refs.some(r=>r.id!==d[0]!.id&&fold(r.name)===fold(name)))return{kind:'ask',text:`*${name}* c'è già nel menu: dimmi un altro nome per *${d[0]!.name}*. Non ho cambiato nulla.`};return{kind:'rename',id:d[0]!.id,name}};return null}}
 // Sposta: «sposta X nei/in/tra Y», «X spostalo nei Y».
 {const m=t.match(/^(?:spost\w*|trasferisc\w*|porta)\s+(.+?)\s+(?:nei|negli|nelle|nella|nel|in|tra|fra|sotto|dentro)\s+(?:i |gli |le |la |il |l |categoria |sezione )?(.+)$/)??t.match(/^(.+?)\s+(?:spostal\w*|spostamel\w*|portal\w*)\s+(?:nei|negli|nelle|nella|nel|in|tra|fra|sotto|dentro)\s+(?:i |gli |le |la |il |l |categoria |sezione )?(.+)$/)
  // Y10: «porta i dolci negli speciali» = la categoria Dolci (se esiste), non il solo «Dolce del giorno».
  const fromSec=m?sectionOf(m[1]!.replace(/^(?:tutt[ie]\s+)?/,''),sections):[]
  // Solo al plurale («i dolci», «tutti i primi», «le pizze») e se nessun piatto si chiama proprio così («il caffè» è il piatto Caffè).
  if(m&&fromSec.length===1&&/^(?:tutt[ie]\s+)?(?:i|gli|le)\s+\S+$|^tutt[ie]\s+\S+$/.test(m[1]!.trim())&&!refs.some(r=>fold(r.name)===clean(m[1]!))){const items=refs.filter(r=>r.sectionId===fromSec[0]!.id).map(r=>r.id);const sl=nameSlot(m[2]!),s2=sectionOf(sl.name,sections);if(!items.length||!courtesyOnly(sl.rest)||s2.length!==1||s2[0]!.id===fromSec[0]!.id)return null;return{kind:'move',ids:items,sectionId:s2[0]!.id,sectionName:s2[0]!.name}}
  if(m){const ids=multiDish(m[1]!,refs);if(!ids)return null;const sl=nameSlot(m[2]!)
   // «… negli speciali e la panna cotta pure»: anche quel piatto va nella stessa categoria.
   if(!courtesyOnly(sl.rest)){const more=sl.rest.match(/^(?:e|ed)\s+(?:anche\s+|pure\s+)?(.+?)(?:\s+(?:pure|anche))?\s*[.!]?$/);const extra=more&&!new RegExp('\\b'+VERB0+'\\b').test(more[1]!)?multiDish(more[1]!,refs):null;if(!extra)return null;ids.push(...extra.filter(x=>!ids.includes(x)))}
   const target=sl.name,s=sectionOf(target,sections)
   if(s.length>1)return null;return{kind:'move',ids,sectionId:s[0]?.id??null,sectionName:cleanName(raw,target)??cap(target)}}}
 // Elimina: verbo esplicito di eliminazione + piatti nominati.
 if(DELETE_VERB.test(t)){const body=t.replace(/^(?:per favore\s+|mi\s+|puoi\s+|potresti\s+)*/,'').replace(DELETE_VERB,' ').replace(/\s+/g,' ').trim()
  const ids=multiDish(body.replace(/^(?:anche|tutt[ie] e due)\s+/,''),refs);if(ids)return{kind:'delete',ids}}
 return null}
const multiDish=(text0:string,refs:Ref[])=>{const text=text0.replace(/^(?:(?:dal|dai|dalla|nel|del) (?:menu|carta)(?: (?:di|del|della) \w+)?|anche)\s+/,'').replace(/\bsia\s+/g,' e ').replace(/^\s*e\s+/,''),parts=clean(text).split(/\s*,\s*|\s+e\s+(?=(?:il |lo |la |l |i |gli |le )?\S)/).map(x=>x.trim()).filter(Boolean)
 // «pasta e fagioli»: un nome con la «e» resta intero.
 const whole=dishOf(text,refs);if(whole.length===1)return [whole[0]!.id]
 const ids:string[]=[];for(const p of parts){const d=dishOf(p,refs);if(d.length!==1)return null;ids.push(d[0]!.id)}return ids.length?ids:null}
/** Nome nuovo come scritto dal titolare (maiuscole e accenti del testo originale), senza articoli/virgolette/punto finale. */
function cleanName(raw:string,foldedPart:string):string|null{
 const words=foldedPart.split(' ').filter(Boolean);if(!words.length)return null
 const src=raw.replace(/[«»“”"]/g,' ').split(/\s+/),pick:string[]=[]
 // Ritrova le stesse parole nel testo originale, dall'ultima occorrenza utile.
 const f=(w:string)=>fold(w);let start=-1
 for(let i=src.length-words.length;i>=0;i--){if(words.every((w,k)=>f(src[i+k]??'')===w)){start=i;break}}
 const out=start>=0?src.slice(start,start+words.length).join(' '):words.join(' ')
 let name=out.replace(/[.,;:!?]+$/,'').replace(/^(?:il|lo|la|l'|i|gli|le)\s+(?=\S)/i,'').trim()
 if(!name||name.length>80)return null
 return cap(name)}
