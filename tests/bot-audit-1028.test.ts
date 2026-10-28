// AUDIT 28/10 sera («chat anti-rincoglioniti»: 4 batterie, ~1100 conversazioni + prova dal vivo). Ogni blocco = un bug trovato.
// Base: chat di Luisa del 28/10/2026 18:59–19:22 (Victoria Bar): quattro tentativi di rifare il Menu Cena. Dopo «elimina secondi» il bot perdeva
// il sottomenu e metteva i piatti per portata in Primi/Contorni; «tagliolini cozze e pomodori» diventava «Fagiolini cozze» + «Pomodori»;
// «Mandami menù sera» chiedeva sempre quale menu; i vocali «mandami menù cena da stampare» non davano il PDF; il PDF chiesto mentre un
// inserimento era in lavorazione partiva prima della sua conferma. Testi SINTETICI sulla copia della struttura di Victoria
// (tests/fixtures/victoria-struttura-1023.json: solo nomi/prezzi/sottomenu). Route vero, DB e modello finti: ogni scrittura è del server.
import {afterAll,describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-28T17:59:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {createFakeHaiku,A,P,Q,code,type Planner,type FakeCtx} from './eval/fake-haiku.js'
import {ruleTurn,parseInsert,type RuleMenu} from '../apps/server/src/lib/owner-brain-svuota.js'
import {pdfIntent} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {menusIn} from '../apps/server/src/lib/owner-brain-svuota.js'
import {splitPieces} from '../apps/server/src/lib/dish-split.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

// ---------------- copia della struttura di Victoria ----------------
const STRUCT=JSON.parse(readFileSync(new URL('./fixtures/victoria-struttura-1023.json',import.meta.url),'utf8')) as any[]
let n=0;const id=(p:string)=>p+'-5555-4555-8555-'+String(++n).padStart(12,'0')
function victoria():EvalMenu{n=0
 return{menus:STRUCT.map(m=>{const sections=m.sections.map((s:any)=>({id:id('7c000000'),name:s.name,items:s.items.map(([nm,price,h]:[string,number,boolean?])=>({id:id('5c000000'),name:nm,price,...(h?{hidden:true}:{})}))}))
  return{id:id('6c000000'),name:m.name,type:m.type,...(m.pricing==='fisso'?{pricing:'fisso',formulas:m.formulas.map((f:any)=>({id:id('5d000000'),name:f.name,price:f.price,note:f.note,sectionIds:f.secs.map((i:number)=>sections[i].id),translations:{}}))}:{}),sections}}) as any,design:{}}}
const W0=workspaceSchema.parse(victoria()),CAT=catalogOf(W0)
const MENUS:RuleMenu[]=(W0.menus as any[]).map(m=>({id:m.id,name:m.name,pricing:m.pricing==='fisso'?'fisso':'carta',formulas:(m.formulas??[]).map((f:any)=>({id:f.id,name:f.name,price:Number(f.price)}))}))
const M=(w:any,name:string)=>w.menus.find((m:any)=>m.name===name)
const secItems=(w:any,menu:string,sec:string)=>M(w,menu).sections.find((s:any)=>s.name===sec).items.filter((i:any)=>!i.hidden).map((i:any)=>i.name)
const allItems=(w:any)=>JSON.stringify(w.menus.map((m:any)=>[m.name,m.sections.map((s:any)=>[s.name,s.items.map((i:any)=>i.name+':'+i.price+(i.hidden?':h':''))])]))
const shape=(w:any)=>JSON.stringify(w.menus.map((m:any)=>({name:m.name,pricing:m.pricing??null,formulas:(m.formulas??[]).map((f:any)=>[f.name,f.price]),sections:m.sections.map((s:any)=>s.name)})))


// ---------------- route ----------------
Object.assign(process.env,{JWT_SECRET:'j'.repeat(48),WEB_ORIGIN:'https://takoitalia.com'})
// il locale serve il PDF (attivo, non in prova): nel DB finto del route manca la riga
const sqlPdf=(t:string,p:unknown[])=>t.startsWith('SELECT active,settings FROM restaurants')?[{active:true,settings:{timezone:'Europe/Rome'}}]:brainSql(t,p)
const base:Planner=c=>{const m=plainT(c.message);if(/^(?:annulla|annulla l ultima)$/.test(m))return P('change',[A('undo_last')],'Ok, annullo.');return P('chat',[],'MODELLO')}
async function play(turns0:(Turn|string)[],planner:Planner=base,o:{slowMs?:number}={}){const turns=turns0.map(t=>typeof t==='string'?{text:t}:t) as Turn[]
 const fake=createFakeHaiku(planner),slow=o.slowMs?{...fake,handle:async(u:string,i:any)=>{await new Promise(r=>setTimeout(r,o.slowMs));return fake.handle(u,i)}}:fake
 installNet(null,realFetch,slow as any);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'luisa-1028',family:'manuel',menu:'victoria',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:sqlPdf}).run(c,structuredClone(victoria()),{restaurant:'Victoria (copia)'})
 return{replies:run.turns.map(t=>t.reply.replace(/^Sono l.*?persona\.\s*/s,'')),menus:[workspaceSchema.parse(victoria()),...run.turns.map(t=>t.menuAfter as any)] as any[]}}
const last=(r:{menus:any[]})=>r.menus[r.menus.length-1]
const CENA=(w:any,sec:string)=>secItems(w,'Menu Cena',sec)
const PDF_CENA=/Ecco il PDF da stampare: \*Menu Cena\*/
const SECS=CAT.sections.filter(s=>s.menu==='Menu Cena')


const same=(r:{menus:any[]},i:number,j:number)=>expect(allItems(r.menus[j])).toBe(allItems(r.menus[i]))
const formula=(w:any,menu:string,f:string)=>M(w,menu).formulas.find((x:any)=>x.name===f).price
const names=(w:any)=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.filter((i:any)=>!i.hidden).map((i:any)=>i.name as string)))
const base0=names(workspaceSchema.parse(victoria()))
/** nessun piatto NUOVO (rispetto alla copia di partenza) col nome che combacia */
const noDish=(w:any,re:RegExp)=>{const fresh=names(w).filter((n:string)=>!base0.includes(n));expect(fresh.filter((n:string)=>re.test(n))).toEqual([])}

describe('A) dopo «elimina X» le risposte di dialogo non diventano piatti',()=>{
 for(const t of ['un attimo','boh','dopo','non lo so','che tempo fa','non funziona','dove','torna indietro','no aspetta non volevo','chiama Manuel','brava','buonanotte','stop','fermati','oddio','che casino','mamma mia','fammi vedere','ripristina','annula','va benissimo cosi','aspetta che ci penso','nessuno','si si','ok','va bene grazie','ok perfetto','ok grazie','sì grazie'])
  it(t,async()=>{const r=await play(['Elimina secondi menù sera',t]);same(r,1,2)})
 it('vocale «un attimo che ci penso»',async()=>{const r=await play(['Elimina secondi menù sera',{voice:'un attimo che ci penso'} as any]);same(r,1,2)})
 it('«ok» poi «inserisci tagliata»: il contesto resta',async()=>{const r=await play(['Elimina secondi menù sera','ok','inserisci tagliata']);expect(CENA(r.menus[3],'Secondi')).toEqual(['Tagliata'])})
 it('«no» subito dopo lo svuotamento: spiega «annulla», niente scritto',async()=>{const r=await play(['Elimina secondi menù sera','no']);same(r,1,2);expect(r.replies[1]).toMatch(/annulla/)})
 it('«nei dolci inserisci tiramisù» col contesto Secondi della Cena: mai nei Secondi',async()=>{const r=await play(['Elimina secondi menù sera','nei dolci inserisci tiramisù']);expect(CENA(r.menus[2],'Secondi')).toEqual([])})})

describe('A) verbi storpiati e cortesie',()=>{
 for(const v of ['insersci','aggingi','isnerisci','nserisci','in serisci','inse risci'])
  it(v,async()=>{const r=await play(['Elimina primi menù sera',v+' tagliolini cozze e pomodori, gnocchi alla sorrentina']);expect(CENA(r.menus[2],'Primi')).toEqual(['Tagliolini cozze e pomodori','Gnocchi alla sorrentina'])})
 it('«buonasera elimina i primi del menu sera»',async()=>{const r=await play(['buonasera elimina i primi del menu sera']);expect(CENA(r.menus[1],'Primi')).toEqual([])})
 it('«ciao buonasera allora elimina i primi della sera grazie» + «allora inserisci per favore lasagna, carbonara grazie mille»',async()=>{
  const r=await play(['ciao buonasera allora elimina i primi della sera grazie','allora inserisci per favore lasagna, carbonara grazie mille'])
  expect(CENA(r.menus[1],'Primi')).toEqual([]);expect(CENA(r.menus[2],'Primi')).toEqual(['Lasagna','Carbonara'])})
 it('separatori: barra, «virgola» e «punto» detti a voce',async()=>{
  const a=await play(['Elimina primi menù sera','inserisci lasagna / carbonara']);expect(CENA(a.menus[2],'Primi')).toEqual(['Lasagna','Carbonara'])
  const b=await play(['Elimina primi menù sera',{voice:'inserisci lasagna virgola carbonara virgola gnocchi'} as any]);expect(CENA(b.menus[2],'Primi')).toEqual(['Lasagna','Carbonara','Gnocchi'])})})

describe('A) divisione e contesto',()=>{
 it('«tagliolini cozze e pomodori gnocchi alla sorrentina» senza virgola: mai «Pomodori gnocchi…» scritto',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci tagliolini cozze e pomodori gnocchi alla sorrentina'])
  noDish(r.menus[2],/^Pomodori gnocchi|^Tagliolini cozze$/);expect(r.replies[1]).toMatch(/Tagliolini cozze e pomodori/)})
 it('due Menu nello stesso «elimina»: niente scritto, una cosa alla volta',async()=>{
  for(const t of ['elimina i primi della cena e i secondi del pranzo','elimina i primi del pranzo e della cena']){const r=await play([t]);same(r,0,1);expect(r.replies[0],t).toMatch(/Una cosa alla volta/)}})
 it('dopo «svuota il menu sera» un inserimento senza sottomenu non va tutto nei Primi',async()=>{
  const r=await play(['svuota il menu sera','inserisci tagliata, orata al forno']);expect(CENA(r.menus[2],'Primi')).toEqual([])})
 it('dopo «elimina primi e contorni» un inserimento senza sottomenu non va nei Primi',async()=>{
  const r=await play(['elimina primi e contorni menu sera','inserisci tagliolini, patate al forno']);expect(CENA(r.menus[2],'Primi')).toEqual([])})
 it('frase lunga che parla dei primi: mai la proposta di svuotare TUTTO il Menu',async()=>{
  const r=await play(['allora senti stasera i primi che c erano non ci sono più quindi toglili tutti dal menu della sera e poi ci metti i tagliolini cozze e pomodori'])
  expect(r.replies[0]).not.toMatch(/11 piatti|tutti gli|Elimino il/);expect(CENA(r.menus[1],'Secondi').length).toBe(3)})
 it('un piatto per messaggio dopo lo svuotamento: tutti scritti, nessuno perso',async()=>{
  const r=await play(['Elimina secondi menù sera','Inserisci tagliata','Inserisci orata al forno','Inserisci nodino alla griglia'])
  expect(CENA(last(r),'Secondi')).toEqual(['Tagliata','Orata al forno','Nodino alla griglia'])})
 it('maiuscolo nella sostituzione giornaliera: nomi normali',async()=>{
  const r=await play(['STASERA PRIMI TAGLIOLINI COZZE E POMODORI, GNOCCHI ALLA SORRENTINA']);noDish(r.menus[1],/TAGLIOLINI/)})
 it('correzione «X e Y sono due piatti diversi» alla proposta, anche dopo «no»',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo e gnocchi','no, rigatoni al sugo e gnocchi sono due piatti diversi'])
  expect(r.replies[2]).not.toMatch(/non ho cambiato nulla/i)})})

describe('B) flusso e conferme',()=>{
 it('«In quale Menu?» + comando completo: il comando nuovo si esegue, la lasagna non finisce nel Menu',async()=>{
  for(const t of ['Elimina secondi menù sera','nel menu cena nei secondi inserisci tagliata','quanto costa il menu cena?']){const r=await play(['nei primi inserisci lasagna',t]);expect(CENA(last(r),'Primi'),t).not.toContain('Lasagna')}})
 it('«In quale Menu?» + «sì»: si richiede quale, la domanda resta; poi «cena» esegue',async()=>{
  const r=await play(['nei primi inserisci lasagna','sì','cena']);expect(r.replies[1]).toMatch(/Dimmi quale Menu/);expect(CENA(r.menus[3],'Primi')).toContain('Lasagna')})
 it('«Elimino il Menu Cena intero?» + qualunque cosa che non sia sì, poi «sì»: MAI eliminato',async()=>{
  for(const t of ['anzi no','sì ma tieni i primi','grazie','?','la margherita a 8']){const r=await play(['elimina il menu cena',t,'sì']);expect(M(last(r),'Menu Cena'),t).toBeTruthy()}})
 it('«Elimino i dolci alla carta?» + risposta che non è sì, poi «sì»: MAI eliminati',async()=>{
  for(const t of ['anzi no','non lo so','sì ma lascia il tartufo','grazie']){const r=await play(['elimina i dolci dal menu alla carta',t,'sì']);expect(secItems(last(r),'Alla carta','Dolci').length,t).toBe(9)}})
 it('alla proposta, risposte che non sono piatti: niente scritto',async()=>{
  for(const t of ['non lo so','boh','esattamente così no','due','mettili nel menu giorno','sono secondi non primi','nei secondi','il secondo no','va bene ma senza rigatoni','sì, metti anche la lasagna','va bene ma sono tre: a, b, c']){
   const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo',t]);noDish(r.menus[3],/^(?:Mettili|Secondi|Secondo|Ma senza|Ma sono|Non lo so|Boh|Due)\b/i);if(!/^va bene ma sono tre/.test(t))expect(CENA(r.menus[3],'Primi'),t).toEqual([])}})
 it('«rigatoni al sugo no»: tolti dalla proposta, niente scritto; poi «sì» scrive solo il pesto',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo','rigatoni al sugo no','sì'])
  expect(CENA(r.menus[3],'Primi')).toEqual([]);expect(CENA(r.menus[4],'Primi')).toEqual(['Pasta al pesto'])})
 it('stesso messaggio due volte: la conferma resta',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo','inserisci pasta al pesto rigatoni al sugo']);expect(CENA(r.menus[3],'Primi')).toEqual([])})})

describe('C) operazioni: pezzi di comando mai nel nome',()=>{
 for(const t of ['nel menu giorno togli la coppa e metti la salsiccia e mandami il pdf','nel menu giorno togli la coppa e metti la salsiccia e fammi vedere il menu','nel menu giorno togli la coppa e metti la descrizione al nodino','nel menu giorno togli la coppa e metti la salsiccia anzi no','nel menu giorno togli la coppa e metti la salsiccia e aggiungi nei primi lasagne','nel menu giorno cambia coppa con salsiccia e nodino con bistecca','nel menu giorno nei secondi aggiungi salsiccia poi fammi vedere il menu','nel menu giorno nei secondi aggiungi salsiccia, scusa volevo dire bistecca','nel menu giorno nei secondi aggiungi salsiccia, quella di ieri','oggi a pranzo secondi: come ieri','oggi a pranzo secondi: boh','oggi a pranzo primi: lasagne, gnocchi, mandami il pdf','oggi a pranzo primi: lasagne, gnocchi, grazie mille'])
  it(t,async()=>{const r=await play([t]);noDish(r.menus[1],/\b(?:mandami|fammi|descrizione|anzi|primi|nodino con bistecca|poi fammi|dire bistecca|quella di ieri|come ieri|boh|mille|grazie|pdf)\b/i)})
 it('«togli la coppa e metti al suo posto la salsiccia»: Salsiccia',async()=>{const r=await play(['nel menu giorno togli la coppa e metti al suo posto la salsiccia']);noDish(r.menus[1],/Suo posto/i)})
 it('«cambia la coppa con la coppa»: niente',async()=>{const r=await play(['nel menu giorno cambia la coppa con la coppa']);same(r,0,1)})
 it('alla carta «togli X e metti Y» non crea X',async()=>{const r=await play(['togli il branzino al forno dal menu alla carta e metti l orata','16']);noDish(r.menus[2],/^Branzino al forno$/i)})
 it('prezzi delle opzioni a parole con decimali',async()=>{
  expect(formula((await play(['il completo della cena a diciassette e cinquanta'])).menus[1],'Menu Cena','Completo')).toBe(17.5)
  expect(formula((await play(['il solo primo della cena a dieci e novanta'])).menus[1],'Menu Cena','Solo primo')).toBe(10.9)
  expect(formula((await play(['il completo del pranzo a 12 e mezzo'])).menus[1],'Menu Giorno','Completo')).toBe(12.5)
  expect(formula((await play(['il completo della cena a -5'])).menus[1],'Menu Cena','Completo')).toBe(16.9)})
 it('«il completo della cena e del pranzo a 15»: una cosa alla volta',async()=>{const r=await play(['il completo della cena e del pranzo a 15']);same(r,0,1)})})

describe('D) domande e lamentele non modificano mai il menu',()=>{
 for(const t of ['i secondi del menu sera sono spariti','i primi del menu sera sono troppi','i contorni del menu cena sono buoni','i primi del menu giorno sono quelli di ieri','stasera i secondi sono pochi','i primi a pranzo sono troppo cari','posso aggiungere la tagliata nei secondi della cena','si può inserire la tagliata nei secondi della cena','come faccio a inserire la tagliata nei secondi della cena','potrei mettere la tagliata nei secondi della cena','volevo inserire la tagliata nei secondi della cena ma non so come','il completo del menu cena costa 20 euro vero','ma il completo del menu cena non costava 20','il cliente dice che il completo del menu cena costa 20','dimmi il prezzo del completo del menu cena 20','mandami il menu cena col completo a 20','domani inserisci la tagliata nei secondi della cena'])
  it(t,async()=>{const r=await play([t]);same(r,0,1)})
 it('«c’è la carbonara nel menu cena?» risponde dal menu, niente scritto',async()=>{
  const a=await play(['c’è la linguine alla carbonara nel menu cena?']);expect(a.replies[0]).toMatch(/^Sì/);same(a,0,1)
  const b=await play(['c’è la tagliata nel menu cena?']);expect(b.replies[0]).toMatch(/^No/);same(b,0,1)})})

describe('D) PDF',()=>{
 it('risposta a «Quale menu ti mando in PDF?»: nome, numero, «tutti»',async()=>{
  for(const [t,re] of [['cena',PDF_CENA],['2',/Ecco il PDF/],['tutti',/Ecco il PDF da stampare: \*Menu Giorno\* e \*Menu Cena\*/],['quello della sera',PDF_CENA]] as [string,RegExp][]){const r=await play(['mandami il menu',t]);expect(r.replies[1],t).toMatch(re)}})
 it('«mandami tutti i menu», «anteprima», «la foto del menu di stasera», «pdf del menu da 12»',async()=>{
  expect((await play(['mandami tutti i menu'])).replies[0]).toMatch(/Ecco il PDF da stampare: \*Menu Giorno\* e/)
  expect((await play(['Elimina secondi menù sera','anteprima'])).replies[1]).toMatch(PDF_CENA)
  expect((await play(['mi mandi la foto del menu di stasera'])).replies[0]).toMatch(PDF_CENA)
  expect((await play(['manda il pdf del menu da 12'])).replies[0]).toMatch(/\*Menu Giorno\*/)})
 it('richieste che il PDF non soddisfa: nessun PDF finto',async()=>{
  for(const t of ['mandami il menu cena senza i primi','mandami il menu della cena di ieri','inviami il menu cena per email','il pdf del menu cena è vecchio'])expect((await play([t])).replies[0],t).not.toMatch(/Ecco il PDF/)})
 it('etichette senza «Menu Drinks»',async()=>{expect((await play(['mandami il pdf dei drinks'])).replies[0]).not.toMatch(/Menu Drinks/)})})

// ======================= verifica E: comandi giusti che le protezioni non devono bloccare =======================
describe('E) piatti veri e comandi chiari passano',()=>{
 for(const n of ['spaghetti alla buona','pasta fredda','pane caldo','provola alla piastra','polpette della mamma','pesto di mandorle','pasta tutti i sapori','risotto ai funghi molto cremoso','tagliatelle della domenica','patate con aggiunta di rosmarino','orata/branzino al forno','trippa come si fa a roma'])
  it(n,async()=>{const r=await play(['Elimina primi menù sera','inserisci '+n]);const got=CENA(r.menus[2],'Primi');expect(got.length,JSON.stringify(got)).toBe(1);expect(plainT(got[0]!)).toBe(plainT(n))})
 it('«purè, patate al forno» nei Contorni',async()=>{const r=await play(['Elimina contorni menù sera','inserisci purè, patate al forno']);expect(CENA(r.menus[2],'Contorni')).toEqual(['Purè','Patate al forno'])})
 it('«sì mettili», «sì, sono questi» applicano la proposta',async()=>{for(const y of ['sì mettili','sì, sono questi','esatto sono quelli']){const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo',y]);expect(CENA(r.menus[3],'Primi'),y).toEqual(['Pasta al pesto','Rigatoni al sugo'])}})
 it('«sì sì eliminali», «certo, eliminali», «va bene eliminali» eliminano i dolci alla carta',async()=>{for(const y of ['sì sì eliminali','certo, eliminali','va bene eliminali','si va bene']){const r=await play(['elimina i dolci dal menu alla carta',y]);expect(secItems(r.menus[2],'Alla carta','Dolci'),y).toEqual([])}})
 it('due Menu senza secondo comando: si esegue',async()=>{
  expect(formula((await play(['il completo della cena a 18 come il pranzo'])).menus[1],'Menu Cena','Completo')).toBe(18)
  const r=await play(['elimina i primi della cena, quelli del pranzo restano']);expect(r.replies[0]).not.toMatch(/Una cosa alla volta/);expect(secItems(r.menus[1],'Menu Giorno','Primi').length).toBe(3)})
 it('«metti il completo della cena a 18 e mandami il pdf» cambia il prezzo',async()=>{expect(formula((await play(['metti il completo della cena a 18 e mandami il pdf'])).menus[1],'Menu Cena','Completo')).toBe(18)})
 it('«abbiamo finito la coppa» non è «No, non c’è»',async()=>{const r=await play(['abbiamo finito la coppa']);expect(r.replies[0]).not.toMatch(/^No, nel/)})
 it('«nei primi alla carta aggiungi primo del giorno a 10» non tocca il Solo primo',async()=>{const r=await play(['nei primi piatti alla carta aggiungi primo del giorno a 10']);expect(formula(r.menus[1],'Menu Giorno','Solo primo')).toBe(9)})
 it('«stasera secondi: pollo fritto, salsiccia» mai «Fritto» da solo',async()=>{const r=await play(['stasera secondi: pollo fritto, salsiccia']);noDish(r.menus[1],/^Fritto$/i)})})

// ======================= verifica F: buchi rimasti =======================
describe('F) dopo «elimina X» e con una proposta aperta, interiezioni e nomi non da cibo non si scrivono',()=>{
 for(const t of ['noo','nooo!','nono','mannaggia','uffa','hmm','eccomi','pronto','vediamo','ahah','lol','salve','sei bravissima','chiedo al cuoco','sto pensando','domenica','xxx','Marco','ciao sono Luisa','poi ti dico','ridammi i secondi di prima','un secondo che controllo'])
  it('dopo lo svuotamento: '+t,async()=>{const r=await play(['Elimina secondi menù sera',t]);same(r,1,2)})
 for(const t of ['noo','nooo!','nono','noo aspetta','nope','mannaggia','uffa','mmm','hmm ok','fatto','pronto','ahah','mio marito','neanche per sogno','assolutamente no','giorno'])
  it('con la proposta: '+t,async()=>{const r=await play(['Elimina primi menù sera','inserisci pasta al pesto rigatoni al sugo',t]);same(r,2,3)})})
describe('F) altri buchi',()=>{
 it('conferma di eliminazione + PDF in mezzo + «sì»: MAI eliminato',async()=>{
  for(const mid of ['mandami il pdf','mandami menù sera']){const r=await play(['elimina il menu cena',mid,'sì']);expect(M(last(r),'Menu Cena'),mid).toBeTruthy()}
  const d=await play(['elimina i dolci dal menu alla carta','mandami menù sera','sì']);expect(secItems(last(d),'Alla carta','Dolci').length).toBe(9)})
 it('«del giorno» dentro il nome resta nel Menu Cena e il nome resta intero',async()=>{
  const r=await play(['Elimina primi menù sera','inserisci pescato del giorno']);expect(CENA(r.menus[2],'Primi')).toEqual(['Pescato del giorno']);expect(secItems(r.menus[2],'Menu Giorno','Primi').length).toBe(3)})
 it('inserire e poi togliere nello stesso messaggio: niente scritto',async()=>{
  for(const t of ['nel menu cena nei primi inserisci lasagna e svuota i secondi','nel menu cena nei primi inserisci lasagna e togli la carbonara']){const r=await play([t,'sì']);same(r,0,2)}})
 it('«togli tutto dal menu alla carta» chiede il sì',async()=>{const r=await play(['togli tutto dal menu alla carta']);same(r,0,1);expect(r.replies[0]).toMatch(/Rispondi \*sì\*/)})
 it('nomi con primo/secondo/contorno al singolare restano interi',async()=>{
  const a=await play(['Elimina primi menù sera','inserisci gnocchi al secondo sugo']);expect(CENA(a.menus[2],'Primi')).toEqual(['Gnocchi al secondo sugo'])
  const b=await play(['Elimina secondi menù sera','inserisci tagliata con contorno']);expect(CENA(b.menus[2],'Secondi')).toEqual(['Tagliata con contorno'])})
 it('vocale «… punto» in fondo',async()=>{const r=await play(['Elimina primi menù sera',{voice:'inserisci gnocchi punto carbonara punto'} as any]);expect(CENA(r.menus[2],'Primi')).toEqual(['Gnocchi','Carbonara'])})
 it('«hai messo la lasagna?» non dà un «No» falso',async()=>{const r=await play(['hai messo la lasagna?']);expect(r.replies[0]).not.toMatch(/^No, nel/)})
 it('«anzi no menu pranzo» dopo lo svuotamento spiega «annulla»',async()=>{const r=await play(['Elimina primi menù sera','anzi no menu pranzo']);expect(r.replies[1]).toMatch(/annulla/);same(r,1,2)})
 it('un comando dopo «Quale menu ti mando in PDF?» si esegue',async()=>{const r=await play(['mandami il menu','Elimina primi menù sera']);expect(CENA(r.menus[2],'Primi')).toEqual([])})
 it('«carta» come risposta a «In quale Menu?»',async()=>{const r=await play(['elimina i contorni','carta']);expect(r.replies[1]).not.toBe('MODELLO')})})

// ======================= prova dal vivo v195 (modello vero sul QA) =======================
describe('dal vivo v195',()=>{
 it('«annulla» subito dopo lo svuotamento rimette i piatti',async()=>{const r=await play(['Elimina secondi menù sera','annulla']);same(r,0,2)})
 it('«mannaggia» dopo lo svuotamento: il sottomenu resta il contesto',async()=>{const r=await play(['Elimina secondi menù sera','mannaggia','inserisci tagliata, orata al forno']);expect(CENA(r.menus[3],'Secondi')).toEqual(['Tagliata','Orata al forno'])})
 it('bozza «In quale sottomenu metto Tagliata?» + «i contorni del menu cena sono buoni»: niente creato',async()=>{
  const pl:Planner=c=>/tagliata/i.test(c.message)?P('clarify',[],'In quale sottomenu metto *Tagliata*?',{clarify:{question:'In quale sottomenu metto *Tagliata*?',item_refs:[],missing:['section']},name:'Tagliata'}):base(c)
  const r=await play(['nel menu cena aggiungi la tagliata','i contorni del menu cena sono buoni'],pl);noDish(r.menus[2],/^Tagliata$/i)})})
