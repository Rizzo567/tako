import {z} from 'zod'
import type {Workspace} from './menu-workspace-contract.js'
export const designInstructionSchema=z.object({field:z.enum(['primary','background','text','categoryBackground','categoryText','gradientFrom','gradientTo','gradientAngle','font']),value:z.string().min(1).max(100),evidence:z.string().min(1).max(500)}).strict()
export type OnboardingDesignInstruction=z.infer<typeof designInstructionSchema>
const colors:Record<string,string>={nero:'#000000',bianco:'#ffffff',rosso:'#ff0000',arancione:'#ff8a28',giallo:'#ffd43b',verde:'#008000',blu:'#0000ff',azzurro:'#0099ff',viola:'#800080',rosa:'#ffc0cb',grigio:'#808080',crema:'#fff4dc',avorio:'#fffff0',oro:'#d4af37','blu notte':'#0b132b','grigio scuro':'#242628','grigio chiaro':'#e5e7eb'}
const normalize=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim()
export function onboardingColor(raw:string){const value=normalize(raw).replace(/\barancioni\b/g,'arancione').replace(/\bner[iae]\b/g,'nero').replace(/\bbianch[ie]\b/g,'bianco').replace(/\bross[iae]\b/g,'rosso').replace(/\bverd[ie]\b/g,'verde').replace(/\bazzurr[iae]\b/g,'azzurro');if(/^#[0-9a-f]{6}$/.test(value))return value;if(/^#[0-9a-f]{3}$/.test(value))return '#'+[...value.slice(1)].map(x=>x+x).join('');return colors[value]??null}
export function groundedDesignInstructions(raw:OnboardingDesignInstruction[],source:string){
 const result=raw.filter(i=>source.includes(i.evidence)&&normalize(i.evidence).includes(normalize(i.value)))
 if(!result.some(i=>i.field==='primary')){const matches=[...source.matchAll(/\b(?:pulsanti|bottoni|colore principale)\s+(?:di colore\s+)?(#[0-9a-fA-F]{3,6}|arancion[ie]|ner[oi]|bianch[io]|ross[oi]|verd[ei]|blu|azzurr[oi]|oro)\b/gi)];if(matches.length===1&&!/\b(non|senza|evita)\b/i.test(source)){const m=matches[0]!;result.push({field:'primary',value:m[1]!,evidence:m[0]})}}
 if(!result.some(i=>i.field==='gradientAngle')&&/sfumat|gradient/i.test(source)){const matches=[...source.matchAll(/(?:\bangolo(?:\s+della\s+sfumatura)?(?:\s+di)?|\ba)\s+(\d{1,3})\s*(?:gradi|°)/gi)];if(matches.length===1&&!/\b(non|senza|evita)\b/i.test(source)){const m=matches[0]!;result.push({field:'gradientAngle',value:m[1]!,evidence:m[0]})}}
 return result
}
/** Applies only canonical primitive style values; no URL, CSS, HTML, script or remote asset can be supplied here. */
export function applyOnboardingDesign(design:Workspace['design'],instructions:OnboardingDesignInstruction[]){
 const next=structuredClone(design),issues:string[]=[],issuesByField:Record<string,string[]>={},applied:string[]=[];let from=next.backgroundGradient?.from,to=next.backgroundGradient?.to,angle=next.backgroundGradient?.angle??180
 const issue=(field:string,message:string)=>{issues.push(message);(issuesByField[field]??=[]).push(message)}
 for(const i of instructions){
  if(i.field==='font'){const font=normalize(i.value);if(['sans','serif','mono','poppins','staatliches','amaranth','italiana'].includes(font)){next.font=font as Workspace['design']['font'];applied.push(i.field)}else issue('font','Quale *font* vuoi usare? Posso usare Poppins, Amaranth, Staatliches, Italiana, sans, serif o mono.');continue}
  if(i.field==='gradientAngle'){const amount=i.value.trim().match(/^(\d{1,3}(?:[.,]\d+)?)\s*(?:gradi|°)?$/i),n=amount?Number(amount[1]!.replace(',','.')):NaN;if(Number.isFinite(n)&&n>=0&&n<=360){angle=n;applied.push(i.field)}else issue('gradientAngle','Indica l’*angolo della sfumatura* da 0 a 360.');continue}
  const color=onboardingColor(i.value);if(!color){issue(i.field,`Non riconosco il *colore ${i.value}*. Puoi inviare il codice esadecimale?`);continue}
  if(i.field==='gradientFrom')from=color;else if(i.field==='gradientTo')to=color;else{next[i.field]=color;if(i.field==='background')next.backgroundGradient=null;if(i.field==='primary'){next.categoryActiveBackground=color}}
  applied.push(i.field)
 }
 if(from&&to&&instructions.some(i=>i.field.startsWith('gradient'))){next.backgroundGradient={from,to,angle};next.background=from}
 else if(instructions.some(i=>i.field==='gradientFrom'||i.field==='gradientTo'))issue('gradient','Quali *due colori* vuoi per la sfumatura?')
 // Renderer uses per-item typography colors. Keep explicit global text changes visible in all modes.
 if(applied.includes('text'))for(const mode of ['standard','centered','link'] as const){next[mode]={...next[mode],name:{...next[mode].name,color:next.text},description:{...next[mode].description,color:next.text},price:{...next[mode].price,color:next.text}}}
 return{design:next,issues,issuesByField,applied}
}
