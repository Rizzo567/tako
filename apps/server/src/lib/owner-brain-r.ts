/** Fase R (17/10/2026 notte, decisione di Manuel «un solo cervello»). Col cervello acceso OGNI messaggio del titolare va al
 * modello con il contesto completo; il server non interpreta frasi: valida il piano, impone i vincoli (conferma esplicita per
 * eliminare / riepiloghi, annulla solo entro 10 minuti) e aggiunge in coda alla bozza del modello solo FATTI riletti dal DB.
 * Testi fissi ammessi: la riga «assistente automatico» (route) e `copy.brainDown` quando Groq non risponde.
 * Modulo puro (niente DB, niente rete): stato in sospeso, strumenti di controllo, esito del turno, motivi di rifiuto per
 * l'auto-correzione, fatti della risposta. */
import {plain,g9Prices,describeAction,withNewSections,itemLabel,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'
import type {Hold} from './twilio-menu-hold.js'
import {sameSection} from './twilio-menu-structure.js'

export const CONTROL_ACTIONS=['confirm_pending','cancel_pending','undo_last'] as const
export type ControlAction=typeof CONTROL_ACTIONS[number]

/** Stato in sospeso scritto dal percorso R (una riga per numero in tako_whatsapp_proposals). */
export type BatchWhy='delete'|'recap'|'section'|'price'
export type BrainAsk={kind:'brain_ask',question:string,ids:string[],actions:MenuAction[],source:string,draft?:{name:string,price:number|null,sectionId:string|null,sectionName:string|null}|null}
export type Pend={kind:'batch',actions:MenuAction[],why:BatchWhy}|{kind:'hold',actions:MenuAction[],hold:Hold}|{kind:'ask',ask:BrainAsk}|{kind:'other'}|null
export function pendOf(cmd:any):Pend{
 if(!cmd||typeof cmd!=='object')return null
 if(cmd.kind==='batch'&&Array.isArray(cmd.actions)){const a=cmd.actions as MenuAction[];return{kind:'batch',actions:a,why:cmd.why??(a.some(x=>x.kind==='delete')?'delete':a.some(x=>x.kind==='create_section')?'section':'recap')}}
 if(cmd.kind==='hold'&&Array.isArray(cmd.actions))return{kind:'hold',actions:cmd.actions,hold:cmd as Hold}
 if(cmd.kind==='brain_ask')return{kind:'ask',ask:cmd as BrainAsk}
 return{kind:'other'}}

// ---------- vincoli sugli strumenti di controllo ----------
// Conferma esplicita: il messaggio è fatto SOLO di parole di conferma («sì», «ok», «sì eliminalo», «cancella pure», «ok grazie»).
const YES_CORE=new Set(['si','ok','okay','okey','oki','conferma','confermo','confermato','confermiamo','certo','certamente','esatto','vai','procedi','pubblica','pubblicalo','pubblicala','pubblicali','pubblicale','elimina','eliminalo','eliminala','eliminali','eliminale','cancella','cancellalo','cancellala','cancellali','cancellale','crea','creala','crealo','creale','perfetto','yes','fallo','falla','accordo','giusto','assolutamente','toglilo','toglila','levalo','levala'])
const YES_FILL=new Set(['va','bene','pure','dai','si','sì','grazie','mille','d','e','allora','tutto','tutti','le','li','lo','la','prego','benissimo','ottimo','procediamo','esatto','proprio','quello','quella','quelli','quelle'])
export function isAffirmative(message:string){const w=plain(message).split(' ').filter(Boolean);return w.length>0&&w.length<=7&&w.every(x=>YES_CORE.has(x)||YES_FILL.has(x))&&w.some(x=>YES_CORE.has(x)||x==='bene')}
// Conferma (fase R, R5.1): la decide il MODELLO (confirm_pending) in qualunque forma («va bene così», «ok vai», «procedi»…).
// Il server la rifiuta solo se il messaggio la contraddice: negazione/correzione, numeri, richiesta lunga. È un vincolo, non una lista di frasi.
const CONFIRM_STOP=/\b(no|non|anzi|aspetta|tranne|pero|però|ma|invece|cambia|lascia|stop|annull\w*|niente|sbagliat\w*|meglio|prima)\b|\d/
const CONFIRM_OTHER=/\b(mett\w*|togli\w*|nascond\w*|aggiung\w*|spost\w*|rinomin\w*|alz\w*|abbass\w*|aument\w*|diminu\w*|scont\w*|promo|evidenz\w*|finit\w*|esaurit\w*|disponibil\w*|prezz\w*|mostr\w*|rimett\w*|lev\w*|chiam\w*|categori\w*|piatt\w*|euro)\b/
/** true = il messaggio non può confermare (contraddice, chiede altro o nomina un piatto). refs = piatti del menu. */
export function confirmBlocked(message:string,refs:{name:string}[]=[]){const p=plain(message).replace(/\b(?:toglil|leval|levatel)[oaie]\b/g,' ').replace(/\s+/g,' ').trim(),w=p.split(' ').filter(Boolean)
 if(!w.length||w.length>10||CONFIRM_STOP.test(p)||CONFIRM_OTHER.test(p))return true
 const words=new Set(w.filter(x=>x.length>=3));return refs.some(r=>plain(r.name).split(' ').some(x=>x.length>=3&&words.has(x)))}
// Richiesta di annullamento: deve esserci nel messaggio (il modello non annulla di sua iniziativa).
const UNDO_CUE=/\b(annull\w*|torna\w* (?:indietro|come prima|com era)|tornare indietro|indietro|com era|come prima|com eri|anzi no|anzi|ho sbagliato|sbagliato|sbagliata|errore|rimett\w* (?:tutto )?(?:a )?(?:posto|come)|disfa\w*|lascia\w* (?:stare|perdere)|non (?:lo |la |li |le )?volevo|ripristin\w*|no no|era giusto|andava bene)\b|^(?:no|scusa|aspetta|ops)(?: (?:no|scusa|aspetta|ops))*$/
export const undoRequested=(message:string)=>UNDO_CUE.test(plain(message))
const CANCEL_WORDS=/\b(annull\w*|lascia\w* (?:stare|perdere)|niente|non pubblicare|non farlo)\b/

// ---------- motivi di rifiuto (auto-correzione: il server rimanda al modello il perché, una volta) ----------
const REASON:Record<string,string>={
 prezzo_non_detto:'un prezzo del piano non è stato detto dal titolare (né in questo messaggio né, con un rimando esplicito, prima)',
 riferimento_prezzo_non_valido:'il riferimento «stesso prezzo di» non è valido: il piatto di riferimento deve essere nominato',
 delta_senza_verbo:'una differenza di prezzo senza un verbo che la dica (aumenta/abbassa/togli N euro…)',
 differenza_come_prezzo:'un numero detto come differenza («uno in meno», «+1») è stato usato come prezzo: usa price_delta',
 piatto_ambiguo:'il piatto è ambiguo: più piatti del menu corrispondono alle parole del titolare',
 rimando_incerto:'non è chiaro a quale piatto si riferisce il rimando («la», «quello», «no scusa 14»)',
 prezzo_di_un_altro_piatto:'un prezzo è stato messo sul piatto sbagliato: ogni prezzo va al piatto della sua parte del messaggio',
 valore_contrario:'il valore ha il verso opposto a quello detto (finito/tornato, nascondi/rimetti, evidenza sì/no)',
 piatto_diverso:'il piatto scelto ha un nome diverso da quello detto (qualificatore che nel menu non c’è)',
 scelta_non_detta:'la scelta tra i candidati non è stata detta (serve il nome, un ordinale o «tutti e due»)',
 piatto_non_nominato:'un piatto del piano non è nominato né nel messaggio né nel contesto recente',
 piatto_nominato_senza_azione:'un piatto nominato nel messaggio non ha nessuna azione nel piano (parte persa?)',
 azione_sconosciuta:'azione non prevista dallo schema',
 ripristino_non_valido:'restore su un piatto non nominato',
 ripristino_impossibile:'restore impossibile: quel piatto non è stato cambiato da qui negli ultimi 30 minuti',
 domanda_zero_scritture:'il messaggio è una domanda: nessuna modifica, rispondi alla domanda (intent=read)',
 nessuna_azione:'il piano non contiene azioni valide',
 azione_sul_piatto_della_domanda:'nel messaggio misto l’azione è finita sul piatto della domanda invece che su quello del comando',
 nome_a_suono:'il piatto è riconosciuto solo a suono e non con certezza: chiedi conferma',
 parte_persa:'una parte del messaggio non è usata dal piano',
 conferma_senza_proposta:'non c’è nessuna proposta in sospeso da confermare',
 conferma_non_esplicita:'per pubblicare questa proposta serve un messaggio di sola conferma del titolare («sì», «ok»): questo messaggio non lo è',
 conferma_con_altro:'confirm_pending su una proposta da confermare va da solo, senza altre azioni',
 annulla_senza_richiesta:'undo_last solo se il titolare chiede di annullare / tornare indietro in questo messaggio',
 annulla_scaduto:'non c’è un’ultima pubblicazione annullabile (oltre 10 minuti o nessuna)',
 annulla_con_altro:'undo_last va da solo, senza altre azioni',
 domanda_mancante:'serve la domanda per il titolare in reply_draft (breve, con il punto di domanda)',
 piatto_doppio:'il piano crea un piatto che c\u2019è già nel menu (o due volte lo stesso): per un piatto esistente usa le sue azioni, altrimenti chiedi',
 elimina_fuori_portata:'un piatto da eliminare è detto in una parte del messaggio con un\u2019altra azione (nascondi, prezzo, finito…): elimina solo i piatti del verbo «elimina/cancella»',
 riferimento_come_bersaglio:'il prezzo è stato cambiato al piatto di riferimento («uguale alla X»): va cambiato all\u2019altro piatto, X resta com\u2019è',
 nome_con_coda:'un nome nuovo (piatto, categoria, rinomina) contiene parole che non sono del nome («per favore», «se puoi», «grazie»…): il nome è solo la parte detta come nome',
 azione_fuori_portata:'un piatto è nascosto o segnato finito ma nel messaggio è detto in una parte con un\u2019altra azione (prezzo, aggiungi…): l\u2019azione vale solo per i piatti del suo verbo',
 categoria_non_detta:'il titolare ha nominato una categoria che nel menu non c\u2019è: chiedi in quale categoria metterlo o se crearla, non usarne un\u2019altra',
 bozza_non_sicura:'reply_draft non va bene: non dire che qualcosa è fatto/aggiornato se non lo è e non scrivere prezzi non detti'}
export const reasonText=(notes:string[])=>{const out:string[]=[];for(const n of notes){const k=n.split(':')[0]!;const r=REASON[k];if(r&&!out.includes(r))out.push(r+(k==='parte_persa'&&n.includes(':')?' («'+n.split(':').slice(1).join(':').replace(/,/g,'», «')+'»)':''))}return out.join('; ')||'il piano non supera i controlli del server'}

// ---------- esito del turno ----------
export type Outcome=
 |{kind:'confirm',extra:MenuAction[]}
 |{kind:'cancel'}
 |{kind:'undo'}
 |{kind:'change',actions:MenuAction[],after?:any}
 |{kind:'ask',ids:string[],actions:MenuAction[],hold?:Hold,createDraft?:BrainAsk['draft']}
 |{kind:'read',plan:any}
 |{kind:'say'}
 |{kind:'reject',reason:string,ids:string[],actions:MenuAction[],hold?:Hold}
type Decision={intent:string,plan:any,hold?:Hold,notes:string[],exclude:{id:string}[]}
const VALIDATOR_HOLD=new Set(['parte_persa','piatto_ambiguo','nome_a_suono'])
/** Esito del turno dal piano del modello già passato dal validatore. `raw` = JSON del modello (intento e azioni originali). */
export function decideTurn(o:{decision:Decision,control:ControlAction[],raw:any,message:string,pend:Pend,undoOK:boolean,sections:SectionRef[],refs?:MenuRef[],lastBot?:string}):Outcome{
 const {decision:d,control,raw,message,pend}=o,rawIntent=String(raw?.intent??''),rawActs=(Array.isArray(raw?.actions)?raw.actions:[]).filter((a:any)=>a&&!CONTROL_ACTIONS.includes(a.action))
 const reject=(note:string,ids:string[]=[],actions:MenuAction[]=[],hold?:Hold):Outcome=>({kind:'reject',reason:reasonText([note]),ids,actions,...(hold?{hold}:{})})
 const changeActs=d.plan?.type==='change'&&!d.hold?d.plan.actions as MenuAction[]:[]
 if(control.includes('undo_last')){if(!o.undoOK)return reject('annulla_scaduto');if(!undoRequested(message))return reject('annulla_senza_richiesta');if(rawActs.length||control.length>1)return reject('annulla_con_altro');return{kind:'undo'}}
 if(control.includes('confirm_pending')){
  if(!pend||(pend.kind!=='batch'&&pend.kind!=='hold'))return reject('conferma_senza_proposta')
  if(pend.kind==='batch'){if(rawActs.length)return reject('conferma_con_altro');if(confirmBlocked(message,o.refs??[]))return reject('conferma_non_esplicita');return{kind:'confirm',extra:[]}}
  if(CANCEL_WORDS.test(plain(message)))return reject('conferma_non_esplicita')
  if(rawActs.length&&!changeActs.length)return{kind:'reject',reason:reasonText(d.notes),ids:d.plan?.ids??[],actions:d.plan?.actions??[]}
  return{kind:'confirm',extra:changeActs}}
 if(control.includes('cancel_pending')&&pend&&pend.kind!=='other'&&!rawActs.length)return{kind:'cancel'}
 // Riepilogo in attesa e «X no» / «lascia stare X» (negazione letta come esclusione dal validatore): X esce dal riepilogo.
 if(pend?.kind==='batch'&&(pend.why==='recap'||pend.why==='price')&&!control.length&&d.exclude.some(e=>pend.actions.some(a=>'id' in a&&(a as any).id===e.id)))return{kind:'change',actions:changeActs}
 if(d.intent==='chat'||d.intent==='capability'||(!rawActs.length&&(rawIntent==='chat'||rawIntent==='capability')))return{kind:'say'}
 if(d.plan?.type==='read')return d.notes.includes('domanda_zero_scritture')&&rawIntent==='change'?{kind:'read',plan:d.plan}:{kind:'read',plan:d.plan}
 if(d.plan?.type==='change'&&!d.hold){if(namedSectionMismatch(message,d.plan.actions,o.sections))return reject('categoria_non_detta',[],d.plan.actions);if(duplicateCreate(d.plan.actions,o.refs??[]))return reject('piatto_doppio',[],[]);if(d.plan.actions.some((a:any)=>(a.kind==='create'||a.kind==='create_section'||a.kind==='rename'||a.kind==='rename_section'||a.kind==='special')&&nameWithTail(a.name)))return reject('nome_con_coda',[],[]);{const bad=moveTargetProblem(message,d.plan.actions,o.sections,o.lastBot??'');if(bad.length)return reject('categoria_non_detta',bad,[])}if(/\b(?:finit\w*|esaurit\w*)\b/.test(plain(message))&&!/\b(?:nascond\w*|togli\w*|lev[ai]\w*|non (?:la |lo )?(?:fare )?vedere)\b/.test(plain(message))&&d.plan.actions.some((a:any)=>a.kind==='hidden'&&a.value))return reject('valore_contrario',d.plan.actions.flatMap((a:any)=>a.kind==='hidden'?[a.id]:[]),[]);{const lost=lostClauses(message,d.plan.actions,o.refs??[],d.exclude??[]);if(lost.length)return{kind:'reject',reason:reasonText(['parte_persa:'+lost.join(',')]),ids:[],actions:d.plan.actions}}{const bad=deleteScopeProblem(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('elimina_fuori_portata',bad,[])}{const bad=verbScopeProblem(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('azione_fuori_portata',bad,[])}{const bad=referenceAsTarget(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('riferimento_come_bersaglio',bad,[])}if(/\brimett\w*\b/.test(plain(message))&&!/\bevidenza\b/.test(plain(message))&&d.plan.actions.some((a:any)=>a.kind==='featured'&&a.value))return reject('valore_contrario',d.plan.actions.flatMap((a:any)=>a.kind==='featured'?[a.id]:[]),[]);return{kind:'change',actions:d.plan.actions,...(d.plan.after?{after:d.plan.after}:{})}}
 // Domande del modello (intent=clarify) e parti incerte che il modello stesso ha segnato: domanda, stato in sospeso.
 const modelAsk=rawIntent==='clarify'||(d.hold&&d.notes.includes('parti_incerte')&&!d.notes.some(n=>VALIDATOR_HOLD.has(n.split(':')[0]!)))
 if(modelAsk){const cr=rawActs.find((a:any)=>a.action==='create_item'),sec=cr&&typeof cr.section==='string'?o.sections.find(s=>s.id===cr.section||plain(s.name)===plain(cr.section)):undefined
  // La bozza tiene SOLO ciò che il titolare ha detto in questo messaggio (nome, prezzo, categoria): il turno dopo i suoi campi
  // valgono come «detti», quindi un valore del modello non detto qui non entra mai (avversario: prezzo cambiato nella domanda).
  const inMsg=(t:unknown)=>typeof t==='string'&&!!plain(t)&&(' '+plain(message)+' ').includes(' '+plain(t)+' ')
  const createDraft=cr?{name:inMsg(cr.name)?String(cr.name).trim().slice(0,120):'',price:typeof cr.price==='number'&&cr.price>0&&g9Prices(message).includes(Math.round(cr.price*100)/100)?Math.round(cr.price*100)/100:null,sectionId:sec&&(o.sections.length===1||inMsg(sec.name))?sec.id:null,sectionName:!sec&&inMsg(cr.section)&&!/^c\d+$/.test(cr.section)?String(cr.section).slice(0,60):null}:null
  return{kind:'ask',ids:d.plan?.ids??[],actions:d.hold?d.hold.actions:d.plan?.actions??[],...(d.hold?{hold:d.hold}:{}),...(createDraft?{createDraft}:{})}}
 // Il modello voleva modificare e il validatore non lo permette: rifiuto, con il motivo per l'auto-correzione.
 return{kind:'reject',reason:reasonText(d.notes.length?d.notes:['nessuna_azione']),ids:d.plan?.ids?.length?d.plan.ids:(d.hold?.asks??[]).flatMap((a:any)=>a.options??(a.action?.id?[a.action.id]:[])),actions:d.hold?d.hold.actions:d.plan?.actions??[],...(d.hold?{hold:d.hold}:{})}}

/** Vincolo (V, «aggiungi la parmigiana a 10, il tiramisù a 6 e togli bo»): nascondere / segnare finito vale solo per i piatti
 * nella portata del suo verbo (stessa lettura per parti di deleteScopeProblem). Piatti non nominati (pronomi) non si controllano. */
const HIDE_V=/\b(?:nascond\w*|togli\w*|toglil\w*|lev[ai]\w*|levall?\w*|rimuov\w*|non (?:lo |la |li |le )?(?:fa\w* )?vedere)\b/,FIN_V=/\b(?:finit\w*|esaurit\w*|terminat\w*|fernut\w*|non c e piu|sold out)\b/
export function verbScopeProblem(message:string,actions:MenuAction[],refs:MenuRef[]):string[]{
 const want:[string,string][]=actions.flatMap((a):[string,string][]=>a.kind==='hidden'&&a.value?[[a.id,'hide']]:a.kind==='available'&&!a.value?[[a.id,'fin']]:[]);if(!want.length)return[]
 const parts=message.split(/[,;]|\s+(?:e|ed|poi|anche)\s+/i).map(x=>plain(x)).filter(Boolean),scope=new Map<string,Set<string>>();let cur='none'
 for(const p of parts){const h=HIDE_V.test(p),f=FIN_V.test(p),other=/\b(?:aggiung\w*|metti\w*|mettil\w*|costa\w*|prezzo|spost\w*|rinomin\w*|evidenza|aument\w*|abbass\w*)\b|\b(?:a|costa)\s+\d/.test(p.replace(HIDE_V,' ').replace(FIN_V,' '))
  if(h&&!other)cur='hide';else if(f&&!other)cur='fin';else if(h||f)cur=h?'hide':'fin';else if(other)cur='other'
  for(const r of refs){const n=plain(r.name);if((' '+p+' ').includes(' '+n+' ')||(!n.includes(' ')&&/h/.test(n)&&(' '+p+' ').includes(' '+n.replace(/h/g,'')+' '))){const s=scope.get(r.id)??new Set<string>();s.add((h||f)&&other?'mixed':cur);scope.set(r.id,s)}}}
 // Solo un piatto detto in una parte con un'altra azione esplicita (prezzo, aggiungi…) e mai nella portata del verbo.
 return want.filter(([id,k])=>{const s=scope.get(id);return !!s&&s.has('other')&&!s.has(k)&&!s.has('mixed')}).map(([id])=>id)}
/** Vincolo (A3.2): un piatto nuovo va in una categoria esistente diversa da quella che il titolare ha nominato («nei primi»
 * con un menu senza Primi) → rifiuto: si chiede, non si sceglie un'altra categoria. */
export function namedSectionMismatch(message:string,actions:MenuAction[],sections:SectionRef[]):boolean{
 const creates=actions.filter(a=>a.kind==='create') as Extract<MenuAction,{kind:'create'}>[];if(!creates.length)return false
 const fresh=new Set(actions.flatMap(a=>a.kind==='create_section'?[plain(a.name)]:[]))
 for(const m of plain(message).matchAll(/\b(?:nei|negli|nelle|tra i|tra gli|tra le|fra i|fra gli|fra le|categoria|sezione)\s+([a-z]+)(?:\s+([a-z]+))?/g)){const w0=m[1]!,w1=m[2]??''
  if(w0.length<3||['che','si','chiama','nuova','nuovo','piu','di'].includes(w0))continue
  const known=sections.some(s=>{const sw=plain(s.name).split(' ');return sw[0]!.slice(0,5)===w0.slice(0,5)||sameSection(s.name,w0)||(!!w1&&sameSection(s.name,w0+' '+w1))})||[...fresh].some(f=>f.split(' ')[0]!.slice(0,5)===w0.slice(0,5))
  if(!known)return true}
 return false}

/** Vincolo: mai due piatti con lo stesso nome creati insieme, mai un piatto nuovo col nome di uno che c'è già in un'altra
 * categoria (nella stessa il validatore lo trasforma già in un cambio di prezzo). */
export function duplicateCreate(actions:MenuAction[],refs:MenuRef[]){const names=actions.flatMap(a=>a.kind==='create'?[plain(a.name)]:[]);return new Set(names).size<names.length||names.some(n=>refs.some(r=>plain(r.name)===n))}
/** Vincolo (Y1): un'eliminazione vale solo per i piatti nella portata di un verbo «elimina/cancella…». Le parti del messaggio
 * si leggono in ordine: una parte con il verbo di eliminare apre la portata, una parte con un altro verbo d'azione o un prezzo
 * la chiude; una parte senza verbi («e la parmigiana») continua quella di prima. Piatti non nominati (pronomi) non si controllano. */
const OTHER_VERB=/\b(?:nascond\w*|togli\w*|lev[ai]\w*|mett\w*|aggiung\w*|spost\w*|rinomin\w*|finit\w*|esaurit\w*|evidenza|aument\w*|abbass\w*|cambi\w*|port[aio]\w*|rimett\w*|costa\w*|prezzo)\b|\b(?:a|costa)\s+\d/
export function deleteScopeProblem(message:string,actions:MenuAction[],refs:MenuRef[]):string[]{
 const dels=actions.filter(a=>a.kind==='delete'&&!a.undoCreate).map(a=>(a as any).id as string);if(!dels.length)return[]
 const parts=message.split(/[,;]|\s+(?:e|ed|poi|anche)\s+/i).map(x=>plain(x)).filter(Boolean);let cur:'del'|'other'|null=null;const scope=new Map<string,Set<string>>()
 for(const p of parts){const del=DELETE_RE.test(p),other=OTHER_VERB.test(p.replace(DELETE_RE,' '));if(del)cur='del';else if(other)cur='other'
  for(const r of refs)if((' '+p+' ').includes(' '+plain(r.name)+' ')||plain(r.name).split(' ').some(w=>w.length>=4&&(' '+p+' ').includes(' '+w+' '))){const s=scope.get(r.id)??new Set();s.add(del&&other&&!new RegExp('\\b'+plain(r.name).split(' ')[0]!+'\\b').test(p.slice(p.search(DELETE_RE)))?'other':cur??'none');scope.set(r.id,s)}}
 return dels.filter(id=>scope.has(id)&&!scope.get(id)!.has('del'))}
const DELETE_RE=/\b(?:elimin\w*|cancell\w*|rimuov\w* (?:\w+ ){0,4}?(?:completamente|definitivamente|del tutto|per sempre|proprio)|(?:lev|togl)\w* (?:\w+ ){0,4}?(?:proprio|del tutto|definitivamente|per sempre)|(?:completamente|definitivamente) (?:rimuov|lev|togl)\w*|e?l+i+m+n\w*|canc\w*l\w*)\b/
/** Vincolo (Y11): «mettila uguale alla carbonara» → il prezzo NON cambia alla carbonara (è il riferimento). */
export function referenceAsTarget(message:string,actions:MenuAction[],refs:MenuRef[]):string[]{
 const p=' '+plain(message)+' ',out:string[]=[]
 for(const a of actions){if(a.kind!=='price')continue;const r=refs.find(x=>x.id===a.id);if(!r)continue;const w=plain(r.name).split(' ')[0]!
  if(new RegExp('\\b(?:ugual\\w*|come|stess\\w* prezzo|pari|identic\\w*)\\s+(?:(?:a|al|alla|allo|all|ai|alle|del|della|dello|di|la|il|lo|l)\\s+)*'+w+'\\b').test(p)&&!(' '+plain(message)+' ').includes(' '+w+' a '))out.push(a.id)}
 return out}
/** Vincolo (Y4/Y5/Y9): un nome nuovo non finisce con una cortesia o una coda del messaggio. */
const NAME_TAIL=/\b(?:per favore|per piacere|se puoi|se riesci|grazie(?: mille)?|dai|ok|okay|subito|eh|thx|please|ti prego|quando hai tempo|mi raccomando|appena puoi|oggi stesso|capito|top|a dopo|tutto qui|va bene|perfetto|ciao|e mettil\w*.*|e spostal\w*.*|e poi.*|poi .*)$/
export const nameWithTail=(name:unknown)=>typeof name==='string'&&NAME_TAIL.test(plain(name))&&plain(name).split(' ').length>1
/** Vincolo (parti perse, per parte): una parte del messaggio con un verbo d'azione e un piatto nominato deve avere almeno
 * un'azione su quel piatto («…e togli bo» con «bo» = boh: senza un'azione su boh il piano ha perso una parte). Parti senza
 * piatto (pronomi) o con piatti esclusi dal titolare non si controllano. */
const ACT_VERB=/\b(?:togli\w*|toglil\w*|nascond\w*|lev[ai]\w*|finit\w*|esaurit\w*|elimin\w*|cancell\w*|rimett\w*|evidenza|spost\w*|rinomin\w*)\b/
export function lostClauses(message:string,actions:MenuAction[],refs:MenuRef[],exclude:{id:string}[]=[]):string[]{
 const touched=new Set(actions.flatMap(a=>'id' in a?[(a as any).id as string]:[])),ex=new Set(exclude.map(e=>e.id)),out:string[]=[]
 const words=(s:string)=>' '+plain(s)+' ',named=(r:MenuRef,c:string)=>{const w=words(c),n=plain(r.name);return w.includes(' '+n+' ')||(!n.includes(' ')&&/h/.test(n)&&w.includes(' '+n.replace(/h/g,'')+' '))}
 for(const c of message.split(/[,;.]|\s+(?:e|ed|poi)\s+/)){if(!ACT_VERB.test(plain(c)))continue;const ds=refs.filter(r=>named(r,c));if(!ds.length||ds.some(r=>touched.has(r.id)||ex.has(r.id)))continue;out.push(c.trim().slice(0,40))}
 return out}
/** Vincolo: uno spostamento va nella categoria che il titolare nomina (o in una creata in questo piano, o in quella dell'ultimo
 * spostamento scritto dal bot per «anche X»). Il modello non sceglie la categoria. */
export function moveTargetProblem(message:string,actions:MenuAction[],sections:SectionRef[],lastBot=''):string[]{
 const p=' '+plain(message)+' ',bot=plain(lastBot),fresh=new Map(actions.flatMap(a=>a.kind==='create_section'?[[a.newSectionId,a.name] as const]:[])),out:string[]=[]
 for(const a of actions){if(a.kind!=='move')continue;const name=fresh.get(a.sectionId)??sections.find(s=>s.id===a.sectionId)?.name;if(!name){out.push(a.id);continue}
  const ws=plain(name).split(' ').filter(w=>w.length>=3),said=ws.some(w=>p.includes(' '+w.slice(0,Math.min(5,w.length))))||sameSection(name,plain(message))
  if(!said&&!fresh.has(a.sectionId)&&!bot.includes('spostato in '+plain(name)))out.push(a.id)}
 return out}
/** Richiesta cortese in forma di domanda («potresti inserire X a 11?», «mi aggiungi la lasagna a 13?»): è un comando, non una
 * domanda (il vincolo «domande = zero scritture» non vale). Serve un verbo d'azione esplicito. */
const POLITE=/^(?:(?:ciao|allora|senti|scusa|ehi)\s+)?(?:per (?:piacere|favore)\s+)?(?:(?:mi|ci|me|ce)\s+)?(?:(?:puoi|potresti|possiamo|potete|riesci a|riusciresti a|vorrei|volevo|dovresti)\s+(?:(?:mi|ci|me|ce)\s+)?(?:(?:lo|la|li|le)\s+)?(?:aggiunger|inserir|metter|nasconder|toglier|segnar|cambiar|eliminar|cancellar|spostar|rinominar|crear|alzar|abbassar|aumentar|portar|rimetter|far)\w*|(?:aggiungi|aggiungeresti|inserisci|metti|nascondi|togli|segni|segna|cambi|elimini|cancelli|sposti|rinomini|crei|porti|rimetti)\b)/
export const politeRequest=(message:string)=>POLITE.test(plain(message))

/** Categoria nuova chiesta in modo esplicito («crea la categoria X», «in un'altra categoria, X», «una categoria nuova»): niente «la creo?». */
export const EXPLICIT_SECTION=/\b(?:crea\w*|aggiung\w*|apri|fai|inserisci)\s+(?:(?:una|la|un|nuova|altra)\s+)*(?:categori\w*|sezion\w*)|\b(?:categori\w*|sezion\w*)\s+nuov\w*|\bnuov\w*\s+(?:categori\w*|sezion\w*)|\b(?:un|una)\s+(?:altra|nuova)\s+(?:categori\w*|sezion\w*)/

// ---------- bozza del modello ----------
// «Fatto» detto senza una scrittura vera: mai. Le forme sono quelle che anche il giudice del banco riconosce.
const CLAIM=/\b(confermato|fatto|fatta|aggiornat\w*|modificat\w*|salvat\w*|pubblicat\w*|impostat\w*|ho (?:messo|tolto|cambiato|aggiornato|nascosto|segnato|aggiunto|creato|impostato|eliminato|cancellato|spostato|rinominato|pubblicato|rimesso|annullato)|e stat[oa] (?:\w+ )?(?:messo|messa|tolto|tolta|cambiat\w|aggiornat\w|nascost\w|eliminat\w|cancellat\w))\b|✅/
/** Bozza utilizzabile o null. `wrote` = il server ha scritto e riletto tutte le azioni; `numbers` = numeri ammessi
 * (detti dal titolare, prezzi scritti, prezzi dei piatti citati). */
export function cleanDraft(draft:unknown,o:{wrote:boolean,numbers:number[]}):string|null{
 if(typeof draft!=='string')return null;let s=draft.replace(/[`~]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();if(!s||s.length>600)return null
 if(!o.wrote&&CLAIM.test(plain(s)))return null
 const allowed=new Set(o.numbers.map(n=>Math.round(n*100)/100))
 for(const m of s.replace(/(\d)\s*,\s*(\d{2})\b/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)){const v=Number(m[0]);if(Number.isInteger(v)&&v<=9&&!/€|euro/i.test(s.slice(m.index!,m.index!+m[0].length+6)))continue;if(!allowed.has(Math.round(v*100)/100))return null}
 return s}
export const numbersIn=(s:string)=>[...s.replace(/(\d)\s*,\s*(\d{2})\b/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)].map(m=>Number(m[0]))

// ---------- fatti del server ----------
const num=(n:number)=>n.toFixed(2).replace('.',',')+' €'
export const changeFacts=(actions:MenuAction[],before:MenuRef[],sections:SectionRef[])=>{const all=withNewSections(sections,actions);return actions.map(a=>describeAction(a,before,all)).join('\n')}
/** Proposta in attesa: righe numerate (il numero tiene le righe fuori dalle frasi «X: nascosto» lette come fatti già avvenuti). */
export function pendingFacts(why:BatchWhy,actions:MenuAction[],refs:MenuRef[],sections:SectionRef[]){const all=withNewSections(sections,actions)
 const head=why==='delete'?'Da eliminare, serve il tuo sì:':why==='section'?'Categoria nuova, serve il tuo sì:':'Non ancora pubblicato, da confermare con OK:'
 return head+'\n'+actions.map((a,i)=>(i+1)+'. '+(a.kind==='delete'?'*'+(refs.find(r=>r.id===a.id)?itemLabel(refs.find(r=>r.id===a.id)!,refs):'?')+'*: da eliminare':describeAction(a,refs,all))).join('\n')}
export const candidateFacts=(ids:string[],refs:MenuRef[])=>ids.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r).map((r,i)=>`${i+1}. *${itemLabel(r,refs)}* (${num(r.price)})`).join('\n')
export function holdFacts(h:Hold,refs:MenuRef[],sections:SectionRef[]){const all=withNewSections(sections,h.actions),out:string[]=[]
 if(h.actions.length)out.push('Non ancora pubblicato:\n'+h.actions.map((a,i)=>(i+1)+'. '+describeAction(a,refs,all)).join('\n'))
 for(const a of (h.asks??(h.ask?[h.ask]:[])) as any[])if(a.type==='choose'&&Array.isArray(a.options))out.push('«'+String(a.word).slice(0,60)+'»:\n'+candidateFacts(a.options,refs))
 return out.join('\n\n')}
export const NOTHING='Non ho cambiato nulla.'
