/** The model sometimes copies the instruction into the name («Alza la Pasta al pomodoro», «Aggiungi Lasagne»).
 * onboardingDishName only PROPOSES the name without the leading verb: the caller keeps it only when the rest is a
 * dish already in the draft, or the verb is «aggiungi/inserisci» (never for «aggiungi Porta Nuova»). */
const leadingVerb=/^(?:(?:alza(?:re)?|abbassa(?:re)?|metti(?:lo|la)?|porta(?:lo|la)?|cambia(?:re)?|camba|aggiorna(?:re)?|correggi|modifica(?:re)?|tieni|mantieni|mantienni|mantenere|lascia(?:re)?|conferma|confermo|conserva|aggiungi|aggiungere|inserisci|togli|anche|poi|e|il\s+prezzo\s+(?:del(?:la|lo|l['’])?|dei|degli|delle))\s+)+/i
// Whole words only: «in tavola» is not «i n tavola», «Lasagne» is not «la sagne».
const leadingArticle=/^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|l['’]\s*)/i
export function onboardingDishName(name:string){
 const raw=name.trim().replace(/\s+/g,' ')
 let out=raw.replace(leadingVerb,'');if(out!==raw)out=out.replace(leadingArticle,'')
 out=out.trim();return out!==raw&&out.length>=3?out.charAt(0).toLocaleUpperCase('it')+out.slice(1):raw
}
/** Normalized identity of a dish name (never strips verbs: «Porta Nuova» stays «porta nuova»). */
export const onboardingDishKey=(name:string)=>name.trim().replace(leadingArticle,'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()
function distance(a:string,b:string,max:number){if(Math.abs(a.length-b.length)>max)return max+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];let best=i;for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]!+1,cur[j-1]!+1,prev[j-1]!+(a[i-1]===b[j-1]?0:1));best=Math.min(best,cur[j]!)}if(best>max)return max+1;prev=cur}return prev[b.length]!}
/** Same dish: equal normalized name, or one/two-letter typo on a long name with the same numbers («Burger clasico»). Never «Burger» = «Burger classico». */
export function sameOnboardingDish(a:string,b:string){
 const x=onboardingDishKey(a),y=onboardingDishKey(b);if(x===y)return true
 if((x.match(/\d+/g)||[]).join()!==(y.match(/\d+/g)||[]).join())return false
 const max=Math.min(x.length,y.length)>=12?2:Math.min(x.length,y.length)>=7?1:0
 return max>0&&distance(x,y,max)<=max
}
/** Does this text mention the dish (normalized, typo-tolerant word window)? */
export function mentionsOnboardingDish(text:string,name:string){
 const words=onboardingDishKey(text).split(' '),target=onboardingDishKey(name),size=target.split(' ').length
 if(!target)return false;if(` ${words.join(' ')} `.includes(` ${target} `))return true
 for(let i=0;i+size<=words.length;i++)if(sameOnboardingDish(words.slice(i,i+size).join(' '),target))return true
 return false
}
export const onboardingAddVerbName=(name:string)=>/^(?:aggiungi|aggiungere|inserisci|crea)\s/i.test(name.trim())
