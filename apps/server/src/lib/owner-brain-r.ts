/** Fase R (17/10/2026 notte, decisione di Manuel «un solo cervello»). Col cervello acceso OGNI messaggio del titolare va al
 * modello con il contesto completo; il server non interpreta frasi: valida il piano, impone i vincoli (conferma esplicita per
 * eliminare / riepiloghi, annulla solo entro 10 minuti) e aggiunge in coda alla bozza del modello solo FATTI riletti dal DB.
 * Testi fissi ammessi: la riga «assistente automatico» (route) e `copy.brainDown` quando Groq non risponde.
 * Modulo puro (niente DB, niente rete): stato in sospeso, strumenti di controllo, esito del turno, motivi di rifiuto per
 * l'auto-correzione, fatti della risposta. */
import {plain,g9Prices,describeAction,withNewSections,itemLabel,type MenuRef,type SectionRef,type MenuAction} from './twilio-menu-ai.js'
import type {Hold} from './twilio-menu-hold.js'
import {sameSection} from './twilio-menu-structure.js'
import {allOfSections,namedSections,nameInText,unknownSectionPhrase,sectionListText} from './owner-brain-sections.js'

export const CONTROL_ACTIONS=['confirm_pending','cancel_pending','undo_last'] as const
export type ControlAction=typeof CONTROL_ACTIONS[number]

/** Stato in sospeso scritto dal percorso R (una riga per numero in tako_whatsapp_proposals). */
export type BatchWhy='delete'|'recap'|'section'|'price'
/** R9: `twins` = piatti già nel menu con lo STESSO nome di un piatto chiesto come nuovo (domanda «lo aggiorno o ne creo un altro?»),
 * col prezzo detto nella richiesta; `actions` = le parti chiare della richiesta originale che aspettano la risposta. */
export type Twin={id:string,name:string,price:number|null,sectionId:string|null}
export type BrainAsk={kind:'brain_ask',question:string,ids:string[],actions:MenuAction[],source:string,draft?:{name:string,price:number|null,sectionId:string|null,sectionName:string|null}|null,twins?:Twin[]}
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
const ONLY_CANCEL=/^(?:(?:no|ah|allora|aspetta|scusa|ok)\s+)*(?:annulla(?: tutto)?|lascia (?:stare|perdere)|niente|no|non (?:farlo|pubblicare)|no grazie|lascia stare tutto)$/
// R5.1 (nota 64): «no, il caviale lascialo stare» → il caviale (nuovo o in sospeso) non si crea. Vincolo sul testo, non interpretazione.
const NEG_KEEP=/\b(?:lascia\w* (?:stare|perdere)|non (?:lo |la |li |le )?(?:aggiung\w*|mett\w*|cre\w*|vogli\w*|volevo)|niente|tranne|senza)\b/
export function negatedName(message:string,name:string){const n=plain(name);if(n.length<3)return false;return message.split(/[,;.]|\s+(?:e|ed|poi|ma)\s+/).some(c=>{const p=' '+plain(c)+' ';return p.includes(' '+n+' ')&&NEG_KEEP.test(p)})}
const CANCEL_WORDS=/\b(annull\w*|lascia\w* (?:stare|perdere)|niente|non pubblicare|non farlo)\b/

// ---------- motivi di rifiuto (auto-correzione: il server rimanda al modello il perché, una volta) ----------
const REASON:Record<string,string>={
 prezzo_non_detto:'un prezzo del piano non è stato detto dal titolare (né in questo messaggio né, con un rimando esplicito, prima)',
 riferimento_prezzo_non_valido:'il riferimento «stesso prezzo di» non è valido: il piatto di riferimento deve essere nominato',
 delta_senza_verbo:'una differenza di prezzo senza un verbo che la dica (aumenta/abbassa/togli N euro…)',
 percentuale:'il titolare ha detto una percentuale: il prezzo nuovo è il prezzo attuale più o meno quella percentuale (es. 5 € +10% = 5,50 €), mai la percentuale in euro; se il verso non è chiaro chiedi',
 numero_spezzato:'un numero detto in due pezzi dalla trascrizione («tre dici» = 13, «dicia nove» = 19) è stato letto come uno dei pezzi: usa il numero intero o chiedi',
 prezzo_implausibile:'il prezzo nuovo è oltre il triplo o sotto un terzo di quello attuale e quel numero non è detto per intero: chiedi conferma del prezzo',
 verso_del_prezzo:'il verso del prezzo non è quello detto: dopo «anzi» vale l’ultimo verbo; con «alza» e «abbassa» insieme sullo stesso piatto senza «anzi» chiedi', differenza_come_prezzo:'un numero detto come differenza («uno in meno», «+1») è stato usato come prezzo: usa price_delta',
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
 creazione_negata:'il titolare ha detto di non aggiungere quel piatto («lascialo stare»): non va creato',
 nome_doppio:'il nome nuovo è già il nome di un altro piatto del menu: chiedi quale piatto rinominare',
 rinuncia_non_scrive:'il titolare ha solo annullato o rinunciato: nessuna modifica (per ciò che è in sospeso usa cancel_pending, per l’ultima pubblicazione undo_last)',
 domanda_mancante:'serve la domanda per il titolare in reply_draft (breve, con il punto di domanda)',
 piatto_doppio:'il piano crea un piatto che c\u2019è già nel menu (o due volte lo stesso): non cambiare quello esistente, chiedi al titolare (intent=clarify, domanda in reply_draft) se aggiornare quello che c\u2019è o crearne un altro, per esempio «C\u2019è già X a N €: lo aggiorno o ne creo un altro?»; nelle azioni lascia le altre parti chiare',
 elimina_fuori_portata:'un piatto da eliminare è detto in una parte del messaggio con un\u2019altra azione (nascondi, prezzo, finito…): elimina solo i piatti del verbo «elimina/cancella»',
 riferimento_come_bersaglio:'il prezzo è stato cambiato al piatto di riferimento («uguale alla X»): va cambiato all\u2019altro piatto, X resta com\u2019è',
 nome_con_coda:'un nome nuovo (piatto, categoria, rinomina) contiene parole che non sono del nome («per favore», «se puoi», «grazie»…): il nome è solo la parte detta come nome',
 azione_fuori_portata:'un piatto è nascosto o segnato finito ma nel messaggio è detto in una parte con un\u2019altra azione (prezzo, aggiungi…): l\u2019azione vale solo per i piatti del suo verbo',
 categoria_non_detta:'il titolare ha nominato una categoria che nel menu non c\u2019è: chiedi in quale categoria metterlo o se crearla, non usarne un\u2019altra',
 conferma_di_domanda:'non c\u2019è una proposta da confermare: c\u2019era una TUA domanda aperta (IN SOSPESO) e questo messaggio è la risposta del titolare. Non usare confirm_pending: scrivi nel piano le azioni della richiesta originale secondo la scelta del titolare (prezzi e nomi detti in quella richiesta), oppure, se la risposta non sceglie, una domanda diversa con le opzioni numerate',
 gia_risposto:'il titolare ha già risposto alla tua domanda in sospeso: non ripeterla. Se la risposta sceglie un\u2019opzione (anche «sì», «aggiornali», «il primo», «crea nuovi»), scrivi il piano con le azioni della richiesta originale; se davvero non sceglie, fai una domanda DIVERSA da quella di prima, breve, con le opzioni numerate (1. … 2. …)',
 domanda_ripetuta:'la domanda è di nuovo uguale a quella già fatta: è vietato rimandarla. Esegui la scelta se la risposta la indica; altrimenti scrivi una domanda con parole diverse che elenca le opzioni numerate (1. … 2. …) e chiede di rispondere col numero',
 doppio_falso:'la domanda dice che c\u2019è già un piatto che nel menu ha un nome diverso (più lungo): un nome contenuto in un altro è un piatto nuovo, si crea; chiedi solo per i piatti con lo stesso nome',
 bozza_non_sicura:'reply_draft non va bene: non dire che qualcosa è fatto/aggiornato se non lo è e non scrivere prezzi non detti'}
export const reasonText=(notes:string[])=>{const out:string[]=[];for(const n of notes){const k=n.split(':')[0]!;const r=REASON[k];if(r&&!out.includes(r))out.push(r+(k==='parte_persa'&&n.includes(':')?' («'+n.split(':').slice(1).join(':').replace(/,/g,'», «')+'»)':''))}return out.join('; ')||'il piano non supera i controlli del server'}

// ---------- esito del turno ----------
export type Outcome=
 |{kind:'confirm',extra:MenuAction[]}
 |{kind:'cancel'}
 |{kind:'undo'}
 |{kind:'change',actions:MenuAction[],after?:any}
 |{kind:'ask',ids:string[],actions:MenuAction[],hold?:Hold,createDraft?:BrainAsk['draft'],twins?:Twin[]}
 |{kind:'read',plan:any}
 |{kind:'say'}
 |{kind:'reject',reason:string,ids:string[],actions:MenuAction[],hold?:Hold,twins?:Twin[]}
type Decision={intent:string,plan:any,hold?:Hold,notes:string[],exclude:{id:string}[]}
const VALIDATOR_HOLD=new Set(['parte_persa','piatto_ambiguo','nome_a_suono'])
/** Esito del turno dal piano del modello già passato dal validatore. `raw` = JSON del modello (intento e azioni originali). */
export function decideTurn(o:{decision:Decision,control:ControlAction[],raw:any,message:string,pend:Pend,undoOK:boolean,sections:SectionRef[],refs?:MenuRef[],lastBot?:string}):Outcome{
 const {decision:d,control,raw,message,pend}=o,rawIntent=String(raw?.intent??''),rawActs=(Array.isArray(raw?.actions)?raw.actions:[]).filter((a:any)=>a&&!CONTROL_ACTIONS.includes(a.action))
 const reject=(note:string,ids:string[]=[],actions:MenuAction[]=[],hold?:Hold):Outcome=>({kind:'reject',reason:reasonText([note]),ids,actions,...(hold?{hold}:{})})
 const changeActs=d.plan?.type==='change'&&!d.hold?d.plan.actions as MenuAction[]:[]
 if(control.includes('undo_last')){if(!o.undoOK)return reject('annulla_scaduto');if(!undoRequested(message))return reject('annulla_senza_richiesta');if(rawActs.length||control.length>1)return reject('annulla_con_altro');return{kind:'undo'}}
 if(control.includes('confirm_pending')){
  // R9: con una TUA domanda aperta (brain_ask) non c'è nulla da confermare: la risposta va scritta come piano con le azioni della richiesta originale.
  if(pend?.kind==='ask')return reject('conferma_di_domanda',pend.ask.twins?.map(t=>t.id)??pend.ask.ids,pend.ask.actions??[])
  if(!pend||(pend.kind!=='batch'&&pend.kind!=='hold'))return reject('conferma_senza_proposta')
  if(pend.kind==='batch'){if(rawActs.length)return reject('conferma_con_altro');if(confirmBlocked(message,o.refs??[]))return reject('conferma_non_esplicita');return{kind:'confirm',extra:[]}}
  if(CANCEL_WORDS.test(plain(message)))return reject('conferma_non_esplicita')
  // Domanda sì/no in sospeso («Intendi boh? Rispondi sì o no.»): una richiesta nuova non è un sì (R5.1, banco vero asr-005).
  {const asks=pend.hold.asks??(pend.hold.ask?[pend.hold.ask]:[]);if(asks.length&&asks.every(a=>a.type==='confirm')&&confirmBlocked(message,o.refs??[]))return reject('conferma_non_esplicita')}
  if(rawActs.length&&!changeActs.length)return{kind:'reject',reason:reasonText(d.notes),ids:d.plan?.ids??[],actions:d.plan?.actions??[]}
  return{kind:'confirm',extra:changeActs}}
 if(control.includes('cancel_pending')&&pend&&pend.kind!=='other'&&!rawActs.length)return{kind:'cancel'}
 // R5.1 (nota 64): un messaggio di solo annullamento/rinuncia («annulla», «lascia stare», «niente», «no») non scrive mai: se il modello
 // propone modifiche, il server le rifiuta (vincolo come «una domanda non è una modifica»).
 if(changeActs.length&&ONLY_CANCEL.test(plain(message)))return reject('rinuncia_non_scrive')
 // Riepilogo in attesa e «X no» / «lascia stare X» (negazione letta come esclusione dal validatore): X esce dal riepilogo.
 if(pend?.kind==='batch'&&(pend.why==='recap'||pend.why==='price')&&!control.length&&d.exclude.some(e=>pend.actions.some(a=>'id' in a&&(a as any).id===e.id)))return{kind:'change',actions:changeActs}
 if(d.intent==='chat'||d.intent==='capability'||(!rawActs.length&&(rawIntent==='chat'||rawIntent==='capability')))return{kind:'say'}
 if(d.plan?.type==='read')return d.notes.includes('domanda_zero_scritture')&&rawIntent==='change'?{kind:'read',plan:d.plan}:{kind:'read',plan:d.plan}
 // R9: risposta alla domanda sui piatti con lo stesso nome: un'azione su un piatto dal nome PIÙ LUNGO che contiene un nome della richiesta
 // («pasta al pesto» → «Pasta al pesto e lasagna») non è la scelta del titolare: quel nome è un piatto nuovo.
 if(d.plan?.type==='change'&&!d.hold&&pend?.kind==='ask'&&pend.ask.twins?.length){const said=[...pend.ask.twins.map(t=>t.name),...(pend.ask.actions??[]).flatMap(a=>a.kind==='create'?[a.name]:[])],refs=o.refs??[]
  const bad=d.plan.actions.flatMap((a:any)=>{if(!('id' in a)||pend.ask.twins!.some(t=>t.id===a.id))return[];const r=refs.find(x=>x.id===a.id);return r&&!(' '+plain(message)+' ').includes(' '+plain(r.name)+' ')&&said.some(n=>!sameDishName(n,r.name)&&(' '+dishKey(r.name)+' ').includes(' '+dishKey(n)+' '))?[r.id]:[]})
  if(bad.length)return reject('doppio_falso',bad,[])}
 if(d.plan?.type==='change'&&!d.hold){if(d.plan.actions.some((a:any)=>a.kind==='create'&&negatedName(message,a.name)))return reject('creazione_negata',[],[]);{const dup=d.plan.actions.filter((a:any)=>a.kind==='rename'&&(o.refs??[]).some(r=>r.id!==a.id&&plain(r.name)===plain(a.name)));if(dup.length)return reject('nome_doppio',dup.map((a:any)=>a.id),[])}if(namedSectionMismatch(message,d.plan.actions,o.sections))return reject('categoria_non_detta',[],d.plan.actions);if(duplicateCreate(d.plan.actions.filter((x:any)=>!(x.kind==='create'&&pend?.kind==='ask'&&(pend.ask.twins??[]).some(t=>sameDishName(t.name,x.name)))),o.refs??[])){const tw=duplicateTwins(d.plan.actions,o.refs??[]),refs=o.refs??[],twins=twinsOf(d.plan.actions,refs);return{kind:'reject',reason:twinReason(twins,d.plan.actions,refs),ids:tw,actions:d.plan.actions.filter((a:any)=>!(a.kind==='create'&&refs.some(r=>tw.includes(r.id)&&sameDishName(r.name,a.name)))),...(twins.length?{twins}:{})}}if(d.plan.actions.some((a:any)=>(a.kind==='create'||a.kind==='create_section'||a.kind==='rename'||a.kind==='rename_section'||a.kind==='special')&&nameWithTail(a.name)))return reject('nome_con_coda',[],[]);{const tw=pend?.kind==='ask'?pend.ask.twins??[]:[],bad=moveTargetProblem(message,d.plan.actions,o.sections,o.lastBot??'').filter(id=>!d.plan.actions.some((a:any)=>a.kind==='move'&&a.id===id&&tw.some(t=>t.id===id&&t.sectionId===a.sectionId)));if(bad.length)return reject('categoria_non_detta',bad,[])}if(/\b(?:finit\w*|esaurit\w*)\b/.test(plain(message))&&!/\b(?:nascond\w*|togli\w*|lev[ai]\w*|non (?:la |lo )?(?:fare )?vedere)\b/.test(plain(message))&&d.plan.actions.some((a:any)=>a.kind==='hidden'&&a.value))return reject('valore_contrario',d.plan.actions.flatMap((a:any)=>a.kind==='hidden'?[a.id]:[]),[]);{const lost=lostClauses(message,d.plan.actions,o.refs??[],d.exclude??[]);if(lost.length)return{kind:'reject',reason:reasonText(['parte_persa:'+lost.join(',')]),ids:[],actions:d.plan.actions}}{const bad=deleteScopeProblem(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('elimina_fuori_portata',bad,[])}{const bad=verbScopeProblem(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('azione_fuori_portata',bad,[])}{const bad=referenceAsTarget(message,d.plan.actions,o.refs??[]);if(bad.length)return reject('riferimento_come_bersaglio',bad,[])}if(/\brimett\w*\b/.test(plain(message))&&!/\bevidenza\b/.test(plain(message))&&d.plan.actions.some((a:any)=>a.kind==='featured'&&a.value))return reject('valore_contrario',d.plan.actions.flatMap((a:any)=>a.kind==='featured'?[a.id]:[]),[]);{const bad=twinMoveMissing(d.plan.actions,pend,o.refs??[],o.sections);if(bad)return{kind:'reject',reason:bad.reason,ids:bad.ids,actions:d.plan.actions}}{const bad=allSubsetProblem(message+(pend?.kind==='ask'?' \n '+pend.ask.source:''),d.plan.actions,o.refs??[],o.sections);if(bad)return{kind:'reject',reason:bad.reason,ids:[],actions:d.plan.actions}}return{kind:'change',actions:d.plan.actions,...(d.plan.after?{after:d.plan.after}:{})}}
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
/** R10 (QA 16:03 «nei primi aggiungi … pasta al ragù» → «confermo»: ragù aggiornato ma rimasto in «Piatti di prova»). Risposta
 * «aggiornalo» alla domanda sui piatti con lo stesso nome: se il piatto è in un'altra sezione rispetto a quella detta nella
 * richiesta, il piano lo deve anche spostare lì (move_item). Se è già nella sezione detta, nessuno spostamento. Vincolo. */
export function twinMoveMissing(actions:MenuAction[],pend:Pend,refs:MenuRef[],sections:SectionRef[]):{reason:string,ids:string[]}|null{
 if(pend?.kind!=='ask'||!pend.ask.twins?.length)return null
 const miss=pend.ask.twins.flatMap(t=>{const r=refs.find(x=>x.id===t.id),sec=sections.find(s=>s.id===t.sectionId);if(!r||!sec||r.sectionId===sec.id)return[]
  const updated=actions.some(a=>'id' in a&&(a as any).id===r.id&&a.kind!=='move'),moved=actions.some(a=>a.kind==='move'&&a.id===r.id&&a.sectionId===sec.id)
  return updated&&!moved?[{r,sec}]:[]})
 if(!miss.length)return null
 return{reason:'il titolare aveva detto in quale sezione aggiungerlo: aggiornando il piatto che c\u2019è va anche spostato lì (move_item) — '+miss.map(m=>'«'+m.r.name+'» in «'+m.sec.name+'»').join(', '),ids:miss.map(m=>m.r.id)}}
/** R10: «tutti i piatti della sezione X» (anche col nome pubblico «altre proposte»): l'azione va su OGNI piatto a cui si applica
 * (nascondi = i visibili, finito = i disponibili, rimetti = i nascosti…) delle sezioni nominate. Un sottoinsieme → rifiuto con
 * l'elenco di quelli mancanti (il modello rifà il piano; oltre 3 modifiche il server chiede l'OK come sempre). */
export function allSubsetProblem(text:string,actions:MenuAction[],refs:MenuRef[],sections:SectionRef[]):{reason:string}|null{
 // «tutte le bibite tranne la coca cola»: con un'esclusione detta il controllo non vale (il validatore legge già le esclusioni).
 if(/\b(?:tranne|eccetto|escluso|esclusa|esclusi|escluse|salvo|a parte|meno|non (?:la|il|lo|le|i|gli))\b/.test(plain(text)))return null
 const ids=new Set(allOfSections(text,sections));if(!ids.size)return null
 const inSec=refs.filter(r=>r.sectionId&&ids.has(r.sectionId)),miss=new Set<string>()
 const kinds=new Map<string,{kind:string,value?:boolean}>()
 for(const a of actions)if((a.kind==='hidden'||a.kind==='available'||a.kind==='featured')&&inSec.some(r=>r.id===a.id))kinds.set(a.kind+':'+a.value,{kind:a.kind,value:a.value})
 for(const k of kinds.values()){const applies=(r:MenuRef)=>k.kind==='hidden'?(k.value?!r.hidden:r.hidden):k.kind==='available'?(k.value?!r.available:r.available&&!r.hidden):(k.value?!r.featured:!!r.featured)
  for(const r of inSec)if(applies(r)&&!actions.some(a=>a.kind===k.kind&&(a as any).id===r.id))miss.add(r.name)}
 if(!miss.size)return null
 const names=sections.filter(s=>ids.has(s.id)).map(s=>s.name)
 return{reason:'il titolare ha detto «tutti»: l\u2019azione va su ogni piatto delle sezioni '+names.map(n=>'«'+n+'»').join(', ')+' (nome detto: '+namedSections(text,sections).said.map(n=>'«'+n+'»').join(', ')+'); mancano: '+[...miss].slice(0,12).map(n=>'«'+n+'»').join(', ')}}
/** Vincolo (A3.2): un piatto nuovo va in una categoria esistente diversa da quella che il titolare ha nominato («nei primi»
 * con un menu senza Primi) → rifiuto: si chiede, non si sceglie un'altra categoria. */
export function namedSectionMismatch(message:string,actions:MenuAction[],sections:SectionRef[]):boolean{
 const creates=actions.filter(a=>a.kind==='create') as Extract<MenuAction,{kind:'create'}>[];if(!creates.length)return false
 const fresh=new Set(actions.flatMap(a=>a.kind==='create_section'?[plain(a.name)]:[]))
 for(const m of plain(message).matchAll(/\b(?:nei|negli|nelle|tra i|tra gli|tra le|fra i|fra gli|fra le|categoria|sezione)\s+([a-z]+)(?:\s+([a-z]+))?/g)){const w0=m[1]!,w1=m[2]??''
  if(w0.length<3||['che','si','chiama','nuova','nuovo','piu','di'].includes(w0))continue
  const known=sections.some(s=>{const sw=plain(s.name).split(' ');return sw[0]!.slice(0,5)===w0.slice(0,5)||sameSection(s.name,w0)||(!!w1&&sameSection(s.name,w0+' '+w1))})||[...fresh].some(f=>f.split(' ')[0]!.slice(0,5)===w0.slice(0,5))||sections.some(s=>!!s.pub&&nameInText(s.pub,w0+' '+w1,true))
  if(!known)return true}
 return false}

/** Vincolo: mai due piatti con lo stesso nome creati insieme, mai un piatto nuovo col nome di uno che c'è già in un'altra
 * categoria (nella stessa il validatore lo trasforma già in un cambio di prezzo). */
/** R8: i piatti già nel menu che il piano crea di nuovo (candidati della domanda «lo aggiorno o ne creo un altro?»). */
// R9 (18/10, QA «pasta al pesto» = «Pasta al pesto e lasagna»?): lo stesso piatto è SOLO a nome uguale normalizzato (accenti,
// maiuscole, articolo davanti, spazi). Un nome contenuto in un nome più lungo è un altro piatto: si crea.
const ARTICLE=/^(?:il|lo|la|l|i|gli|le|un|uno|una)\s+/
export const dishKey=(name:string)=>plain(name).replace(ARTICLE,'').replace(/\s+/g,' ').trim()
export const sameDishName=(a:string,b:string)=>!!dishKey(a)&&dishKey(a)===dishKey(b)
export const duplicateTwins=(actions:MenuAction[],refs:MenuRef[])=>{const names=new Set(actions.flatMap(a=>a.kind==='create'?[dishKey(a.name)]:[]));return refs.filter(r=>names.has(dishKey(r.name))).map(r=>r.id)}
export function duplicateCreate(actions:MenuAction[],refs:MenuRef[]){const names=actions.flatMap(a=>a.kind==='create'?[dishKey(a.name)]:[]);return new Set(names).size<names.length||names.some(n=>refs.some(r=>dishKey(r.name)===n))}
/** R9: i gemelli con il prezzo detto per il piatto nuovo (va nella domanda in sospeso e torna al modello col messaggio dopo). */
export const twinsOf=(actions:MenuAction[],refs:MenuRef[]):Twin[]=>actions.flatMap(a=>{if(a.kind!=='create')return[];const r=refs.find(x=>sameDishName(x.name,a.name));return r?[{id:r.id,name:a.name,price:typeof a.price==='number'?a.price:null,sectionId:a.sectionId??null}]:[]})
const num0=(n:number)=>n.toFixed(2).replace('.',',')+' €'
function twinReason(twins:Twin[],actions:MenuAction[],refs:MenuRef[]){if(!twins.length)return reasonText(['piatto_doppio'])
 const names=twins.map(t=>{const r=refs.find(x=>x.id===t.id)!;return`«${r.name}» (${num0(r.price)}${r.hidden?', nascosto':''})`})
 // Nomi nuovi CONTENUTI in un piatto più lungo del menu: non sono doppioni (il modello li aveva presi per esistenti).
 const near=actions.flatMap(a=>a.kind==='create'&&!twins.some(t=>sameDishName(t.name,a.name))?refs.filter(r=>!sameDishName(r.name,a.name)&&(' '+dishKey(r.name)+' ').includes(' '+dishKey(a.name)+' ')).map(r=>`«${a.name}» non è «${r.name}»`):[])
 return reasonText(['piatto_doppio'])+'. Hanno lo STESSO nome solo: '+names.join(', ')+': chiedi solo per questi (le opzioni: aggiornare quello che c\u2019è al prezzo detto, e se è nascosto rimetterlo visibile, oppure crearne un altro)'+(near.length?'. Un nome contenuto in un piatto più lungo è un piatto nuovo da creare, non chiedere: '+[...new Set(near)].join('; '):'')}
/** R10 (QA 16:05–16:06: «Quale sezione intendi nascondere?» dopo «…dalla sezione altre proposte», «Quali piatti…?» dopo «tutti i
 * piatti»): una domanda del modello non può ignorare ciò che il titolare ha già detto (sezione o nome pubblico, «tutti», piatto,
 * prezzo), non può dire che non esiste una sezione che è il nome pubblico di sezioni vere, e su una sezione che davvero non c'è
 * deve dirlo subito ed elencare le sezioni. Vincolo sul testo della domanda: il motivo torna al modello (auto-correzione).
 * `text` = messaggio + richiesta in sospeso; `message` = solo il messaggio. null = la domanda va bene. */
export function ignoredInQuestion(draft:string,o:{message:string,text:string,sections:SectionRef[],refs:MenuRef[],lastQ?:string,recent?:string}):string|null{
 const raw=draft.split(/\n\n/)[0]!.trim();if(!raw||!(/\?/.test(raw)||/\brispondi\b/i.test(raw)))return null
 const q=' '+plain(raw)+' ',named=namedSections(o.text,o.sections),all=allOfSections(o.text,o.sections)
 const secNames=(ids:string[])=>o.sections.filter(s=>ids.includes(s.id)).map(s=>'«'+s.name+'»').join(', ')
 const told=(what:string)=>'il titolare ha già detto: '+what+'. Non chiederlo di nuovo: usa quello che ha detto (se è tutto chiaro scrivi il piano), oppure chiedi solo ciò che manca davvero, con una domanda diversa'
 if(/ (?:quale|quali|che|in quale|di quale|da quale|in che) (?:sezione|sezioni|categoria|categorie) /.test(q)&&(named.ids.length===1||(named.ids.length>1&&all.length>0)))return told('la sezione '+named.said.map(n=>'«'+n+'»').join(', ')+' (= '+secNames(named.ids)+')')
 if(/ (?:quali|quale|che) piatti? /.test(q)&&all.length)return told('«tutti» i piatti di '+named.said.map(n=>'«'+n+'»').join(', ')+' (= ogni piatto delle sezioni '+secNames(all)+')')
 // «Non esiste una sezione …» su un nome pubblico detto (anche nei messaggi recenti del titolare: è la risposta a quelli).
 {const nr=named.ids.length?named:namedSections(o.text+' \n '+(o.recent??''),o.sections);if(/ non (?:esiste|esistono|c e|ce|ci sono|trovo|ho trovato|risulta) /.test(q)&&/ (?:sezione|sezioni|categoria|categorie) /.test(q)&&nr.ids.length&&nr.said.some(n=>nameInText(n,raw,true)||nameInText(n,raw)))return told('la sezione '+nr.said.map(n=>'«'+n+'»').join(', ')+', che esiste: è il nome nel menu digitale delle sezioni '+secNames(nr.ids))}
 const unknown=unknownSectionPhrase(o.message,o.sections)
 if(unknown&&!namedSections(o.message,o.sections).ids.length){const listed=o.sections.filter(s=>nameInText(s.name,raw)||(!!s.pub&&nameInText(s.pub,raw,true))).length
  if(!/ non (?:esiste|esistono|c e|ce|ci sono|trovo|ho trovato|risulta|vedo) /.test(q)||listed<Math.min(2,o.sections.length))return 'nel menu non c\u2019è una sezione «'+unknown+'»: dillo subito nella domanda ed elenca le sezioni che ci sono (con il nome del menu digitale): '+sectionListText(o.sections)}
 if(o.lastQ&&sameQuestion(raw,o.lastQ)&&(all.length||((named.ids.length||unknown)&&/ (?:sezione|sezioni|categoria|categorie|piatti) /.test(q))))return 'la domanda è uguale a quella di prima: è vietato rimandarla. '+(named.ids.length?told('la sezione '+named.said.map(n=>'«'+n+'»').join(', ')):'Fai una domanda diversa, con le opzioni numerate')
 return null}
/** R9: la stessa domanda (o quasi: ≥ 80% delle parole) rispetto a quella già fatta. */
export function sameQuestion(a:string,b:string){const w=(s:string)=>new Set(plain(s.split(/\n\n/)[0]!).split(' ').filter(x=>x.length>2));const x=w(a),y=w(b);if(!x.size||!y.size)return false;let k=0;for(const t of x)if(y.has(t))k++;return k/Math.max(x.size,y.size)>=0.8}
/** Vincolo (Y1): un'eliminazione vale solo per i piatti nella portata di un verbo «elimina/cancella…». Le parti del messaggio
 * si leggono in ordine: una parte con il verbo di eliminare apre la portata, una parte con un altro verbo d'azione o un prezzo
 * la chiude; una parte senza verbi («e la parmigiana») continua quella di prima. Piatti non nominati (pronomi) non si controllano. */
const OTHER_VERB=/\b(?:nascond\w*|togli\w*|lev[ai]\w*|mett\w*|aggiung\w*|spost\w*|rinomin\w*|finit\w*|esaurit\w*|evidenza|aument\w*|abbass\w*|cambi\w*|port[aio]\w*|rimett\w*|costa\w*|prezzo)\b|\b(?:a|costa)\s+\d/
export function deleteScopeProblem(message:string,actions:MenuAction[],refs:MenuRef[]):string[]{
 const dels=actions.filter(a=>a.kind==='delete'&&!a.undoCreate).map(a=>(a as any).id as string);if(!dels.length)return[]
 const parts=message.split(/[,;]|\s+(?:e|ed|poi|anche)\s+/i).map(x=>plain(x)).filter(Boolean);let cur:'del'|'other'|null=null;const scope=new Map<string,Set<string>>()
 for(const p of parts){const del=DELETE_RE.test(p),other=OTHER_VERB.test(p.replace(DELETE_RE,' '));if(del)cur='del';else if(other)cur='other'
  for(const r of refs)if((' '+p+' ').includes(' '+plain(r.name)+' ')||plain(r.name).split(' ').some(w=>w.length>=4&&(' '+p+' ').includes(' '+w+' '))){const s=scope.get(r.id)??new Set();s.add(del&&other&&!new RegExp('\\b'+plain(r.name).split(' ')[0]!+'\\b').test(p.slice(p.search(DELETE_RE)))?'other':cur??'none');scope.set(r.id,s)}}
 // «il tiramisù non lo facciamo più, eliminalo»: il pronome dopo riporta l'eliminazione ai piatti detti prima senza verbo (R5.1).
 if(parts.some(p=>/\b(?:elimin|cancell)\w*l[oaie]\b/.test(p)&&!refs.some(r=>(' '+p+' ').includes(' '+plain(r.name)+' '))))for(const s of scope.values())if(s.size===1&&s.has('none'))s.add('del')
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
 const newNames=actions.flatMap(a=>'name' in a&&typeof (a as any).name==='string'?[' '+plain((a as any).name)+' ']:[]) // «rinomina il pollo in Pollo alla diavola»: la Diavola è nel nome nuovo, non è una parte persa
 const words=(s:string)=>' '+plain(s)+' ',named=(r:MenuRef,c:string)=>{const w=words(c),n=plain(r.name);return w.includes(' '+n+' ')||(!n.includes(' ')&&/h/.test(n)&&w.includes(' '+n.replace(/h/g,'')+' '))}
 for(const c of message.split(/[,;.]|\s+(?:e|ed|poi)\s+/)){if(!ACT_VERB.test(plain(c)))continue;const ds=refs.filter(r=>named(r,c)&&!newNames.some(n=>n.includes(' '+plain(r.name)+' ')));if(!ds.length||ds.some(r=>touched.has(r.id)||ex.has(r.id)))continue;out.push(c.trim().slice(0,40))}
 return out}
/** Vincolo: uno spostamento va nella categoria che il titolare nomina (o in una creata in questo piano, o in quella dell'ultimo
 * spostamento scritto dal bot per «anche X»). Il modello non sceglie la categoria. */
export function moveTargetProblem(message:string,actions:MenuAction[],sections:SectionRef[],lastBot=''):string[]{
 const p=' '+plain(message)+' ',bot=plain(lastBot),fresh=new Map(actions.flatMap(a=>a.kind==='create_section'?[[a.newSectionId,a.name] as const]:[])),out:string[]=[]
 for(const a of actions){if(a.kind!=='move')continue;const name=fresh.get(a.sectionId)??sections.find(s=>s.id===a.sectionId)?.name;if(!name){out.push(a.id);continue}
  const pubName=sections.find(s=>s.id===a.sectionId)?.pub,ws0=plain(name).split(' ').filter(w=>w.length>=3),gen=ws0.filter(w=>!/^(?:piatt[oi]|menu|sezion[ei]|categori[ae]|dell[aeo]|degli|nostr[aeio])$/.test(w)),ws=gen.length?gen:ws0,said=ws.some(w=>p.includes(' '+w.slice(0,Math.min(5,w.length))))||sameSection(name,plain(message))||(!!pubName&&sections.filter(s=>s.pub===pubName).length===1&&[...p.matchAll(/ (?:nei|negli|nelle|nel|nella|in|verso|sotto|dentro) ((?:\S+ ?){1,3})/g)].some(m=>nameInText(pubName,m[1]!,true)))
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
// R8 (18/10, QA dal vivo «Aggiunti i nuovi piatti…» senza scrittura): anche i participi da soli («aggiunti», «creata», «spostati»…)
// in una frase che non è una domanda sono un «fatto». Le domande («Vuoi che la sposti?», «La creo?») restano ammesse.
const CLAIM_PART=/\b(?:aggiunt[oaie]|creat[oaie]|inserit[oaie]|spostat[oaie]|rinominat[oaie]|eliminat[oaie]|cancellat[oaie]|nascost[oaie]|rimoss[oaie]|tolt[oaie]|mess[oaie]|cambiat[oaie]|segnat[oaie]|rimess[oaie]|annullat[oaie]|ho (?:inserito|rimosso|reso|fatto|messo|tolto|aggiunto|creato|spostato))\b/
export const claimsWrite=(s:string)=>CLAIM.test(plain(s))||s.split(/(?<=[.!?\n])\s*/).some(x=>!/\?\s*$/.test(x.trim())&&CLAIM_PART.test(plain(x)))
/** Bozza utilizzabile o null. `wrote` = il server ha scritto e riletto tutte le azioni; `numbers` = numeri ammessi
 * (detti dal titolare, prezzi scritti, prezzi dei piatti citati). */
export function cleanDraft(draft:unknown,o:{wrote:boolean,numbers:number[]}):string|null{
 if(typeof draft!=='string')return null;let s=draft.replace(/[`~]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();if(!s||s.length>600)return null
 if(!o.wrote&&claimsWrite(s))return null
 // Codici interni del contesto («p5», «c2») mai al titolare.
 if(/\b[pc]\d{1,3}\b/i.test(s))return null
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
