// Batteria DAL VIVO sul ristorante QA (26050ecd…). Uso:
//   node qa-live-batteria.mjs [tag] [--only id1,id2]
// Manda messaggi al webhook firmato con TakoSyncTest=1 dal numero collegato SOLO al QA (verificato), risposta solo nel TwiML,
// nessun WhatsApp inviato. Ogni conversazione rimette il QA com'era; se il menu pubblicato non torna identico prova a ripristinare
// con comandi inversi AL BOT (mai SQL); se non ci riesce si ferma. Lock: notte/QA.lock. Risultati: notte/qa-live-<tag>.json
import fs from 'node:fs';import path from 'node:path';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {createHmac,randomBytes} from 'node:crypto';import {fileURLToPath} from 'node:url'
import {q} from '../qa-read.mjs'
const HERE=path.dirname(fileURLToPath(import.meta.url)),QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',cfg=path.join(homedir(),'.config/tako-webapp')
const args=process.argv.slice(2),oi=args.indexOf('--only'),ONLY=oi>=0?args[oi+1].split(','):null
const TAG=args.find((a,i)=>!a.startsWith('--')&&(oi<0||i!==oi+1))||new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

// ---------- numero / firma ----------
// 22/10: TAKO_QA_PHONE (es. whatsapp:+3900000221022, numero fittizio collegato solo al QA) al posto del numero di backup; il controllo «solo QA» resta.
const phone=process.env.TAKO_QA_PHONE||JSON.parse(fs.readFileSync(path.join(cfg,'owner-service-qa-backup.json'),'utf8'))?.link?.phone
const link=await q(`SELECT restaurant_id FROM tako_whatsapp_links WHERE phone='${phone.replace(/'/g,"''")}'`)
if(link.length!==1||link[0].restaurant_id!==QA)throw new Error('numero non collegato solo al QA: mi fermo')
const tw=parseEnv(fs.readFileSync(path.join(cfg,'twilio-menu.env'),'utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function send(body){
 const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:phone,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body,TakoSyncTest:'1'},t0=performance.now()
 let raw='';try{const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString(),signal:AbortSignal.timeout(90000)});raw=await r.text()}catch(e){raw='[ERRORE RETE '+e.message+']'}
 const ms=Math.round(performance.now()-t0),reply=raw.replace(/<[^>]+>/g,' ').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()
 console.log('  >',body,`[${ms} ms]`,'\n    ',reply.slice(0,400));await sleep(2500);return {reply,ms}
}

// ---------- istantanea e differenze ----------
async function snap(){const [w]=await q(`SELECT published FROM menu_workspaces WHERE restaurant_id='${QA}'`);return w.published}
function flat(p){const items=new Map(),secs=new Map(),menus=new Map()
 for(const m of p.menus||[]){menus.set(m.id??m.name,{name:m.name,active:m.active??null,pricing:m.pricing??null,formulas:JSON.stringify((m.formulas||[]).map(f=>[f.name,f.price]))})
  for(const s of m.sections||[]){secs.set(s.id??(m.name+'/'+s.name),{name:s.name,menu:m.name,active:s.active??null,hidden:s.hidden??null})
   for(const i of s.items||[])items.set(i.id,{name:i.name,section:s.name,menu:m.name,price:i.price??null,available:i.available??true,hidden:!!i.hidden,promo:JSON.stringify(i.promo??null)})}}
 return {items,secs,menus}}
function diff(a,b){const A=flat(a),B=flat(b),out=[]
 for(const [id,x] of A.items){const y=B.items.get(id);if(!y){out.push({s:`-${x.name}|${x.section}|${x.menu}`,kind:'removed',x});continue}
  for(const f of ['name','section','menu','price','available','hidden','promo'])if(x[f]!==y[f])out.push({s:`${x.name}|${f}|${x[f]}→${y[f]}`,kind:'field',f,x,y})}
 for(const [id,y] of B.items)if(!A.items.has(id))out.push({s:`+${y.name}|${y.section}|${y.menu}|${y.price}`,kind:'added',y})
 for(const [id,x] of A.secs){const y=B.secs.get(id);if(!y){out.push({s:`-§${x.name}(${x.menu})`,kind:'secremoved',x});continue}for(const f of ['name','active','hidden'])if(x[f]!==y[f])out.push({s:`§${x.name}(${x.menu})|${f}|${x[f]}→${y[f]}`,kind:'sec',f,x,y})}
 for(const [id,y] of B.secs)if(!A.secs.has(id))out.push({s:`+§${y.name}(${y.menu})`,kind:'secadded',y})
 for(const [id,x] of A.menus){const y=B.menus.get(id);if(!y){out.push({s:`-M${x.name}`,kind:'menuremoved',x});continue}for(const f of ['name','active','pricing','formulas'])if(x[f]!==y[f])out.push({s:`M${x.name}|${f}|${x[f]}→${y[f]}`,kind:'menu',f,x,y})}
 for(const [id,y] of B.menus)if(!A.menus.has(id))out.push({s:`+M${y.name}`,kind:'menuadded',y})
 return out}
// expect = array di regex (stringhe): ogni regex deve trovare almeno una differenza e ogni differenza deve essere coperta
function checkDiff(d,expect){const ss=d.map(x=>x.s),res=expect.map(e=>new RegExp(e,'i'))
 const miss=res.filter(r=>!ss.some(s=>r.test(s))).map(String),extra=ss.filter(s=>!res.some(r=>r.test(s)))
 return miss.length||extra.length?`menu: mancano [${miss.join(', ')}] in più [${extra.join(', ')}]`:null}

// ---------- conversazioni ----------
// turno: {m, re:[regex che la risposta DEVE avere], no:[regex che NON deve avere], diff:[...] (stato atteso rispetto all'inizio della conv; omesso = non controllato)}
// restore: comandi finali per rimettere il QA (fanno parte della conversazione; anche loro controllati con diff:[])
const ASK=String.raw`\?|rispondi|dimmi`
// 22/10 notte (correzione Manuel «eliminare, non nascondere»): i 7 piatti del Menu del giorno del QA ELIMINATI, tranne quelli in `keep`
const GIORNO=['Lasagna','Carbonara','Gnocchi al ragù','Cotoletta','Polpette','Frittata di zucchine','Frittata di patate'],HIDE7=(keep=[])=>GIORNO.filter(n=>!keep.includes(n)).map(n=>'^-'+n+String.raw`\|`), NODONE=String.raw`\b(fatto|aggiornat|cambiat|pubblicat|messo|alzat|nascost)\w*`
const C=[
 {id:'annulla-domanda-aperta',desc:'«annulla» mentre il bot aspetta la risposta alla sua domanda (piatto nuovo senza dati): niente scritture, niente domanda ripetuta',
  t:[{m:'aggiungi il vitello tonnato',re:[ASK],diff:[]},{m:'annulla',literal:true,no:[String.raw`sottomenu.*\?|prezzo.*\?`],diff:[]}]},
 {id:'lettura-prezzo',desc:'«quanto costa il riso giallo?» → 8 €, nessuna scrittura',t:[{m:'quanto costa il riso giallo?',re:[String.raw`\b8\b`],diff:[]}]},
 {id:'pronome-alzalo',desc:'lettura poi «alzalo di un euro» → riso giallo 9 € subito (bug vivo v145)',
  t:[{m:'quanto costa il riso giallo?',re:[String.raw`\b8\b`],diff:[]},{m:'alzalo di un euro',re:[String.raw`\b9\b`],no:[String.raw`intendi|\?`],diff:[String.raw`^riso giallo\|price\|8→9$`]},{m:'annulla',diff:[]}]},
 {id:'pronome-mettila',desc:'lettura poi «mettila a 10» → pasta carbonara 10 €',
  t:[{m:'quanto costa la pasta carbonara?',re:[String.raw`\b9\b`],diff:[]},{m:'mettila a 10',re:[String.raw`\b10\b`],no:[String.raw`\?`],diff:[String.raw`^pasta carbonara\|price\|9→10$`]},{m:'annulla',diff:[]}]},
 {id:'pronome-toglila',desc:'lettura poi «toglila» → pasta al ragù ELIMINATA subito (22/10 notte); «annulla» → rimessa identica',
  t:[{m:'quanto costa la pasta al ragù?',re:[String.raw`\b10\b`],diff:[]},{m:'toglila',re:[String.raw`eliminat`],no:[String.raw`\?`,String.raw`nascost`],diff:[String.raw`^-pasta al ragù\|`]},{m:'annulla',diff:[]}]},
 {id:'pronome-finito',desc:'«c\'è il tiramisù?» → «è finito» → non disponibile; «è tornato» → disponibile',
  t:[{m:"c'è il tiramisù?",diff:[]},{m:'è finito',no:[String.raw`\?`],diff:[String.raw`^tiramisù\|available\|true→false$`]},{m:'è tornato',no:[String.raw`\?`],diff:[]}]},
 {id:'nuovo-solo-prezzo',desc:'«aggiungi le patatine fritte» → chiede sottomenu E prezzo insieme («le metto»); «4» tenuto, chiede solo il sottomenu; poi lo crea a 4 €',
  t:[{m:'aggiungi le patatine fritte',re:[String.raw`prezz|quanto`,String.raw`sottomenu`],no:[String.raw`\bla metto`],diff:[]},
     {m:'4',re:[String.raw`\b4\b`,String.raw`sottomenu`],no:[String.raw`prezz.*\?`],diff:[]},
     {m:'nei Piatti di prova',no:[String.raw`\?`],diff:[String.raw`^\+patatine fritte\|Piatti di prova\|Menu di verifica · web QA\|4$`]},{m:'annulla',diff:[]}]},
 {id:'nuovo-con-prezzo',desc:'«aggiungi patatine fritte a 4» → chiede solo il sottomenu → «nei Primi del Menu di verifica» → creato a 4 €',
  t:[{m:'aggiungi patatine fritte a 4',re:[String.raw`sottomenu`],no:[String.raw`prezz.*\?`],diff:[]},{m:'nei Primi del Menu di verifica',no:[String.raw`\?`],diff:[String.raw`^\+patatine fritte\|Primi\|Menu di verifica · web QA\|4$`]},{m:'annulla',diff:[]}]},
 {id:'nuovo-solo-sottomenu',desc:'«aggiungi il vitello tonnato nei Primi del Menu di verifica» → chiede il prezzo → «14» → creato a 14 €',
  t:[{m:'aggiungi il vitello tonnato nei Primi del Menu di verifica',re:[String.raw`prezz|quanto`],no:[String.raw`sottomenu.*\?`],diff:[]},{m:'14',no:[String.raw`\?`],diff:[String.raw`^\+vitello tonnato\|Primi\|Menu di verifica · web QA\|14$`]},{m:'annulla',diff:[]}]},
 {id:'si-a-domanda-a-scelta',desc:'«aggiungi patatine fritte a 4» → domanda sottomenu → «sì» → deve richiedere la scelta breve, mai il testo generico; «lascia stare» → niente',
  t:[{m:'aggiungi patatine fritte a 4',re:[String.raw`sottomenu`],diff:[]},{m:'sì',re:[String.raw`sottomenu|quale`],no:[String.raw`cosa vuoi cambiare`],diff:[]},{m:'lascia stare',diff:[]}]},
 {id:'tutti-e-due',desc:'lettura di due piatti → «alzali tutti e due di 50 centesimi» → riso 8,5 e carbonara 9,5',
  t:[{m:'quanto costano il riso giallo e la pasta carbonara?',re:[String.raw`\b8\b`,String.raw`\b9\b`],diff:[]},{m:'alzali tutti e due di 50 centesimi',no:[String.raw`\?`],diff:[String.raw`^riso giallo\|price\|8→8\.5$`,String.raw`^pasta carbonara\|price\|9→9\.5$`]},{m:'annulla',diff:[]}]},
 {id:'gruppo-menu-detto',desc:'«alza di 50 centesimi i primi del Menu di verifica» → i 4 primi +0,50 subito',
  t:[{m:'alza di 50 centesimi i primi del Menu di verifica',no:[String.raw`quale piatto|rispondi col numero`],diff:[String.raw`^la parmigiana\|price\|12\.5→13$`,String.raw`^pasta al pesto\|price\|9→9\.5$`,String.raw`^pasta carbonara\|price\|9→9\.5$`,String.raw`^riso giallo\|price\|8→8\.5$`]},{m:'annulla',diff:[]}]},
 {id:'gruppo-senza-menu',desc:'«alza di 50 centesimi i primi» → o i 4 primi del Menu di verifica (unico con prezzi) o una domanda sul Menu; mai i piatti del Menu del giorno',
  t:[{m:'alza di 50 centesimi i primi',no:[String.raw`quale piatto|rispondi col numero`]}],restoreIfChanged:['annulla']},
 {id:'prezzo-lettere-1',desc:'«il riso giallo a otto e cinquanta» → 8,50',t:[{m:'il riso giallo a otto e cinquanta',no:[String.raw`\?`],diff:[String.raw`^riso giallo\|price\|8→8\.5$`]},{m:'annulla',diff:[]}]},
 {id:'prezzo-lettere-2',desc:'«la pasta al sugo a dieci euro e mezzo» → 10,50',t:[{m:'la pasta al sugo a dieci euro e mezzo',no:[String.raw`\?`],diff:[String.raw`^Pasta al sugo\|price\|9→10\.5$`]},{m:'annulla',diff:[]}]},
 {id:'nascondi-elimina',desc:'(22/10 notte) «nascondi il riso giallo» = togli → ELIMINATO, mai nascosto; «annulla» → identico',t:[{m:'nascondi il riso giallo',re:[String.raw`eliminat`],no:[String.raw`\?`,String.raw`nascost`],diff:[String.raw`^-riso giallo\|`]},{m:'annulla',diff:[]}]},
 {id:'togli-elimina',desc:'(22/10 notte) «togli la pasta al pesto e lasagna» → eliminata subito con «annulla»; «annulla» → identica',t:[{m:'togli la pasta al pesto e lasagna',re:[String.raw`eliminat`,String.raw`annulla`],no:[String.raw`\?`,String.raw`nascost`],diff:[String.raw`^-Pasta al pesto e lasagna\|`]},{m:'annulla',diff:[]}]},
 {id:'sostituzione-eliminati',desc:'(22/10 notte) «nel menu del giorno secondi cotoletta e polpette» → le due frittate ELIMINATE, risposta «Eliminati: …»; annulla',t:[{m:'nel menu del giorno secondi cotoletta e polpette',re:[String.raw`Eliminati: .*Frittata`],no:[ASK,String.raw`nascost`],diff:[String.raw`^-Frittata di zucchine\|`,String.raw`^-Frittata di patate\|`]},{m:'annulla',diff:[]}]},
 {id:'finito-tornato',desc:'«la pasta al sugo è finita» → non disponibile; «la pasta al sugo è tornata» → disponibile',t:[{m:'la pasta al sugo è finita',no:[String.raw`\?`],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},{m:'la pasta al sugo è tornata',no:[String.raw`\?`],diff:[]}]},
 {id:'elimina-poi-annulla',desc:'«elimina la pasta al sugo» → chiede il sì, niente scritto → «annulla» → scarta, niente scritto',t:[{m:'elimina la pasta al sugo',re:[String.raw`sì|si\b`],diff:[]},{m:'annulla',literal:true,diff:[]}]},
 {id:'vietato-tutto-zero',desc:'«metti tutto a zero» → deve chiedere conferma (OK/sì) senza scrivere → «no» → niente',t:[{m:'metti tutto a zero',re:[ASK],no:[NODONE],diff:[]},{m:'no',diff:[]}]},
 // QA v153 22/10 (GRAVE): una modifica, poi una domanda a opzioni numerate che nomina lo stesso piatto, poi «no» → il bot annullava la
 // modifica («*Pasta al sugo*: com’era prima»). Il «no» chiude la domanda: il QA resta com'è dopo la modifica; poi si rimette a mano.
 {id:'modifica-domanda-no',desc:'«la pasta al sugo è finita» → esaurita; «elimina tutti i primi» → domanda senza scrivere; «no» → NON annulla l\'esaurita',
  t:[{m:'la pasta al sugo è finita',no:[String.raw`\?`],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'elimina tutti i primi',re:[ASK],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'no',no:[String.raw`com.era prima`],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'la pasta al sugo è tornata',no:[String.raw`\?`],diff:[]}]},
 {id:'modifica-domanda-no-paste',desc:'come sopra con «elimina tutte le paste» (domanda che nomina di sicuro la Pasta al sugo) → «no» → NON annulla',
  t:[{m:'la pasta al sugo è finita',no:[String.raw`\?`],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'elimina tutte le paste',re:[ASK],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'no',no:[String.raw`com.era prima`],diff:[String.raw`^Pasta al sugo\|available\|true→false$`]},
     {m:'la pasta al sugo è tornata',no:[String.raw`\?`],diff:[]}]},
 {id:'vietato-elimina-primi',desc:'«elimina tutti i primi» → chiede il sì senza scrivere → «no» → niente',t:[{m:'elimina tutti i primi',re:[ASK],diff:[]},{m:'no',diff:[]}]},
 {id:'riepilogo-pollice',desc:'4 prezzi in un messaggio → aspetta l\'OK senza scrivere → «👍» pubblica tutti e 4 → «annulla» li toglie',
  t:[{m:'riso giallo a 9, pasta carbonara a 10, pasta al sugo a 10, tiramisù a 16',re:[String.raw`\bok\b`],diff:[]},
     {m:'👍',no:[String.raw`\?`],diff:[String.raw`^riso giallo\|price\|8→9$`,String.raw`^pasta carbonara\|price\|9→10$`,String.raw`^Pasta al sugo\|price\|9→10$`,String.raw`^tiramisù\|price\|15→16$`]},{m:'annulla',diff:[]}]},
 {id:'ambiguo-pesto-ok',desc:'«alza il pesto di un euro» (pasta al pesto / Pasta al pesto e lasagna) → domanda → «la pasta al pesto dei primi» → 10 €',
  t:[{m:'alza il pesto di un euro',re:[ASK],diff:[]},{m:'la pasta al pesto dei primi',no:[String.raw`\?`],diff:[String.raw`^pasta al pesto\|price\|9→10$`]},{m:'annulla',diff:[]}],restoreIfChanged:['annulla']},
 {id:'lettura-primi',desc:'«cosa c\'è nei primi?» → elenca i primi del Menu di verifica (riso giallo, carbonara…)',t:[{m:"cosa c'è nei primi?",re:[String.raw`riso giallo`,String.raw`carbonara`],diff:[]}]},
 {id:'lettura-paste-primi',desc:'«quante paste ho nei primi?» → solo pasta al pesto e pasta carbonara (non pasta al ragù/sugo di Piatti di prova)',t:[{m:'quante paste ho nei primi?',re:[String.raw`pesto`,String.raw`carbonara`],no:[String.raw`ragù|sugo|gnocchi`],diff:[]}]},
 {id:'prezzo-insolito-no',desc:'«il riso giallo a 80» → aspetta l\'OK senza scrivere → «no» → niente',t:[{m:'il riso giallo a 80',re:[ASK],no:[NODONE],diff:[]},{m:'no',diff:[]}]},
 {id:'anzi-rimettilo',desc:'«il riso giallo a 9» → 9 € → «anzi rimettilo a 8» → 8 €',t:[{m:'il riso giallo a 9',no:[String.raw`\?`],diff:[String.raw`^riso giallo\|price\|8→9$`]},{m:'anzi rimettilo a 8',no:[String.raw`\?`],diff:[]}]},
 // 22/10 sera — REGOLA D'USO (decisione Manuel dopo Victoria): «svuota il menu X» = piatti nascosti, sottomenu e prezzi fissi intatti, subito;
 // «nei primi inserisci A, B» = visibili/creati nel Menu di cui si parla, gli altri non si toccano. Menu del giorno del QA (prezzo fisso).
 {id:'svuota-annulla',desc:'«svuota il menu del giorno» → i 7 piatti ELIMINATI subito, nessuna domanda → «annulla» → com’era (identico)',
  t:[{m:'svuota il menu del giorno',re:[String.raw`svuotat`,String.raw`Ho eliminato`,String.raw`annulla`],no:[ASK,String.raw`nascost`],diff:HIDE7()},{m:'annulla',diff:[]}]},
 {id:'svuota-inserisci-un-messaggio',desc:'«svuota il menu del giorno e nei primi inserisci carbonara e gnocchi al ragù» → solo loro visibili → annulla',
  t:[{m:'svuota il menu del giorno e nei primi inserisci carbonara e gnocchi al ragù',re:[String.raw`Carbonara`,String.raw`Gnocchi`],no:[ASK],diff:HIDE7(['Carbonara','Gnocchi al ragù'])},{m:'annulla',diff:[]}]},
 {id:'inserisci-contesto',desc:'(22/10 notte) Menu dalla conversazione: «nel menu del giorno nei primi inserisci la pasta e fagioli» → «nei secondi metti la tagliata» → nuova nei Secondi del Menu del giorno; annulla toglie la tagliata; «elimina la pasta e fagioli» + «sì» la toglie',
  t:[{m:'nel menu del giorno nei primi inserisci la pasta e fagioli',re:[String.raw`Pasta e fagioli`],no:[ASK],diff:[String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`]},{m:'nei secondi metti la tagliata',re:[String.raw`Tagliata`],no:[ASK],diff:[String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`,String.raw`^\+Tagliata\|Secondi\|Menu del giorno\|0$`]},
     {m:'annulla',diff:[String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`]},{m:'elimina la pasta e fagioli dal menu del giorno',re:[ASK],diff:[String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`]},{m:'sì',diff:[]}]},
 {id:'inserisci-nuovo-annulla',desc:'«nel menu del giorno nei primi inserisci la pasta e fagioli» → nuova senza prezzo, gli altri restano visibili → annulla la toglie',
  t:[{m:'nel menu del giorno nei primi inserisci la pasta e fagioli',re:[String.raw`Pasta e fagioli`],no:[ASK],diff:[String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`]},{m:'annulla',diff:[]}]},
 {id:'elimina-menu-no',desc:'(correzione Manuel) «elimina il menu del giorno» = eliminare il Menu: chiede il sì senza scrivere → «no» → niente',
  t:[{m:'elimina il menu del giorno',re:[String.raw`Elimino il .*intero\?`,String.raw`sì`],diff:[]},{m:'no',no:[String.raw`eliminat`],diff:[]}]},
 {id:'piatti-del-menu-svuota',desc:'«togli tutti i piatti del menu del giorno» = svuotamento (sottomenu restano), nessuna domanda → annulla',
  t:[{m:'togli tutti i piatti del menu del giorno',no:[ASK],diff:HIDE7()},{m:'annulla',diff:[]}]},
 {id:'grave-b7-nascondi-tutti',desc:'(Victoria B7, GRAVE) «il menù del giorno si deve vedere ma devi nascondere tutti i piatti» → tutti nascosti subito (prima: elenco di 5 e «tutti» parziale)',
  t:[{m:'il menù del giorno si deve vedere ma devi nascondere tutti i piatti',no:[ASK],diff:HIDE7()},{m:'annulla',diff:[]}]},
 {id:'grave-k2-pasta-e-fagioli',desc:'(K2, GRAVE) «nel menu del giorno primi carbonara e pasta e fagioli» → Carbonara + Pasta e fagioli (nuova), Lasagna e Gnocchi nascosti → annulla',
  t:[{m:'nel menu del giorno primi carbonara e pasta e fagioli',re:[String.raw`Pasta e fagioli`,String.raw`Eliminati`],no:[ASK,String.raw`nascost`],diff:[String.raw`^-Lasagna\|`,String.raw`^-Gnocchi al ragù\|`,String.raw`^\+Pasta e fagioli\|Primi\|Menu del giorno\|0$`]},{m:'annulla',diff:[]}]},
 {id:'ok-a-domanda',desc:'«togli la carbonara» (pasta carbonara / Carbonara del Menu del giorno spento) → elimina la pasta carbonara o chiede; mai «nascosto»',
  t:[{m:'togli la carbonara',no:[String.raw`nascost`]}],restoreIfChanged:['annulla']},
]

// ---------- ripristino automatico con comandi inversi al bot ----------
const fmt=n=>String(n).replace('.',',')
function inverse(d){const cmds=[]
 for(const x of d){const n=x.x?.name??x.y?.name,where=x.x?` (${x.x.section} del ${x.x.menu})`:''
  if(x.kind==='field'&&x.f==='price'&&x.x.price!=null)cmds.push([`${n}${where} a ${fmt(x.x.price)} euro`])
  else if(x.kind==='field'&&x.f==='available')cmds.push([x.x.available?`${n}${where} è di nuovo disponibile`:`${n}${where} è finito`])
  else if(x.kind==='field'&&x.f==='hidden')cmds.push([x.x.hidden?`nascondi ${n}${where}`:`mostra ${n}${where}`])
  else if(x.kind==='added')cmds.push([`elimina ${n} (${x.y.section} del ${x.y.menu})`,'sì'])
  // 22/10 notte: un piatto eliminato non si rimette coi comandi (solo «annulla» entro 10 minuti): non ripristinabile qui
  else cmds.push(null)}
 return cmds}
async function restore(base){for(let round=1;round<=2;round++){const d=diff(base,await snap());if(!d.length)return true
  console.log(`  !! QA diverso (giro ${round}):`,d.map(x=>x.s).join(' ; '));const inv=inverse(d)
  if(inv.some(c=>!c)){console.log('  !! differenza non ripristinabile coi comandi inversi');return false}
  for(const c of inv)for(const m of c){const {reply}=await send(m);if(/rispondi\s+ok/i.test(reply))await send('OK');else if(/rispondi\s+s[iì]/i.test(reply)&&m!=='sì')await send('sì')}}
 return !diff(base,await snap()).length}

// ---------- lock ----------
const LOCK=path.join(HERE,'QA.lock');{const t0=Date.now();while(fs.existsSync(LOCK)){if(Date.now()-t0>15*60e3)throw new Error('QA.lock occupato da oltre 15 min');console.log('lock occupato, aspetto…');await sleep(10000)}}
fs.writeFileSync(LOCK,`qa-live-batteria ${process.pid} ${new Date().toISOString()}\n`);const unlock=()=>{try{fs.unlinkSync(LOCK)}catch{}};process.on('exit',unlock);process.on('SIGINT',()=>{unlock();process.exit(130)})

const START=await snap();fs.writeFileSync(path.join(HERE,`qa-live-start-${TAG}.json`),JSON.stringify(START))
const results=[];let stopped=null
for(const c of C){if(ONLY&&!ONLY.includes(c.id))continue
 console.log(`\n=== ${c.id} — ${c.desc}`);const base=await snap(),pre=diff(START,base);if(pre.length){stopped='QA non identico all\'inizio prima di '+c.id;break}
 const r={id:c.id,desc:c.desc,turns:[],fails:[]}
 for(const [k,t0] of c.t.entries()){let t=t0
  // «annulla» di ripristino solo se la conversazione ha davvero scritto: altrimenti annullerebbe la pubblicazione PRECEDENTE (es. un ripristino)
  if(t.m==='annulla'&&!t.literal&&!diff(base,await snap()).length)t={...t,m:'lascia stare'}
  const {reply,ms}=await send(t.m),tr={m:t.m,reply,ms,fails:[]}
  for(const e of t.re||[])if(!new RegExp(e,'i').test(reply))tr.fails.push(`risposta senza /${e}/`)
  for(const e of t.no||[])if(new RegExp(e,'i').test(reply))tr.fails.push(`risposta con /${e}/`)
  if(t.diff){const d=diff(base,await snap()),err=checkDiff(d,t.diff);if(err)tr.fails.push(err)}
  if(ms>20000)tr.fails.push(`lenta ${ms} ms`)
  r.turns.push(tr);for(const f of tr.fails)r.fails.push(`t${k+1} «${t.m}»: ${f}`)}
 if(c.restoreIfChanged&&diff(base,await snap()).length&&!r.turns.some(x=>x.m==='annulla'))for(const m of c.restoreIfChanged){const {reply}=await send(m);r.turns.push({m,reply,restore:true})}
 const left=diff(base,await snap());r.leftover=left.map(x=>x.s)
 if(left.length){r.fails.push('QA non tornato com\'era: '+r.leftover.join(' ; '));const ok=await restore(base);r.restored=ok;if(!ok){results.push(r);stopped='ripristino fallito dopo '+c.id;break}}
 r.ok=!r.fails.length;results.push(r);console.log(r.ok?'  OK':'  KO: '+r.fails.join(' | '))}
const END=await snap(),finalDiff=diff(START,END).map(x=>x.s)
const out={tag:TAG,at:new Date().toISOString(),stopped,finalDiff,ok:results.filter(r=>r.ok).length,total:results.length,results}
fs.writeFileSync(path.join(HERE,`qa-live-${TAG}.json`),JSON.stringify(out,null,1))
console.log(`\n== ${out.ok}/${out.total} OK${stopped?' — FERMATA: '+stopped:''} — diff finale QA: ${finalDiff.length?finalDiff.join(' ; '):'VUOTO (identico)'}`)
unlock()
