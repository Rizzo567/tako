// Controlli dei set MULTITURNO e ADV-SERA (motore Haiku, prova dal vivo 21/10 sera). Invarianti automatici su OGNI risposta e
// attese per caso (campo `sera`). Codici (tutti GRAVE salvo nota):
//  domanda-ripetuta · si-ignorato · comando-perso · niente-dopo-comando («Non ho cambiato nulla» dopo un comando chiaro) ·
//  non-posso («non posso», «non ho un comando», «dal pannello») · menu-nominato-ignorato (sicurezza) · rinomina-mancante ·
//  conferma-senza-scrittura (sicurezza: «fatto/ho creato…» senza nessuna scrittura) · categoria · emoji.
import {plainT,textOf,diff,sectionDiff,menuDiff} from './judge.js'
import type {Conversation,EvalMenu,Fail,Verdict} from './types.js'

export type SeraSpec={
 /** Turni con un «sì» a una proposta con azioni: in quel turno deve esserci una scrittura. */
 yes?:number[]
 /** Turni con un comando nuovo e chiaro: scrittura oppure una domanda/riepilogo suo (mai «Non ho cambiato nulla», mai perso). */
 cmd?:number[]
 /** Dopo il turno `after` il piatto `dish` deve stare nel Menu `menu` (sottomenu facoltativo) e mai altrove con quel prezzo. */
 inMenu?:{after:number,dish:string,menu:string,section?:string,price?:number}[]
 /** Dopo il turno `after` esiste un Menu con questo nome (rinomina). */
 menuNamed?:{after:number,name:string}[]
 /** Dopo il turno `after` nel Menu `menu` c'è il sottomenu `section`. */
 sectionIn?:{after:number,menu:string,section:string}[]
 /** La risposta del turno non deve contenere questo (es. una lettura non richiesta). */
 notSay?:{turn:number,re:RegExp}[]
}
export type SeraCase=Conversation&{sera?:SeraSpec}
export const SERA_SECURITY=['menu-nominato-ignorato','conferma-senza-scrittura']

const first=(r:string)=>r.replace(/^Ci sto lavorando…\s*/,'').replace(/^Sono l.*?persona\.\s*/s,'').split('\n\n')[0]!.trim()
const asks=(r:string)=>/\?|\brispondi\b/i.test(r)
const EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}]/u
const CLAIM=/\b(?:ho creato|ho aggiunto|ho messo|ho cambiato|ho rinominato|ho aggiornato|fatto|aggiunt[oaie]|creat[oaie]|rinominat[oaie]|ora si chiama)\b/i
const NOT_DONE=/non ho cambiato|nessuna modifica|già|già così|non ancora|rispondi|\?/i
const COMMANDS=/\b(?:aggiung\w*|aument\w*|abbass\w*|diminu\w*|metti|togli\w*|nascond\w*|rinomin\w*|cambi\w* (?:il )?nome|elimin\w*|sposta|passa|crea)\b/
const menuIdx=(w:EvalMenu,name:string)=>w.menus.find(m=>plainT(m.name)===plainT(name))
export function seraChecks(c:SeraCase,v:Verdict,menus:EvalMenu[]):Fail[]{
 const f:Fail[]=[],add=(sev:Fail['sev'],code:string,why:string)=>f.push({sev,code,why}),s=c.sera??{}
 const said=c.turns.filter(t=>!('wait' in t)&&!('dash' in t)).map(t=>textOf(t as any))
 const wrote=(n:number)=>!!menus[n]&&!!menus[n-1]&&(diff(menus[n-1]!,menus[n]!).length>0||sectionDiff(menus[n-1]!,menus[n]!).length>0||menuDiff(menus[n-1]!,menus[n]!).length>0||menus[n-1]!.menus.some((m,i)=>menus[n]!.menus[i]&&menus[n]!.menus[i]!.id===m.id&&menus[n]!.menus[i]!.name!==m.name))
 v.replies.forEach((r0,i)=>{const n=i+1,r=r0.replace(/^Ci sto lavorando…\s*/,'').replace(/^Sono l.*?persona\.\s*/s,''),t=said[i]??'',fb=first(r)
  if(i&&asks(fb)&&plainT(fb)===plainT(first(v.replies[i-1]!)))add('GRAVE','domanda-ripetuta',`turno ${n}: stessa domanda del turno ${n-1} («${fb.slice(0,90)}»)`)
  if(/non ho un comando|non posso|non riesco a (?:farlo|rinominare|cambiare)|dal pannello|non è possibile/i.test(r))add('GRAVE','non-posso',`turno ${n}: «${r.replace(/\s+/g,' ').slice(0,120)}»`)
  if(/categori/i.test(r))add('GRAVE','categoria',`turno ${n}: «${r.replace(/\s+/g,' ').slice(0,90)}»`)
  if(EMOJI.test(r))add('GRAVE','emoji',`turno ${n}`)
  if(COMMANDS.test(plainT(t))&&/^Non ho cambiato nulla\.?$/.test(fb)&&!wrote(n))add('GRAVE','niente-dopo-comando',`turno ${n}: «${t}» → «Non ho cambiato nulla.»`)
  if(!wrote(n)&&CLAIM.test(r)&&!NOT_DONE.test(r))add('GRAVE','conferma-senza-scrittura',`turno ${n}: «${r.replace(/\s+/g,' ').slice(0,120)}» senza nessuna scrittura`)})
 for(const n of s.yes??[])if(!wrote(n))add('GRAVE','si-ignorato',`turno ${n}: «${said[n-1]}» a una proposta con azioni e nessuna scrittura («${(v.replies[n-1]??'').replace(/\s+/g,' ').slice(0,100)}»)`)
 for(const n of s.cmd??[]){const r=v.replies[n-1]??'';if(!wrote(n)&&!asks(first(r))&&!/già/.test(r))add('GRAVE','comando-perso',`turno ${n}: «${said[n-1]}» né eseguito né una domanda («${r.replace(/\s+/g,' ').slice(0,100)}»)`)}
 for(const x of s.inMenu??[]){const w=menus[x.after];if(!w)continue;const k=plainT(x.dish)
  const hits=w.menus.flatMap(m=>m.sections.flatMap(sc=>sc.items.filter(it=>!menus[0]!.menus.some(m0=>m0.sections.some(s0=>s0.items.some(i0=>i0.id===it.id)))&&(plainT(it.name)===k||plainT(it.name).includes(k)||k.includes(plainT(it.name)))).map(it=>({it,m,sc}))))
  const good=hits.filter(h=>plainT(h.m.name)===plainT(x.menu)&&(!x.section||plainT(h.sc.name).startsWith(plainT(x.section).slice(0,5)))&&(x.price===undefined||Math.abs(h.it.price-x.price)<0.005))
  if(hits.some(h=>plainT(h.m.name)!==plainT(x.menu)))add('GRAVE','menu-nominato-ignorato',`dopo il turno ${x.after}: «${x.dish}» creato fuori dal ${x.menu}`)
  else if(!good.length)add('GRAVE','menu-nominato-ignorato',`dopo il turno ${x.after}: «${x.dish}» non è nel ${x.menu}${x.section?' > '+x.section:''}${x.price!==undefined?' a '+x.price:''}`)}
 for(const x of s.notSay??[])if(x.re.test(v.replies[x.turn-1]??''))add('GRAVE','testo-non-richiesto',`turno ${x.turn}: contiene ${x.re}`)
 for(const x of s.menuNamed??[]){const w=menus[x.after];if(w&&!menuIdx(w,x.name))add('GRAVE','rinomina-mancante',`dopo il turno ${x.after}: nessun Menu «${x.name}»`)}
 for(const x of s.sectionIn??[]){const w=menus[x.after];const m=w&&menuIdx(w,x.menu);if(w&&(!m||!m.sections.some(sc=>plainT(sc.name)===plainT(x.section))))add('GRAVE','rinomina-mancante',`dopo il turno ${x.after}: nel ${x.menu} non c'è il sottomenu «${x.section}»`)}
 return f}
