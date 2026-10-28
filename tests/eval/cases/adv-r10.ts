// Batteria R10 (18/10/2026, agente R7): bug dal vivo sul QA 16:03–16:06 UTC. «Togli tutti i piatti dalla sezione altre proposte»
// → «Quale sezione intendi nascondere?» → «Quali piatti…?» → «Non esiste una sezione chiamata "altre proposte"»: «Altre proposte» è
// il nome che la pagina pubblica dà alle sezioni non riconosciute. E «nei primi aggiungi … pasta al ragù» con il ragù in un'altra
// sezione: aggiornato ma non spostato.
// Famiglie: azioni su nomi pubblici (nascondi/mostra/finiti/tornati/prezzi/sposta «tutti i…»), modello testardo che ignora il testo,
// flusso vero di Manuel, sezioni inesistenti (lo dice subito con l'elenco), piatto già nel menu in un'altra sezione (spostato),
// letture e controlli. Menu: fixture r10-macro (sezioni che cadono in «Altre proposte», «Secondi e panini», «Dolci e frutta», due
// menu attivi) e QA vero riletto alle 16:10 (qa-live-1018-r10). Attese calcolate qui dalla fixture con una mappa scritta a mano
// (indipendente dal codice del bot). Runner: tests/eval/eval-adv-r10.test.ts (oracolo brain-oracle-r10.ts).
import {readFileSync} from 'node:fs'
import type {Change,Conversation,Family,Turn} from '../types.js'
import {FIXTURES} from '../fixtures/menus.js'
import type {R10Meta,R10Verb} from '../adapters/brain-oracle-r10.js'
import type {R9Meta} from '../adapters/brain-oracle-r9.js'

const load=(f:string)=>JSON.parse(readFileSync(new URL('../fixtures/'+f,import.meta.url),'utf8'))
FIXTURES.r10macro={key:'r10macro',restaurant:'Tako · Verifica web',menu:load('r10-macro.json')}
FIXTURES.qalive3={key:'qalive3',restaurant:'Tako · Verifica web',menu:load('qa-live-1018-r10.json')}

// Mappa scritta a mano: nome pubblico → sezioni (come le raggruppa la pagina pubblica).
const MACRO:Record<string,Record<string,string[]>>={
 r10macro:{'Altre proposte':['Piatti di prova','Sezione da spostare','Sezione da eliminare'],'Secondi e panini':['Panini','Carne'],'Dolci e frutta':['Dessert','Frutta'],'Bevande e caffetteria':['Bibite','Caffetteria'],'Panini':['Panini'],'Carne':['Carne'],'Bibite':['Bibite'],'Dessert':['Dessert'],'Caffetteria':['Caffetteria']},
 qalive3:{'Altre proposte':['Piatti di prova']}}
type It={name:string,price:number,hidden?:boolean,available?:boolean}
const itemsOf=(menu:string,target:string):It[]=>{const m=FIXTURES[menu]!.menu,secs=MACRO[menu]![target]!;return m.menus.flatMap(x=>x.sections.filter(s=>secs.includes(s.name)).flatMap(s=>s.items as It[]))}
const expect0=(menu:string,meta:R10Meta):Change[]=>{const its=itemsOf(menu,meta.target),vis=its.filter(i=>!i.hidden)
 switch(meta.verb){case 'hide':return vis.map(i=>({op:'hidden',dish:i.name,value:true}))
  case 'show':return its.filter(i=>i.hidden).map(i=>({op:'hidden',dish:i.name,value:false}))
  case 'fin':return vis.filter(i=>i.available!==false).map(i=>({op:'available',dish:i.name,value:false}))
  case 'back':return its.filter(i=>i.available===false).map(i=>({op:'available',dish:i.name,value:true}))
  case 'delta':return vis.map(i=>({op:'price',dish:i.name,price:Math.round((i.price+(meta.delta??1))*100)/100}))
  case 'move':return vis.map(i=>({op:'move',dish:i.name,section:meta.dest!}))
  default:return[]}}

export const ADV_R10_CASES:(Conversation&{r10?:R10Meta,r9?:R9Meta})[]=[]
let fam='macro'
const c=(menu:string,turns:Turn[],changes:Change[],x:{r10?:R10Meta,r9?:R9Meta,ask?:number[],alt?:Change[][]}={})=>{const id=`r10-${fam}-${String(ADV_R10_CASES.filter(k=>k.source===`r10:${fam}`).length+1).padStart(3,'0')}`
 ADV_R10_CASES.push({id,family:'b2-categorie' as Family,menu,turns,changes,source:`r10:${fam}`,...x})}
const V=(s:string):Turn=>({voice:s}),T=(s:string):Turn=>({text:s})
// Oltre 3 modifiche (non uniformi) il server chiede l'OK: la conversazione lo dà.
const needsOk=(meta:R10Meta,ch:Change[])=>ch.length>3&&meta.verb!=='delta'

// Forme per verbo: {x} = nome detto. Le storpiature dei vocali tengono le prime lettere (come Whisper sui nomi lunghi).
const FORMS:Record<R10Verb,string[]>={
 hide:['Togli tutti i piatti dalla sezione {x}','nascondi tutti i piatti di {x}','togli tutto quello che c’è in {x}, tutti i piatti','leva tutti i piatti della sezione {x}','tutti i piatti delle {x} toglili dal menu'],
 show:['rimetti tutti i piatti di {x}','fai vedere di nuovo tutti i piatti della sezione {x}','rimetti nel menu tutti i piatti delle {x}','mostra tutti i piatti di {x}'],
 fin:['i piatti di {x} sono tutti finiti','segna finiti tutti i piatti della sezione {x}','tutti i piatti delle {x} sono esauriti','oggi è finito tutto in {x}, tutti i piatti'],
 back:['sono tornati tutti i piatti di {x}','rimetti disponibili tutti i piatti della sezione {x}','tutti i piatti di {x} sono di nuovo disponibili','c’è di nuovo tutto in {x}, tutti i piatti'],
 delta:['aumenta di un euro tutti i piatti di {x}','alza di 1 euro tutti i piatti della sezione {x}','tutti i piatti delle {x} aumentali di un euro','aumenta tutti i piatti di {x} di 1 euro'],
 move:['sposta tutti i piatti di {x} in {d}','metti tutti i piatti della sezione {x} nella sezione {d}','tutti i piatti delle {x} spostali in {d}','sposta in {d} tutti i piatti di {x}'],
 read:[]}
const DIST:Record<string,string[]>={'Altre proposte':['altre propose','le altre proposta'],'Secondi e panini':['secondi e panino','secondi panini'],'Dolci e frutta':['dolci frutta','dolcie frutta'],'Bevande e caffetteria':['bevanda e caffetteria','bevande caffè']}
const fill=(f:string,x:string,d='')=>f.replace('{x}',x).replace('{d}',d)

// ---- 1. azioni sui nomi pubblici (r10macro): verbo × nome pubblico × forme (testo col nome giusto, vocali storpiati) ----
fam='macro'
const PLAN:[R10Verb,string,string?][]=[['hide','Altre proposte'],['hide','Secondi e panini'],['hide','Dolci e frutta'],['hide','Bevande e caffetteria'],['show','Altre proposte'],['fin','Altre proposte'],['fin','Secondi e panini'],['fin','Dolci e frutta'],['fin','Bevande e caffetteria'],['back','Dolci e frutta'],['delta','Secondi e panini'],['delta','Bevande e caffetteria'],['delta','Altre proposte'],['move','Dolci e frutta','Primi'],['move','Altre proposte','Primi']]
for(const [verb,target,dest] of PLAN){const forms=FORMS[verb]
 forms.forEach((f,i)=>{const voice=i>=2,said=voice?DIST[target]![i%2]!:target.toLowerCase(),meta:R10Meta={verb,target,said,...(dest?{dest}:{}),...(verb==='delta'?{delta:1}:{})},ch=expect0('r10macro',meta)
  c('r10macro',[voice?V(fill(f,said,dest?.toLowerCase())):T(fill(f,said,dest?.toLowerCase())),...(needsOk(meta,ch)?[i%2?V('sì vai'):T('ok')]:[])],ch,{r10:meta})})}

// ---- 2. modello testardo: la domanda vera del bug per le prime N chiamate (il server deve correggerla, mai mandarla) ----
fam='testardo'
for(const [verb,target] of [['hide','Altre proposte'],['hide','Secondi e panini'],['fin','Altre proposte'],['fin','Dolci e frutta'],['hide','Bevande e caffetteria'],['show','Altre proposte'],['fin','Bevande e caffetteria'],['hide','Dolci e frutta']] as [R10Verb,string][])
 for(const [stubborn,n] of [['section',1],['dishes',1],['nonexist',1],['section',2]] as const){const said=target.toLowerCase(),meta:R10Meta={verb,target,said,stubborn,n},ch=expect0('r10macro',meta),f=FORMS[verb][0]!
  c('r10macro',[V(fill(f,said)),...(needsOk(meta,ch)?[T('ok')]:[])],ch,{r10:meta})}

// ---- 3. il flusso vero di Manuel sul QA (16:05–16:06), QA com'è adesso: «Altre proposte» = «Piatti di prova» ----
fam='manuel'
{const meta=(o:Partial<R10Meta>={}):R10Meta=>({verb:'hide',target:'Altre proposte',said:'altre proposte',...o}),ch=expect0('qalive3',meta())
 const M1='Togli tutti i piatti dalla sezione altre proposte',M2='tutti i piatti nella sezione altre proposte',M3='tutti i piatti'
 c('qalive3',[V(M1),T('ok')],ch,{r10:meta()})
 c('qalive3',[T(M1),V('sì vai')],ch,{r10:meta()})
 c('qalive3',[V(M1),V(M2),V(M3),T('ok')],ch,{r10:meta()})
 c('qalive3',[V(M1),V(M2),T('ok')],ch,{r10:meta()})
 c('qalive3',[V(M1),T('ok')],ch,{r10:meta({stubborn:'section',n:1})})
 c('qalive3',[V(M1),T('ok')],ch,{r10:meta({stubborn:'dishes',n:1})})
 c('qalive3',[V(M1),T('ok')],ch,{r10:meta({stubborn:'nonexist',n:1})})
 c('qalive3',[V(M1),V(M2),V(M3),T('ok')],ch,{r10:meta({stubborn:'section',n:2})})
 c('qalive3',[V('togli tutti i piatti dalla sezione altre propose'),T('ok')],ch,{r10:meta({said:'altre propose'})})
 c('qalive3',[V('Togli tutti i piatti dalla sezione altre proposte.')],[],{r10:meta()}) // senza OK: nulla di pubblicato
 c('qalive3',[V(M1),T('no lascia stare')],[],{r10:meta()})
 c('qalive3',[V('i piatti delle altre proposte sono tutti finiti'),T('ok')],expect0('qalive3',meta({verb:'fin'})),{r10:meta({verb:'fin'})})}

// ---- 4. sezione che non c'è: lo dice subito ed elenca le sezioni; nessuna scrittura ----
fam='inesistente'
const UNK:[string,string][]=[['togli tutti i piatti dalla sezione antipasti','antipasti'],['nascondi la categoria pizze','pizze'],['i piatti della sezione contorni sono finiti','contorni'],['sposta il tiramisù nella sezione gelati','gelati'],['togli tutti i piatti della categoria aperitivi','aperitivi'],['nascondi tutta la sezione specialità','specialita'],['segna finita la sezione insalate','insalate'],['togli i piatti della sezione bruschette','bruschette'],['nella categoria taglieri metti tutto a 10','taglieri'],['rimetti tutti i piatti della sezione grigliate','grigliate'],['togli la sezione crudi','crudi'],['nascondi tutti i piatti della sezione fritti','fritti']]
for(const [i,[t,said]] of UNK.entries()){const meta:R10Meta={verb:'hide',target:said,said,unknown:true};c('r10macro',[T(t)],[],{r10:meta,ask:[1]});c('r10macro',[V(t)],[],{r10:{...meta,bug:true},ask:[1]});if(i<6)c('qalive3',[V(t)],[],{r10:{...meta,bug:i%2===0},ask:[1]})}

// ---- 5. «aggiungi X in <sezione>» con X già nel menu in un'altra sezione: aggiornato E spostato (già lì: nessuno spostamento) ----
fam='sposta-gemello'
type Req={text:string,req:{name:string,price:number}[],twin:string,section:string,twinFrom:string,extra?:Change[]}
const REQS:Req[]=[
 {text:'nei primi aggiungi tiramisù a 7',req:[{name:'tiramisù',price:7}],twin:'tiramisù',section:'Primi',twinFrom:'Piatti di prova'},
 {text:'nel dessert aggiungi tiramisù a 6',req:[{name:'tiramisù',price:6}],twin:'tiramisù',section:'Dessert',twinFrom:'Piatti di prova'},
 {text:'nei primi aggiungi pasta al pesto a 12',req:[{name:'pasta al pesto',price:12}],twin:'pasta al pesto',section:'Primi',twinFrom:'Primi'},
 {text:'nei primi aggiungi pasta al ragù a 12 e riso nero a 9',req:[{name:'pasta al ragù',price:12},{name:'riso nero',price:9}],twin:'pasta al ragù',section:'Primi',twinFrom:'Piatti di prova',extra:[{op:'create',name:'riso nero',price:9,section:'Primi'}]},
 {text:'in carne aggiungi Polpette di prova a 8',req:[{name:'Polpette di prova',price:8}],twin:'Polpette di prova',section:'Carne',twinFrom:'Sezione da spostare'},
 {text:'aggiungi nella sezione panini il Panino porchetta a 9',req:[{name:'Panino porchetta',price:9}],twin:'Panino porchetta',section:'Panini',twinFrom:'Panini'}]
for(const r of REQS)for(const a of r.section===r.twinFrom?['aggiornalo','sì aggiornalo']:['aggiornalo','confermo','sì aggiornalo','il primo','crea nuovo','creane un altro']){const p=r.req.find(x=>x.name===r.twin)!.price
 const upd:Change[]=[{op:'price',dish:r.twin,price:p},...(r.section!==r.twinFrom?[{op:'move',dish:r.twin,section:r.section} as Change]:[])],cre:Change[]=[{op:'create',name:r.twin,price:p,section:r.section}]
 c('r10macro',[V(r.text),a==='confermo'?T(a):V(a)],[...(/^crea/.test(a)?cre:upd),...(r.extra??[])],{r9:{req:r.req,section:r.section,twins:[r.twin]},...(r.section!==r.twinFrom?{ask:[1]}:{})})}

// ---- 6. letture, sezioni nominate col loro nome, più menu attivi ----
fam='controlli'
for(const [t,target] of [['quali piatti ci sono nelle altre proposte?','Altre proposte'],['cosa c’è nei secondi e panini?','Secondi e panini'],['che piatti ho in dolci e frutta?','Dolci e frutta'],['cosa c’è in bevande e caffetteria?','Bevande e caffetteria']] as [string,string][])c('r10macro',[{text:t,q:true}],[],{r10:{verb:'read',target,said:target.toLowerCase()}})
for(const [t,verb,target] of [['nascondi tutti i panini','hide','Panini'],['segna finiti tutti i piatti della sezione carne','fin','Carne'],['togli tutte le bibite','hide','Bibite'],['i panini sono tutti finiti','fin','Panini'],['aumenta di un euro tutti i piatti della sezione carne','delta','Carne'],['togli tutti i piatti della sezione bibite','hide','Bibite'],['rimetti disponibili tutti i panini','back','Panini'],['nascondi tutti i piatti della carne','hide','Carne'],['sono finiti tutti i piatti della sezione dessert','fin','Dessert'],['nascondi tutti i piatti della sezione caffetteria','hide','Caffetteria'],['togli tutti i dessert','hide','Dessert']] as [string,R10Verb,string][]){const meta:R10Meta={verb,target,said:target.toLowerCase(),...(verb==='delta'?{delta:1}:{})};c('r10macro',[T(t)],expect0('r10macro',meta),{r10:meta})}

if(ADV_R10_CASES.length<180)throw new Error('batteria R10: meno di 180 conversazioni ('+ADV_R10_CASES.length+')')
