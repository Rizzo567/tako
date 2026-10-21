/** Prova dal vivo 21/10 sera sul QA («inizialmente sembrava andare bene, poi è diventata super buggata»). Rete di sicurezza
 * DETERMINISTICA sulla domanda in sospeso (brain_ask) e sui comandi che il modello non chiudeva. Modulo puro (niente DB, niente rete).
 * Invarianti che il route garantisce con queste funzioni, indipendenti dal modello:
 *  - «sì / ok / esatto / sì voglio X» a una domanda con azioni pronte le applica subito (mai la stessa domanda di nuovo);
 *  - un messaggio che è un comando nuovo chiude la domanda in sospeso ed è trattato da solo;
 *  - una domanda in sospeso vive al massimo 2 giri; il suo `source` è al massimo «richiesta originale + ultima risposta»;
 *  - «tutte le paste a 9», «aumenta tutti i primi di 1 euro» = un comando sul gruppo intero (solo piatti con prezzo, mai menu fissi);
 *  - «solo quelle visibili» toglie i piatti nascosti; il Menu nominato dal titolare vince su un piatto simile di un altro Menu;
 *  - rinomina di Menu e Sottomenu («cambia il nome del menù da X a Y») letta dal server (mai «non ho un comando»). */
import {plain,g9Prices,g9WordNumber,relativeDelta,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'
import {sameSection,courseRank} from './twilio-menu-structure.js'
import {isAffirmative,type BrainAsk} from './owner-brain-r.js'

export type SeraMenu={id:string,name:string,pricing?:'carta'|'fisso',active?:boolean,secs?:{id:string,name:string,active:boolean,parent:string|null,items:number}[]}

// ---------- risposte alla domanda in sospeso ----------
const YES_LEAD=/^(?:s[iì]|ok|okay|okey|oki|esatto|certo|certamente|va bene|va benissimo|benissimo|ottimo|perfetto|d accordo|giusto|vai|procedi|fallo|confermo|conferma|crealo|creala|creali|assolutamente|proprio cosi|si si|yes)\b/
// Parole che possono stare accanto a un sì senza cambiare la proposta («sì voglio chiamarlo primi», «ok crealo pure grazie»).
const YES_FILL=new Set(['si','ok','va','bene','pure','dai','grazie','mille','allora','tutto','tutti','tutte','prego','benissimo','ottimo','procediamo','esatto','proprio','quello','quella','quelli','quelle','voglio','vorrei','chiamarlo','chiamarla','chiamarli','chiamalo','chiamala','chiamali','chiamiamolo','chiamato','crealo','creala','creali','crea','fallo','falla','cosi','come','hai','detto','dici','suggerisci','consigli','proposto','perfetto','certo','giusto','vai','e','il','lo','la','le','i','gli','un','una','sottomenu','nome','menu','con','pure','anche','metti','mettilo','mettila','mettili','aggiungi','aggiungilo','aggiungila','aggiungili','benone','yes','okay','d','accordo','confermo','conferma','procedi','assolutamente','esattamente','quel','benissimo','ottimo'])
const NEG=/\b(?:no|non|anzi|ma|pero|invece|tranne|aspetta|niente|annull\w*|lascia|stop|meglio|piuttosto|diverso|altro|altra)\b/
/** Parole del nome delle azioni in sospeso (create_section «Primi», create «Lasagne», rinomine…): un «sì voglio chiamarlo primi» le ripete. */
const actionWords=(ask:Pick<BrainAsk,'actions'|'draft'|'question'>)=>new Set([...(ask.actions??[]).flatMap(a=>'name' in a&&typeof (a as any).name==='string'?plain((a as any).name).split(' '):[]),...(ask.draft?.name?plain(ask.draft.name).split(' '):[]),...(ask.draft?.sectionName?plain(ask.draft.sectionName).split(' '):[])].filter(w=>w.length>=3))
/** Il messaggio è un sì alla proposta in sospeso (nessuna correzione, nessun numero, nessun nome diverso). */
export function yesToAsk(text:string,ask:Pick<BrainAsk,'actions'|'draft'|'question'>):boolean{
 if(isAffirmative(text))return true
 const p=plain(text);if(!YES_LEAD.test(p)||/\d/.test(p)||NEG.test(p))return false
 const w=p.split(' ').filter(Boolean);if(w.length>9)return false
 const known=actionWords(ask),q=new Set(plain(ask.question??'').split(' ').filter(x=>x.length>=3))
 return w.every(x=>YES_FILL.has(x)||known.has(x)||(x.length>=3&&[...known].some(k=>sameSection(k,x)))||q.has(x))}
/** «solo quelle visibili», «solamente i visibili», «quelle che si vedono». */
export const visibleOnly=(text:string)=>/\b(?:visibil\w*|che si vedono|non nascost\w*|in vista)\b/.test(plain(text))
/** «tutte», «tutti e cinque», «sì tutte»: la scelta è l'insieme intero dei candidati. */
export const allChosen=(text:string)=>{const p=plain(text);return /\btutt[ieoa]\b/.test(p)&&p.split(' ').length<=8&&!NEG.test(p)}

// ---------- comando nuovo mentre c'è una domanda in sospeso ----------
const CMD_VERB=/\b(?:modifich\w*|aggiung\w*|inserisc\w*|aument\w*|alz\w*|abbass\w*|diminu\w*|ribass\w*|scont\w*|togli\w*|nascond\w*|elimin\w*|cancell\w*|rinomin\w*|cambi\w* (?:il |anche il )?nome|sposta|spostare|segna\w*|rimett\w*|mostra|metti|mettere|porta|portare|crea|creare|cambia|modifica)\b/
// Verbi con il pronome attaccato («mettilo», «crealo», «chiamalo», «spostala»): rispondono alla domanda, non sono un comando nuovo.
const CLITIC=/\b(?:mett|cre|chiam|spost|aggiung|port|fa|lasci|aggiorn|tien|rimett|nascond|togl|elimin|cancell)\w*?(?:lo|la|li|le|ne|celo|cela|melo|mela)\b/
const ANSWER_LEAD=/^(?:s[iì]|no|ok|okay|anzi|invece|solo|solamente|soltanto|ho detto|intendevo|esatto|quell[aoie]|il primo|la prima|il secondo|la seconda|tutt[ieoa]|entramb\w*|nessun\w*|giusto|certo|va bene|perfetto|si ma|no ma)\b/
const DROP_PENDING=/\b(?:fa niente|fa lo stesso|lascia (?:stare|perdere)|lasciamo (?:stare|perdere)|non importa|non fa niente|vabbe|va be|vabbeh|lascia correre)\b/
const KIND=(p:string)=>/\b(?:aggiung\w*|inserisc\w*|crea\w*|nuov[oa])\b/.test(p)?'create':/\b(?:aument\w*|alz\w*|abbass\w*|diminu\w*|ribass\w*|scont\w*|prezz\w*|euro|costa\w*|passa)\b|\d/.test(p)?'price':/\b(?:togli\w*|nascond\w*|mostra|rimett\w*)\b/.test(p)?'hide':/\b(?:elimin\w*|cancell\w*)\b/.test(p)?'delete':/\b(?:rinomin\w*|nome)\b/.test(p)?'rename':/\bspost\w*\b/.test(p)?'move':'other'
const STOPW=new Set(['menu','sottomenu','piatto','piatti','prezzo','prezzi','euro','tutti','tutte','della','delle','degli','dello','nella','nelle','negli','alla','alle','agli','allo','anche','voglio','vorrei','adesso','allora','quello','quella','questi','queste','sono','quelli','quelle','perche','dentro','dove','come'])
/** true = il messaggio è un comando indipendente dalla domanda in sospeso: la domanda si chiude e il messaggio va da solo.
 * Vale per le domande del modello (brain_ask) senza piatti omonimi in attesa. `about` = domanda + richiesta originale. */
export function newCommandOverAsk(text:string,ask:Pick<BrainAsk,'question'|'source'|'twins'|'ids'>,refs:MenuRef[]=[]):boolean{
 const p=plain(text),w=p.split(' ').filter(Boolean)
 if(DROP_PENDING.test(p))return CMD_VERB.test(p.replace(DROP_PENDING,' '))||w.length<=4
 if(ask.twins?.length)return false
 if(w.length<3||ANSWER_LEAD.test(p)||!CMD_VERB.test(p)||CLITIC.test(p)||/\b(?:anche|pure)\b/.test(p))return false
 const about=plain((ask.question??'')+' '+(ask.source??''))
 // Verbo di un altro tipo (prezzo dopo un'aggiunta, aggiunta dopo un prezzo…): comando nuovo.
 if(KIND(p)!==KIND(plain(ask.source??''))&&KIND(p)!=='other')return true
 // Stesso tipo di verbo: nuovo solo se nomina parole (piatti, nomi) che nella domanda e nella richiesta non ci sono.
 const fresh=w.filter(x=>x.length>=4&&!STOPW.has(x)&&!CMD_VERB.test(x)&&!(' '+about+' ').includes(' '+x.slice(0,Math.max(4,x.length-1))))
 const namedNew=refs.some(r=>{const n=plain(r.name);return n.length>=3&&(' '+p+' ').includes(' '+n+' ')&&!(' '+about+' ').includes(' '+n+' ')})
 return namedNew||fresh.length>=2}

// ---------- source della domanda: richiesta originale + ultima risposta, mai di più ----------
const SRC_MAX=600
/** Richiesta che ha aperto la domanda (campo `origin`; per le domande scritte prima del 21/10 sera: la prima riga del vecchio source). */
export const askOrigin=(ask:Pick<BrainAsk,'source'>&{origin?:string})=>String(ask.origin??String(ask.source??'').split(' \n ')[0]??'').slice(0,SRC_MAX)
/** Source della domanda nuova: se continua la stessa domanda, origine + questa risposta; altrimenti solo il messaggio. */
export function nextAskSource(prev:(Pick<BrainAsk,'source'>&{origin?:string,rounds?:number})|null,text:string):{source:string,origin:string,rounds:number}{
 const t=text.slice(0,SRC_MAX);if(!prev)return{source:t,origin:t,rounds:1}
 const origin=askOrigin(prev);return{source:(origin?origin+' \n ':'')+t,origin,rounds:(prev.rounds??1)+1}}
/** Tetto della domanda in sospeso: dopo 2 giri si chiude. */
export const ASK_MAX_ROUNDS=2

// ---------- Menu nominato, portata del piatto, sottomenu adatto ----------
const menuKey=(n:string)=>plain(n).replace(/^(?:il |un |nuovo )?menu /,'').replace(/^(?:del |della |di )/,'').trim()
/** Menu nominati nel testo («nel menù pranzo», «menu del giorno», «a pranzo»). Il nome più lungo vince («menu del giorno» ≠ «menu»). */
export function namedMenus<T extends {name:string}>(text:string,menus:T[]):T[]{
 const p=' '+plain(text)+' ',hits=menus.filter(m=>{const k=menuKey(m.name);if(k.length<3)return false;if(p.includes(' '+k+' ')||p.includes(' menu '+k+' '))return true
  // Nome lungo («di verifica web qa»): basta la parte detta dopo «menu» se indica solo questo Menu.
  const ws=k.replace(/^(?:del|della|di|dei)\s+/,'').split(' ');return ws.length>1&&ws[0]!.length>=4&&new RegExp(' menu (?:del |della |di |dei )?'+ws[0]+' ').test(p)})
 return hits.filter(m=>!hits.some(o=>o!==m&&menuKey(o.name).length>menuKey(m.name).length&&menuKey(o.name).includes(menuKey(m.name))))}
const COURSE:[RegExp,string][]=[[/\b(?:past[ae]|spaghett\w*|lasagn\w*|gnocch\w*|risott\w*|riso|tagliatell\w*|penne|ravioli|tortell\w*|fettuccin\w*|carbonara|amatriciana|gricia|minestr\w*|zupp\w*|vellutat\w*|orecchiette|paccheri|rigatoni|linguine|bucatini|trofie|cannelloni|primi|primo)\b/,'Primi'],
 [/\b(?:cotolett\w*|poll\w*|manzo|tagliata|filetto|polpett\w*|salsicc\w*|arrost\w*|frittat\w*|salmone|branzino|orata|bistecc\w*|hamburger|burger|scaloppin\w*|spezzatino|grigliata|braciol\w*|involtin\w*|secondi|secondo)\b/,'Secondi'],
 [/\b(?:patat\w*|insalat\w*|verdur\w*|spinaci|cicoria|friarielli|contorn\w*)\b/,'Contorni'],
 [/\b(?:tiramisu|torta|panna cotta|pannacotta|gelat\w*|cannol\w*|crostat\w*|semifredd\w*|sorbett\w*|babà|baba|dolc\w*|cheesecake|profiterol\w*)\b/,'Dolci'],
 [/\b(?:pizz\w*|margherita|diavola|marinara|capricciosa|calzone)\b/,'Pizze'],
 [/\b(?:bruschett\w*|tagliere|caprese|antipast\w*|crocchett\w*|suppl\w*|arancin\w*|olive ascolane)\b/,'Antipasti']]
/** Portata del piatto dal suo nome (per suggerire il sottomenu): null se non si capisce. */
const DSTOP=new Set(['al','alla','alle','allo','ai','agli','all','di','del','della','dei','delle','con','e','ed','in','il','la','lo','le','i','gli','l','un','una'])
const stemW=(w:string)=>w.length>4?w.replace(/[aeiou]$/,''):w
/** Il piatto è detto per intero (ogni parola significativa del nome, singolare/plurale tollerati): «gnocchi al ragu» = Gnocchi al ragù,
 * «le lasagne» = Lasagna; «pasta al ragù» no (manca «pasta»). Più stretto di g9DishMentioned (che basta una parola distintiva). */
export function fullyNamed(name:string,text:string):boolean{const ws=plain(name).split(' ').filter(w=>w&&!DSTOP.has(w));if(!ws.length)return false
 const tw=plain(text).split(' ');return ws.every(w=>tw.some(x=>x===w||(w.length>=4&&x.length>=4&&stemW(x)===stemW(w))))}
export const dishCourse=(name:string)=>{const p=plain(name);for(const [re,c] of COURSE)if(re.test(p))return c;return null}
/** Sottomenu del Menu adatto al piatto: quello della stessa portata (null = nessuno adatto). */
export function suitableSection(menuName:string,dishName:string,sections:SectionRef[]):SectionRef|null{
 const c=dishCourse(dishName);if(!c)return null
 return sections.find(s=>s.menu===menuName&&(sameSection(s.name,c)||courseRank(s.name)===courseRank(c)&&courseRank(c)>0))??null}

// ---------- «tutte le paste a 9», «aumenta tutti i primi di 1 euro» ----------
export type GroupResult={actions:MenuAction[],label:string}|{ask:'menu',menus:string[],label:string}|null
/** Comando su un gruppo intero detto con «tutti/tutte»: un sottomenu («i primi») o una parola dei nomi («le paste»). Solo piatti
 * con prezzo e fuori dai Menu a prezzo fisso. Un prezzo assoluto unico o una differenza. `visible` = solo i visibili. */
export function groupCommand(message:string,refs:MenuRef[],sections:SectionRef[],fixedSecIds:Set<string>,o:{visible?:boolean,menus?:{name:string}[]}={}):GroupResult{
 const p=plain(message),m=p.match(/\btutt[ieoa] (?:quant[ieoa] )?(?:i |le |gli |l )?([a-z]{3,})/)??p.match(/\b(?:i|le|gli) ([a-z]{3,}) tutt[ieoa]\b/);if(!m)return null
 const word=m[1]!;if(['piatti','prezzi','menu','sottomenu','quanti','cose'].includes(word))return null
 const rd=relativeDelta(message),abs=[...new Set(g9Prices(message,false))]
 const sp=singlePrice(message),delta=rd?rd.delta:null,price=!rd?(sp??(abs.length===1?abs[0]!:null)):null;if(delta===null&&price===null)return null
 const visible=o.visible??visibleOnly(message),said=namedMenus(message,o.menus??[...new Map(sections.map(s=>[s.menu,{name:s.menu}])).values()]).map(x=>x.name)
 const priced=(r:MenuRef)=>r.price>0&&!fixedSecIds.has(r.sectionId??'')&&(!visible||!r.hidden)&&(!said.length||said.includes(r.menu))
 const secs=sections.filter(s=>sameSection(s.name,word)&&refs.some(r=>r.sectionId===s.id&&priced(r)))
 let items:MenuRef[]=[],label=word
 if(secs.length){const menus=[...new Set(secs.map(s=>s.menu))];if(menus.length>1)return{ask:'menu',menus,label:secs[0]!.name};items=refs.filter(r=>secs.some(s=>s.id===r.sectionId)&&priced(r));label=secs[0]!.name}
 else{const stem=word.length>4?word.replace(/[aeio]$/,''):word;if(stem.length<4)return null;items=refs.filter(r=>priced(r)&&plain(r.name).split(' ').some(x=>x.startsWith(stem)&&x.length<=stem.length+2))}
 if(items.length<(secs.length?1:2))return null
 const actions=items.flatMap(r=>{const v=price!==null?price:Math.round((r.price+delta!)*100)/100;return v>0&&Math.abs(v-r.price)>=0.005?[{kind:'price',id:r.id,price:v} as MenuAction]:[]})
 return actions.length?{actions,label}:null}
/** Stesso prezzo assoluto (≥2 piatti, «tutte a 9»): si applica subito come l'aumento uniforme. */
export function uniformTarget(actions:MenuAction[]):number|null{if(actions.length<2||!actions.every(a=>a.kind==='price'))return null;const v=new Set(actions.map(a=>Math.round((a as any).price*100)));return v.size===1?[...v][0]!/100:null}
export const uniformTargetReply=(price:number,count:number,facts:string)=>['Messi a '+price.toFixed(2).replace('.',',')+' € i prezzi di '+count+' piatti.',facts].filter(Boolean).join('\n\n')
export const UNDO_HINT='Per tornare come prima scrivi *annulla* entro 10 minuti.'

// ---------- rinomina di Menu e Sottomenu (letta dal server) ----------
export type RenameHit={kind:'rename_menu',menuId:string,before:string,name:string}|{kind:'rename_section',sectionId:string,before:string,name:string}|{ask:string}
const RN_TAIL=/\s+(?:per favore|per piacere|grazie(?: mille)?|subito|dai|se puoi|ok)\s*$/i
const cleanNew=(s:string)=>{let t=s.replace(/[«»"“”'’*_.!?]+/g,' ').replace(/\s+/g,' ').trim();for(let i=0;i<3;i++)t=t.replace(RN_TAIL,'').trim();t=t.replace(/^(?:il |lo |la |l |un |una )/i,'').trim();return t&&t.split(' ').length<=6?t.charAt(0).toLocaleUpperCase('it')+t.slice(1):''}
/** «cambia il nome del menù da menù di verifica a menù di prova», «rinomina il menu pranzo in Pranzo veloce», «il sottomenu Completo
 * chiamalo Primi», «il menu cena ora si chiama Sera». null = non è una rinomina di Menu/Sottomenu. */
export function parseStructRename(text:string,menus:{id:string,name:string}[],sections:SectionRef[]):RenameHit|null{
 const raw=text.replace(/[🎤]/gu,' ').replace(/\bmen[uù](?![a-z])/gi,'menu').replace(/\s+/g,' ').trim(),p=plain(raw)
 if(!/\b(?:rinomin\w*|cambi\w* (?:il |anche il )?nome|chiamal[oa]|chiama (?:il|la)|si chiam\w*|nome nuovo|nuovo nome)\b/.test(p))return null
 const isSec=/\b(?:sottomenu|sezione|categoria)\b/.test(p),isMenu=/\bmenu\b/.test(p.replace(/\bsottomenu\b/g,''))
 if(!isSec&&!isMenu)return null
 // «… da X a Y», «… X in Y», «… X con Y», «… X: Y», «X chiamalo Y», «X ora si chiama Y»
 const pats=[/(?:sottomenu|menu|sezione|categoria)\s+([^:]+?)\s*:\s*(.+)$/i,/\bda\s+(.+?)\s+(?:a|in)\s+(.+)$/i,/\b(?:rinomin\w*|cambi\w* (?:il |anche il )?nome (?:a|al|del|della|dello|di))\s+(?:il |la |lo |l')?(?:sottomenu |menu |sezione |categoria )?(.+?)\s+(?:in|come|con|a)\s+(.+)$/i,/(?:sottomenu|menu|sezione)\s+(.+?)\s+(?:chiamal[oa]|ora si chiama|adesso si chiama|da oggi si chiama|si chiamera)\s+(.+)$/i]
 for(const re of pats){const m=raw.match(re);if(!m)continue
  const oldSaid=plain(m[1]!.replace(/^(?:al |del |il |la |lo |l')?(?:sottomenu|menu|sezione|categoria)\s+/i,'')),name=cleanNew(m[2]!.replace(/^(?:il |la |lo |l')?(?:sottomenu|sezione|categoria)\s+/i,'')); if(!name)return{ask:'nome'}
  const oldK=oldSaid.replace(/^(?:del |della |di )/,'').trim()
  if(isSec){const secSaid=oldSaid.replace(/ (?:del|nel|dal|in) (?:menu )?.*$/,'').trim(),c=sections.filter(s=>sameSection(s.name,secSaid)||plain(s.name)===secSaid);const inMenu=namedMenus(raw,menus.map(x=>({...x}))).map(x=>x.name),c2=inMenu.length?c.filter(s=>inMenu.includes(s.menu)):c
   if(c2.length===1){if(sections.some(s=>s.menu===c2[0]!.menu&&s.id!==c2[0]!.id&&sameSection(s.name,name)))return{ask:'nome_doppio'};return{kind:'rename_section',sectionId:c2[0]!.id,before:c2[0]!.name,name}}
   if(c2.length>1)return{ask:'sottomenu_ambiguo'};if(isSec)return{ask:'sottomenu_da_trovare'}}
  const cand=menus.filter(x=>{const k=menuKey(x.name);return !!oldK&&(k===oldK||k.startsWith(oldK+' ')||plain(x.name)===oldSaid)})
  if(cand.length===1){const nm=/^menu\b/i.test(name)||!/^menu\b/i.test(cand[0]!.name.trim())?name:name;if(menus.some(x=>x.id!==cand[0]!.id&&menuKey(x.name)===menuKey(nm)))return{ask:'nome_doppio'};return{kind:'rename_menu',menuId:cand[0]!.id,before:cand[0]!.name,name:nm}}
  return{ask:cand.length?'menu_ambiguo':'menu_da_trovare'}}
 return{ask:'nome'}}
export const renameAskText=(why:string,menus:{name:string}[],sections:SectionRef[],isSec:boolean)=>why==='nome'?'Come vuoi chiamarlo? Scrivimi il nome nuovo, per esempio «rinomina il menu pranzo in Pranzo veloce».':why==='nome_doppio'?'C’è già un altro con quel nome: che nome vuoi dare?':isSec||why.startsWith('sottomenu')?'Quale sottomenu vuoi rinominare? Ci sono: '+[...new Set(sections.map(s=>s.name+' ('+s.menu+')'))].slice(0,10).join(', ')+'.':'Quale Menu vuoi rinominare? Ci sono: '+menus.map(m=>m.name).join(', ')+'.'

// ---------- comando chiaro, domanda specifica al posto di «Non ho cambiato nulla» ----------
/** Il messaggio è un comando (verbo d'azione o prezzo detto), non una rinuncia né un saluto. */
export function clearCommand(text:string):boolean{const p=plain(text);if(DROP_PENDING.test(p)&&!CMD_VERB.test(p.replace(DROP_PENDING,' ')))return false;if(/^(?:no|annulla|niente|ok|si|grazie|ciao)(?: \w+)?$/.test(p))return false;return (CMD_VERB.test(p)||/\b(?:passa|passano|costa|costano|a \d)/.test(p))&&p.split(' ').length>=3}
/** Domanda specifica e nuova per un comando che il server non ha potuto eseguire: ripete il comando detto e chiede ciò che serve. */
export function specificQuestion(text:string,candidates:MenuRef[]):string{
 const said=text.replace(/[🎤]/gu,'').replace(/\s+/g,' ').trim().slice(0,90)
 if(candidates.length>=2)return 'Per «'+said+'» a quale piatto ti riferisci? Rispondi col numero.'
 if(candidates.length===1)return 'Per «'+said+'» intendi *'+candidates[0]!.name+'*? Rispondi sì oppure dimmi il nome giusto.'
 return 'Per «'+said+'» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».'}

// ---------- prezzi detti ----------
/** Un solo prezzo detto nel messaggio (cifre: «a 10», «12,50»; altrimenti a parole). null = nessuno o più di uno. */
export function singlePrice(text:string):number|null{const d=[...new Set([...text.replace(/(\d)\s*,\s*(\d{1,2})\b/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)].map(m=>Number(m[0])))]
 if(d.length)return d.length===1&&d[0]!>0?d[0]!:null;const w=[...new Set(g9Prices(text,false))];return w.length===1&&w[0]!>0?w[0]!:null}
const PRICE_FILL=new Set(['a','e','euro','eur','costa','costano','costi','prezzo','il','lo','la','le','li','metti','mettilo','mettila','mettile','mettili','fai','falle','fallo','sono','al','fa','ok','si','allora','diciamo','tipo','cent','centesimi','virgola','mezzo','circa','facciamo','direi','va','bene','ma','pure','dai','prego','grazie'])
/** Il messaggio è solo un prezzo («12», «a 12 euro», «dodici e cinquanta», «mettile a 12»): il prezzo, altrimenti null. */
export function onlyPrice(text:string):number|null{const p=plain(text);if(!p||/\b(?:no|non|anzi)\b/.test(p))return null
 const rest=p.split(' ').filter(w=>w&&!/^\d+$/.test(w)&&g9WordNumber(w)===null&&!PRICE_FILL.has(w));return rest.length?null:singlePrice(text)}
/** Nome del sottomenu detto come risposta alla proposta («no, chiamalo Paste fresche», «chiamiamolo Primi piatti», «il nome è X»). */
export function answerSectionName(text:string):string|null{const m=text.replace(/[🎤]/gu,' ').match(/\b(?:chiamal[oaie]|chiamiamol[oaie]|chiamarl[oaie]|il nome (?:e|è)|nome)\s+(.+)$/i);if(!m)return null;const n=cleanNew(m[1]!);return n&&!/\b(?:non|no)\b/i.test(n)?n:null}

// ---------- sessione di modifica dei piatti di oggi («modifichiamo menu pranzo») ----------
/** Stato nel pending (brain_ask.session): piatti detti per sottomenu (nomi e azioni della sostituzione), sottomenu che restano com'erano. */
export type SessState={menuId:string,menuName:string,done:Record<string,string[]>,kept:string[],acts:MenuAction[],rounds?:number}
export const SESSION_MAX_ROUNDS=10
const START=/\b(?:modifich\w*|cambi\w*|aggiorn\w*|rifacciamo|rifare|rifai|facciamo|sistem\w*|impost\w*|prepar\w*|inserisc\w*|inseriamo|mettiamo|scriviamo|cambiamo|aggiorniamo)\b/
const NOT_SESSION=/\b(?:nome|rinomin\w*|visibil\w*|mostra\w*|nascond\w*|elimin\w*|cancell\w*|aument\w*|abbass\w*|alz\w*|diminu\w*|prezz\w*|euro|formul\w*|fisso|carta|opzion\w*)\b|\d/
/** «modifichiamo menu pranzo», «aggiorniamo il menu del giorno», «facciamo il menu di oggi del pranzo»: il Menu della sessione (uno solo). */
export function sessionStart<T extends {name:string}>(text:string,menus:T[]):T|null{const p=plain(text);if(!/\bmenu\b/.test(p.replace(/\bsottomenu\b/g,''))||!START.test(p)||NOT_SESSION.test(p))return null;const m=namedMenus(text,menus);return m.length===1?m[0]!:null}
/** Parole del messaggio oltre all'avvio («modifichiamo menu pranzo» → 0): con piatti dentro il messaggio va anche al modello. */
export function sessionRest(text:string,menuName:string):number{const k=new Set(menuKey(menuName).split(' '));return plain(text).split(' ').filter(w=>w&&!START.test(w)&&!k.has(w)&&!['menu','il','lo','la','del','di','dei','oggi','giorno','ok','allora','dai','adesso','ora','i','piatti','che','per','a','e','un','po','facciamo','vorrei','voglio','possiamo','ciao'].includes(w)).length}
export const sessionExit=(text:string)=>/^(?:(?:no|ok|allora|aspetta|scusa)\s+)*(?:annulla(?: tutto)?|basta|stop|lascia (?:stare|perdere)|lasciamo (?:stare|perdere)|niente|esci|non importa|fa niente|lascia stare tutto|non fare niente)(?:\s+(?:grazie|dai))?$/.test(plain(text))
export const sessionDone=(text:string)=>/\b(?:fatto|finito|ho finito|basta cosi|e tutto|tutto qui|ok cosi|va bene cosi|applica|pubblica|il resto (?:uguale|resta\w*|com e|come prima)|gli altri (?:restano|rimangono|uguali|come prima|com erano)|tutto il resto|nient altro|basta)\b/.test(plain(text))
const KEEP=/\b(?:restan\w*|resta|rimang\w*|uguali|uguale|come prima|com erano|com era|non (?:li |le )?cambi\w*|salta|saltali|saltiamo|lascial[ie]|lascia(?:li|le)? cosi|invariat\w*|stessi|stesse|non tocc\w*)\b/
/** Sottomenu che il titolare dice di lasciare come sono («i secondi restano uguali», «salta i contorni», «salta» = quello che si aspettava). */
export function keptSections(text:string,secs:SectionRef[],missing:SectionRef[]):string[]{const p=plain(text);if(!KEEP.test(p))return[]
 const named=secs.filter(s=>p.split(' ').some(w=>w.length>=4&&sameSection(s.name,w))||(' '+p+' ').includes(' '+plain(s.name)+' '))
 return named.length?named.map(s=>s.id):/^(?:salta\w*|saltiamo|no salta|resta(?:no)? (?:uguali|cosi)|uguali?)$/.test(p)&&missing[0]?[missing[0].id]:[]}
/** Comando nuovo dentro la sessione: cambi di prezzo, rinomine, eliminazioni, visibilità, o un altro Menu nominato. */
export function newCommandInSession(text:string,menuName:string,menus:{name:string}[]):boolean{const p=plain(text)
 if(/\b(?:aument\w*|alz\w*|abbass\w*|diminu\w*|ribass\w*|rinomin\w*|cambi\w* (?:il )?nome|elimin\w*|cancell\w*|visibil\w*|mostra\w*|scont\w*|evidenza|annulla l ultima)\b/.test(p))return true
 // «aggiungi X a 10»: un'aggiunta col prezzo è un comando a sé (il Menu nominato e il sottomenu li cura il server).
 if(/\b(?:aggiung\w*|inserisc\w*)\b/.test(p)&&/\d/.test(p))return true
 return namedMenus(text,menus).some(m=>m.name!==menuName)}
/** Sottomenu del Menu ancora da dire. */
export const sessionMissing=(s:SessState,secs:SectionRef[])=>secs.filter(x=>x.menu===s.menuName&&!s.done[x.id]&&!s.kept.includes(x.id))
const mLabelOf=(n:string)=>/^men[uù]\b/i.test(n.trim())?'*'+n.trim()+'*':'Menu *'+n.trim()+'*'
export const sessionOpening=(s:SessState,secs:SectionRef[])=>{const ms=secs.filter(x=>x.menu===s.menuName);return 'Ok, modifichiamo i piatti di oggi del '+mLabelOf(s.menuName)+': cosa metto'+(ms.length?' in '+ms.map(x=>'*'+x.name+'*').join(', ')+'':'')+'? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.'}
/** Domanda su ciò che manca (diversa ogni volta: riassume cosa è già segnato). */
export function sessionAsk(s:SessState,secs:SectionRef[]):string{const miss=sessionMissing(s,secs),done=secs.filter(x=>s.done[x.id])
 const head=done.length?'Segnato: '+done.map(x=>'*'+x.name+'* ('+s.done[x.id]!.join(', ')+')').join(' · ')+'. ':''
 return head+(miss.length===1?'E nei *'+miss[0]!.name+'* cosa metto? Se restano come sono scrivi «restano uguali».':'E per '+miss.map(x=>'*'+x.name+'*').join(' e ')+' cosa metto? Se qualcuno resta com’è dimmelo.')}
