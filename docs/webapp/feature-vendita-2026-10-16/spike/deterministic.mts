// Spike 3b DETERMINISTICO (nessuna rete, nessun LLM, nessun whisper). Contrordine del coordinatore, 16/10.
// Trascrizioni «stile whisper» scritte a mano (minuscole, niente punteggiatura, prezzi in lettere/misti).
// Il modello è SIMULATO ideale (restituisce righe giuste con evidenza esatta): si misura il tetto del resto
// della pipeline = cancello verifyOnboardingMenuRow (prezzo letterale, categoria letterale), con e senza
// il pre-normalizzatore dei prezzi parlati. L'LLM reale può solo fare peggio: 8/10 reali DA RIFARE con LLM e whisper reali.
import {verifyOnboardingMenuRow} from '../../../../apps/server/src/lib/onboarding-planner.ts'
import {normalizeSpokenPrices} from './spoken-prices.mts'
type Seg={t:string,d?:{name:string,price:number,cat?:string}}  // cat = categoria detta nel testo (il modello la copia); assente = implicita
const D=(t:string,name:string,price:number,cat?:string):Seg=>({t,d:{name,price,cat}})
const X=(t:string):Seg=>({t})
const vocals:Record<string,Seg[]>={
 'W1-euro-in-lettere':[X('menu di oggi primi '),D('carbonara dieci euro','carbonara',10,'primi'),X(' '),D('amatriciana nove euro','amatriciana',9,'primi'),X(' '),D('risotto ai funghi dodici euro','risotto ai funghi',12,'primi'),X(' secondi '),D('tagliata sedici euro','tagliata',16,'secondi'),X(' '),D('saltimbocca quindici euro','saltimbocca',15,'secondi'),X(' dolci '),D('tiramisù cinque euro','tiramisù',5,'dolci'),X(' '),D('panna cotta quattro euro e cinquanta','panna cotta',4.5,'dolci'),X(' '),D('caffè un euro','caffè',1,'dolci'),X(' '),D('sorbetto al limone tre euro e cinquanta','sorbetto al limone',3.5,'dolci'),X(' '),D('torta della nonna sei euro','torta della nonna',6,'dolci')],
 'W2-senza-euro-e-cinquanta':[X('allora menu di lunedì antipasti '),D('bruschetta cinque','bruschetta',5,'antipasti'),X(' '),D('tagliere dodici e cinquanta','tagliere',12.5,'antipasti'),X(' primi '),D('spaghetti alle vongole quattordici','spaghetti alle vongole',14,'primi'),X(' '),D('penne all arrabbiata otto e cinquanta','penne all arrabbiata',8.5,'primi'),X(' '),D('lasagna undici','lasagna',11,'primi'),X(' secondi '),D('tagliata diciotto','tagliata',18,'secondi'),X(' '),D('cotoletta quindici','cotoletta',15,'secondi'),X(' dolci '),D('tiramisù cinque','tiramisù',5,'dolci'),X(' '),D('panna cotta cinque e cinquanta','panna cotta',5.5,'dolci')],
 'W3-cifre-miste-e-categorie-implicite':[X('oggi abbiamo '),D('risotto ai funghi 12 euro','risotto ai funghi',12),X(' '),D('gnocchi al gorgonzola undici euro','gnocchi al gorgonzola',11),X(' poi come secondo '),D('branzino al forno 19 euro','branzino al forno',19,'secondo'),X(' e '),D('polpette al sugo tredici euro','polpette al sugo',13,'secondo'),X(' contorno '),D('patate al forno 4 euro','patate al forno',4,'contorno'),X(' per finire '),D('cheesecake sei euro','cheesecake',6),X(' e '),D('sorbetto al limone 3 euro e 50','sorbetto al limone',3.5),X(' '),D('pizza quattro formaggi dodici','pizza quattro formaggi',12)],
}
const run=(norm:boolean|'post')=>{
 const out:any[]=[];let ok=0,total=0,catOk=0,catExplicit=0
 for(const [id,segs] of Object.entries(vocals)){
  const f=(s:string)=>norm===true?normalizeSpokenPrices(s):s
  let source=f(segs.map(s=>s.t).join('')),res:any[]=[]
  let prefix=''
  for(const s of segs){const before=prefix;prefix+=s.t;if(!s.d)continue;total++
   let evidence=f(prefix).slice(f(before).length)
   // 'post': il modello cita l'evidenza grezza; il server normalizza SOLO la citazione e la riscrive nel testo sorgente prima del controllo
   if(norm==='post'){const norm_=normalizeSpokenPrices(s.t);source=source.replace(s.t,norm_);evidence=norm_}
   const row={section:s.d.cat??'Menu',name:s.d.name,price:s.d.price,description:'',evidence}
   const v=verifyOnboardingMenuRow(row as any,source),accepted=!!v.row&&source.toLowerCase().includes(evidence.toLowerCase())
   if(accepted)ok++;if(accepted&&s.d.cat){catExplicit++;if(v.row!.section.toLowerCase()===s.d.cat)catOk++}
   res.push({dish:s.d.name,expected:s.d.price,accepted,section:v.row?.section??null,issue:v.issue??null})}
  out.push({id,accepted:res.filter(r=>r.accepted).length,of:res.length,rejected:res.filter(r=>!r.accepted)})}
 return{ok,total,per10:Math.round(ok/total*100)/10,catOk,catExplicit,out}
}
const strip=(r:any)=>({ok:r.ok,total:r.total,per10:r.per10,categorieEsplicite:`${r.catOk}/${r.catExplicit}`,perVocale:r.out.map((o:any)=>`${o.id}: ${o.accepted}/${o.of}`),scartati:r.out.flatMap((o:any)=>o.rejected.map((x:any)=>o.id.slice(0,2)+' '+x.dish+' -> '+(x.issue||'')))})
console.log(JSON.stringify({senzaNormalizzatore:strip(run(false)),normalizzaTuttoIlTesto:strip(run(true)),normalizzaSoloLeCitazioni:strip(run('post'))},null,1))
