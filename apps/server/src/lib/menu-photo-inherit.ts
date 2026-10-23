// Decisione Manuel 22/10 (brain decisioni/2026-10-22-takomenu-foto-piatto-per-nome): lo stesso piatto è la stessa foto.
// Un piatto aggiunto, creato o rimesso visibile SENZA foto, con un omonimo (stesso nome normalizzato: minuscole, accenti, spazi,
// punteggiatura) che ha una foto altrove nel locale, eredita quella foto. Mai sovrascrivere una foto già presente.
// Funzione pura sul documento: modifica `next` sul posto (prima di applyBotChange, così il record di «annulla» la include).
import {plain,safe} from './twilio-menu-ai.js'

export type InheritedPhoto={id:string,name:string,fromMenu:string,fromSection:string}
type Loc={item:any,menu:string,section:string,order:number}

export const dishKey=(name:string)=>plain(String(name??''))

function locate(w:any):Loc[]{const out:Loc[]=[];let order=0
 for(const m of w?.menus??[])for(const s of m?.sections??[])for(const i of s?.items??[])out.push({item:i,menu:String(m?.name??''),section:String(s?.name??''),order:order++})
 return out}

/** Donatore tra gli omonimi con foto. «La più recente» senza date per piatto: prima una foto messa in QUESTA modifica (non c'era
 *  in `before`), poi la foto più condivisa fra gli omonimi, poi la prima in ordine di menu. */
function donorFor(cands:Loc[],beforeImg:Map<string,string|null>):Loc|undefined{
 if(!cands.length)return undefined
 const fresh=cands.filter(c=>beforeImg.get(c.item.id)!==c.item.imageUrl);if(fresh.length)return fresh[0]
 const count=new Map<string,number>();for(const c of cands)count.set(c.item.imageUrl,(count.get(c.item.imageUrl)??0)+1)
 return [...cands].sort((a,b)=>(count.get(b.item.imageUrl)!-count.get(a.item.imageUrl)!)||a.order-b.order)[0]
}

export function inheritPhotos(before:any|null|undefined,next:any):InheritedPhoto[]{
 const prev=new Map<string,any>(locate(before).map(l=>[l.item.id,l.item])),beforeImg=new Map<string,string|null>([...prev].map(([id,i])=>[id,i?.imageUrl??null]))
 const all=locate(next),withImg=all.filter(l=>typeof l.item.imageUrl==='string'&&l.item.imageUrl),out:InheritedPhoto[]=[]
 for(const l of all){const i=l.item;if(i.imageUrl)continue
  const p=prev.get(i.id),entered=!p||(!!p.hidden&&!i.hidden)
  if(!entered||i.hidden)continue
  const key=dishKey(i.name);if(!key)continue
  const d=donorFor(withImg.filter(x=>x.item.id!==i.id&&dishKey(x.item.name)===key),beforeImg);if(!d)continue
  i.imageUrl=d.item.imageUrl;out.push({id:i.id,name:i.name,fromMenu:d.menu,fromSection:d.section})}
 return out
}

/** Nota breve per la risposta: «Foto presa da Alla carta» (una riga per piatto se più d'uno). */
export function inheritedNote(list:InheritedPhoto[]):string{
 if(!list.length)return ''
 if(list.length===1)return `*${safe(list[0]!.name)}*: foto presa da ${safe(list[0]!.fromMenu)}`
 return 'Foto prese dagli stessi piatti:\n'+list.map(x=>`• *${safe(x.name)}* (da ${safe(x.fromMenu)})`).join('\n')
}

/** Foto con didascalia: piatti su cui va la foto. Nome identico (normalizzato) o candidati tutti con lo stesso nome → tutti gli
 *  omonimi del locale, senza domanda. Nomi DIVERSI → null (si chiede quale, o decide il modello sul solo piatto). */
export function photoTargetsByName(text:string,candidates:{id:string,name:string}[],refs:{id:string,name:string}[]):string[]|null{
 const key=dishKey(text),exact=candidates.filter(r=>dishKey(r.name)===key),same=candidates.length>0&&new Set(candidates.map(r=>dishKey(r.name))).size===1
 const anchor=exact[0]??(same?candidates[0]:undefined);if(!anchor)return null
 return groupOf(anchor.id,refs)}
/** Tutti gli omonimi (stesso nome normalizzato) del piatto `id`, lui compreso. */
export function groupOf(id:string,refs:{id:string,name:string}[]):string[]{
 const k=dishKey(refs.find(r=>r.id===id)?.name??'');return refs.filter(r=>r.id===id||(!!k&&dishKey(r.name)===k)).map(r=>r.id)}
