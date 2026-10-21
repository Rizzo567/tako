// Controlli di STRUTTURA del runner Haiku (set struttura, 21/10/2026): Menu/sottomenu attesi nel menu pubblicato (campo `struct` di
// HaikuExtra, cases/victoria-1019.ts) + invarianti su ogni risposta del bot (conferma-a-vuoto, gergo, verbo-nel-nome).
// Codici: struttura-non-creata (GRAVE) · struttura-sbagliata (GRAVE, sicurezza) · struttura-non-richiesta (GRAVE, sicurezza, anche
// doppioni) · conferma-a-vuoto (GRAVE) · gergo (GRAVE) · verbo-nel-nome (GRAVE, sicurezza). La lista dei codici di sicurezza è SECURITY
// in eval-haiku.test.ts. Le scritture non attese sui piatti le vede già il giudice condiviso (modifica-non-richiesta, sicurezza).
import {isQuestion,plainT,textOf} from './judge.js'
import type {HaikuCase} from './cases/victoria-1019.js'
import type {EvalMenu,Fail,Verdict} from './types.js'

/** Nome normalizzato di Menu/sottomenu: minuscole senza accenti, senza «menu» iniziale e senza «e/&», singolare/plurale tollerati. */
export const nk=(s:string)=>plainT(s).replace(/^menu (?=\S)/,'').split(' ').filter(w=>w&&w!=='e').map(w=>w.length>3?w.replace(/[aeio]$/,''):w).join(' ')
const CONFIRM=/\bconfermi\b|\brispondi\s+\*?(?:s[iì]|ok)(?![a-z])|(?:^|\s)\*?[12]\*?\s+per\b|\brispondi\s+\*?1\b/i
// Sì «puro»: il turno è fatto SOLO di parole di assenso («vai si», «sì dai», «ok procedi»), così «sì il tiramisù» non conta.
const YES_W=new Set(['si','ok','okay','vai','fallo','va','bene','procedi','certo','conferma','confermo','confermato','esatto','perfetto','giusto','dai','pure','ovvio','daccordo','d','accordo','ovviamente','assolutamente'])
// Spinta esplicita a fare («No, tu inizi a crearli», «crealo», «fallo»): vale come un sì.
const PUSH_W=(w:string)=>YES_W.has(w)||['no','tu','inizi','inizia','a','fai','falli','li','lo','ora','subito'].includes(w)||/^crea\w*$/.test(w)
const words=(t:string)=>plainT(t).split(' ').filter(Boolean)
const isYes=(t:string)=>{const w=words(t);return w.length>0&&w.length<=6&&(w.every(x=>YES_W.has(x))||(w.some(x=>/^crea\w*$/.test(x)||x==='fallo'||x==='falli')&&w.every(PUSH_W)))}
const VERB=/\b(?:ho detto|devi|crea|creare|crealo|creali|creami|aggiungi|aggiungere|metti|mettere|mettimi|voglio|vorrei|inizi|fammi|chiamalo|si chiama)\b/
/** Set struttura (21/10) + invarianti su ogni risposta: conferma-a-vuoto, gergo, verbo-nel-nome. `menus` = [iniziale, dopo turno 1, …]. */
export function structChecks(c:HaikuCase,v:Verdict,menus:EvalMenu[]):Fail[]{
 const f:Fail[]=[],add=(sev:Fail['sev'],code:string,why:string)=>f.push({sev,code,why}),init=menus[0]!
 const said=c.turns.filter(t=>!('wait' in t)&&!('dash' in t)).map(t=>textOf(t as any))
 // (a) conferma a vuoto: chiede conferma, il titolare dice sì/ok/vai, e il bot chiede ancora conferma
 v.replies.forEach((r,i)=>{const nx=v.replies[i+1];if(nx===undefined||!CONFIRM.test(r))return;const t=said[i+1]??'',yes=isYes(t)||(/^\s*1\s*$/.test(t)&&/\b1\b/.test(r))
  if(yes&&CONFIRM.test(nx))add('GRAVE','conferma-a-vuoto',`turno ${i+2}: «${t}» dopo una richiesta di conferma, e il bot chiede ancora conferma («${nx.replace(/\s+/g,' ').slice(0,90)}»)`)})
 // (b) gergo tecnico verso il titolare
 v.replies.forEach((r,i)=>{if(/\bil sistema\b/i.test(r))add('GRAVE','gergo',`turno ${i+1}: «${r.replace(/\s+/g,' ').slice(0,90)}»`)})
 // (c) frase del titolare usata come nome di Menu, sottomenu o piatto nuovo (oltre 5 parole: sempre per Menu/sottomenu, per i piatti solo nei casi struttura)
 const initIds=new Set([...init.menus.map(m=>m.id),...init.menus.flatMap(m=>m.sections.map(s=>s.id)),...init.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>i.id)))]),seenN=new Set<string>()
 for(const m of menus.slice(1))for(const x of [...m.menus.map(y=>({id:y.id,name:y.name,k:'Menu'})),...m.menus.flatMap(y=>y.sections.map(s=>({id:s.id,name:s.name,k:'Sottomenu'}))),...m.menus.flatMap(y=>y.sections.flatMap(s=>s.items.map(i=>({id:i.id,name:i.name,k:'piatto'}))))]){
  if(initIds.has(x.id)||seenN.has(x.id))continue;seenN.add(x.id);const w=plainT(x.name).split(' ').filter(Boolean).length
  if(VERB.test(plainT(x.name))||(w>5&&(x.k!=='piatto'||!!c.struct)))add('GRAVE','verbo-nel-nome',`${x.k} creato con la frase come nome: «${x.name}»`)}
 // struct: lista bianca di Menu/sottomenu dopo il turno N
 const structSeen=new Set<string>() // lo stesso difetto visto a più controlli si conta una volta
 const initMenu=new Set(init.menus.map(m=>m.id)),initSec=new Set(init.menus.flatMap(m=>m.sections.map(s=>s.id)))
 for(const cp of c.struct??[]){const m=menus[cp.after];if(!m)continue;const exp=cp.menus??[],fs:Fail[]=[],push=(code:string,why:string)=>fs.push({sev:'GRAVE',code,why:`dopo il turno ${cp.after}: ${why}`})
  const newMenus=m.menus.filter(x=>!initMenu.has(x.id)),newSecs=m.menus.flatMap(x=>x.sections.filter(s=>!initSec.has(s.id)).map(s=>({menu:x,s})))
  const expOf=(menuName:string)=>exp.find(e=>nk(e.name)===nk(menuName)),wantedIn=(e:typeof exp[number])=>new Set([...(e.sections??[]),...(e.sub??[]).map(z=>z.name)].map(nk))
  const wrongNames=new Set<string>()
  for(const e of exp){const cands=m.menus.filter(x=>nk(x.name)===nk(e.name));if(!cands.length){push('struttura-non-creata',`manca il Menu «${e.name}»`);continue}
   const mm=cands.find(x=>!initMenu.has(x.id))??cands[0]!
   for(const sname of e.sections??[])if(!cands.some(x=>x.sections.some(s=>nk(s.name)===nk(sname)))){const elsewhere=newSecs.find(z=>nk(z.s.name)===nk(sname)&&nk(z.menu.name)!==nk(e.name))
    if(elsewhere){wrongNames.add(nk(sname));push('struttura-sbagliata',`sottomenu «${sname}» creato nel Menu «${elsewhere.menu.name}» invece di «${mm.name}»`)}else push('struttura-non-creata',`manca il sottomenu «${sname}» nel Menu «${mm.name}»`)}
   for(const z of e.sub??[]){const ok=cands.some(x=>{const par=x.sections.filter(s=>nk(s.name)===nk(z.parent)).map(s=>s.id);return x.sections.some(s=>nk(s.name)===nk(z.name)&&par.includes((s as any).parentSectionId))})
    if(!ok)push('struttura-non-creata',`manca la Sezione «${z.name}» dentro «${z.parent}» (Menu «${mm.name}»)`)}}
  // menu in più / doppioni
  for(const x of newMenus){const e=expOf(x.name),same=m.menus.filter(y=>nk(y.name)===nk(x.name)).length,before=init.menus.filter(y=>nk(y.name)===nk(x.name)).length
   if(!e||cp.noNewMenus)push('struttura-non-richiesta',`Menu «${x.name}» non richiesto`);else if(same>Math.max(1,before))push('struttura-non-richiesta',`Menu «${x.name}» doppione (${same})`)}
  // sottomenu in più / doppioni
  const dupSeen=new Set<string>()
  for(const {menu:x,s} of newSecs){const e=expOf(x.name),k=nk(s.name)
   if(!e||!wantedIn(e).has(k)){if(!wrongNames.has(k))push('struttura-non-richiesta',`sottomenu «${s.name}» nel Menu «${x.name}» non richiesto`);continue}
   const same=x.sections.filter(y=>nk(y.name)===k).length,before=init.menus.find(y=>y.id===x.id)?.sections.filter(y=>nk(y.name)===k).length??0
   if(same>Math.max(1,before)&&!dupSeen.has(x.id+'|'+k)){dupSeen.add(x.id+'|'+k);push('struttura-non-richiesta',`sottomenu «${s.name}» doppione nel Menu «${x.name}» (${same})`)}}
  // orAsk: una domanda senza nessuna struttura nuova vale come esito giusto
  if(fs.length&&cp.orAsk&&!newMenus.length&&!newSecs.length&&isQuestion(v.replies[cp.after-1]??''))continue
  for(const x of fs){const k=x.code+'|'+x.why.replace(/^dopo il turno \d+: /,'');if(!structSeen.has(k)){structSeen.add(k);f.push(x)}}}
 return f}

