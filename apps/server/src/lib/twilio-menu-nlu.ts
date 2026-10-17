// Comprensione deterministica lato server: riconosce le frasi comuni e preseleziona i piatti senza chiamare l'IA.
import type {MenuRef,SectionRef} from './twilio-menu-ai.js'
import {capabilities,helpWords} from './twilio-menu-copy.js'
import {parseMenuCommand} from './twilio-menu-command.js'
export const plainText=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/€/g,' euro ').replace(/[^a-z0-9,.]+/g,' ').replace(/\s+/g,' ').trim()
const stop=new Set('il lo la i gli le l un uno una di da del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle con col coi sul sulla e ed o a in per tra fra che mi ci si ti oggi niente piu non c e sono costa costano euro eur prezzo metti mettila mettilo mettili mettile porta portala portalo cambia imposta finito finita finiti finite esaurito esaurita esauriti esaurite tornato tornata tornati tornate disponibile disponibili nascondi togli leva levami toglimi elimina cancella rimuovi rimetti mostra menu evidenza piatto piatti scrivi quanto cosa ancora adesso ora stasera domani grazie ciao per favore perfavore anche pure'.split(' '))
export const stem=(w:string)=>w.length>4?w.replace(/[aeiou]+$/,''):w
const lev=(a:string,b:string)=>{if(Math.abs(a.length-b.length)>1)return 2;const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0]!;d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j]!;d[j]=Math.min(d[j]!+1,d[j-1]!+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}return d[b.length]!}
export const sameWord=(a:string,b:string)=>a===b||stem(a)===stem(b)||(a.length>=5&&b.length>=5&&(lev(a,b)<=1||a.startsWith(b)||b.startsWith(a)))
export const words=(s:string)=>plainText(s).replace(/[,.]/g,' ').split(' ').filter(w=>w.length>=2&&!stop.has(w)&&!/^\d+$/.test(w))
const nameWords=(s:string)=>plainText(s).replace(/[,.]/g,' ').split(' ').filter(w=>w.length>=2&&!['il','lo','la','i','gli','le','di','da','del','della','dei','delle','al','alla','alle','ai','agli','con','e','o','a','in','con','allo','dello'].includes(w))
// Piatti che contengono tutte le parole della richiesta (nome o categoria, almeno una nel nome). Un nome coperto per intero vince.
export function matchDishes(query:string,refs:MenuRef[],same:(a:string,b:string)=>boolean=sameWord):MenuRef[]{
 const q=words(query);if(!q.length)return[]
 const hits=refs.filter(r=>{const name=nameWords(r.name),section=nameWords(r.section??'');return q.every(w=>name.some(n=>same(w,n))||section.some(n=>same(w,n)))&&q.some(w=>name.some(n=>same(w,n)))})
 const exact=hits.filter(r=>nameWords(r.name).every(n=>q.some(w=>same(w,n))));if(!exact.length)return hits
 // Nome generico di una parola («Margherita»): anche i piatti che lo contengono per intero («Mezzo metro Margherita») restano in gioco.
 const wider=exact.length===1&&nameWords(exact[0]!.name).length<=1?hits.filter(r=>r!==exact[0]&&nameWords(exact[0]!.name).every(n=>nameWords(r.name).some(m=>sameWord(n,m)))):[];return[...exact,...wider]
}
/** Round 3: tra più candidati vince l'unico il cui nome è tutto nel testo («la pizza margherita» → Margherita, non
 * «Margherita con bufala»). null se non c'è un vincitore unico. */
export function exactPick(query:string,options:MenuRef[]):MenuRef|null{const q=words(query),inside=options.filter(r=>nameWords(r.name).every(n=>q.some(w=>sameWord(w,n))));return inside.length===1?inside[0]!:null
}
// Chiave fonetica dell'italiano scritto o dettato: gli/li/j → i, ch/c dura/q/k → k, gh → g, h muta, z/x → s, y → i, doppie scempie, desinenza vocalica tolta.
export const soundKey=(w:string)=>{const k=w.replace(/gli/g,'li').replace(/li(?=[aeou])/g,'i').replace(/j/g,'i').replace(/ch/g,'k').replace(/gh/g,'g').replace(/c(?=[aouk]|$)/g,'k').replace(/q/g,'k').replace(/h/g,'').replace(/[zx]/g,'s').replace(/y/g,'i').replace(/w/g,'v').replace(/(.)\1+/g,'$1');return k.length>3?k.replace(/[aeiou]+$/,''):k}
// Distanza di edit con lo scambio di due lettere vicine contato come un solo errore («merigna» → «meringa»).
const swaps=(a:string,b:string)=>{const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;d[i]![j]=Math.min(d[i-1]![j]!+1,d[i]![j-1]!+1,d[i-1]![j-1]!+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i]![j]=Math.min(d[i]![j]!,d[i-2]![j-2]!+1)}return d[a.length]![b.length]!}
// Parola simile per il ripiego: parole di almeno 5 lettere, stesso inizio fonetico (2 lettere, 1 per chiavi lunghe), lunghezze quasi uguali.
// Errori ammessi sulla chiave: 0 fino a 4 lettere («pan»: pane ≠ panna ≠ penne; «orar» ≠ «orat»), 1 fino a 6 («rufol»→«rukol»), 2 oltre («margarit»→«margerit»).
export const nearWord=(a:string,b:string)=>{if(sameWord(a,b))return true;
 // 17/10: la «h» muta non conta, anche nei nomi corti («bo» = «boh», «bho»); solo uguaglianza, nessun altro errore ammesso.
 {const ha=a.replace(/h/g,''),hb=b.replace(/h/g,'');if(ha.length>=2&&ha===hb)return true}
 if(a.length<5||b.length<4)return false;const ka=soundKey(a),kb=soundKey(b);if(ka===kb)return ka.length>=4;const n=Math.min(ka.length,kb.length),max=n<=4?0:n<=6?1:2,head=n>=7?1:2;return max>0&&ka.slice(0,head)===kb.slice(0,head)&&Math.abs(ka.length-kb.length)<=1&&swaps(ka,kb)<=max}
// Ripiego senza IA quando il match normale non trova niente: stessa regola (tutte le parole, nome coperto per intero vince), parole tolleranti a errori di battitura e dettatura.
export function fuzzyDishes(query:string,refs:MenuRef[]):MenuRef[]{return matchDishes(query,refs,nearWord)}
export function findDishes(query:string,refs:MenuRef[]):MenuRef[]{const hits=matchDishes(query,refs);return hits.length?hits:fuzzyDishes(query,refs)}
// Preselezione per l'IA: piatti con almeno una parola in comune, ordinati per numero di parole nel nome.
export function preselect(text:string,refs:MenuRef[],max=12):MenuRef[]{
 const q=words(text);if(!q.length)return[]
 return refs.map(r=>{const name=nameWords(r.name),section=nameWords(r.section??'');return{r,score:q.reduce((s,w)=>s+(name.some(n=>sameWord(w,n))?2:section.some(n=>sameWord(w,n))?0.5:0),0)}}).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,max).map(x=>x.r)
}
export type Intent={kind:'price',target:string,price:number}|{kind:'available'|'hidden'|'featured',target:string,value:boolean}|{kind:'description',target:string,text:string}|{kind:'tag',target:string,tag:string}|{kind:'read',read:'unavailable'|'hidden'}|{kind:'ask',target:string}|{kind:'capability',ids:string[]}
const num='(\\d+(?:[.,]\\d{1,2})?)'
const amount=(s:string)=>{const n=Number(s.replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=100000?Math.round(n*100)/100:null}
const capabilityWords:[RegExp,string][]=[[/allergen/,'allergens'],[/\b(elimin|cancell|rimuov|cancel)\w*/,'delete'],[/rinomin|\bcambi\w* (il |i )?nom/,'rename'],[/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/,'bulk'],[/grafic|\bcolor|\bfont\b|impagin|\blogo\b|sfondo/,'graphics'],[/categori|sezion/,'categories'],[/tradu|ingles|lingu/,'translations'],[/\bfoto|immagin/,'photo'],[/vocal|audio/,'voice']]
// Richiesta di aiuto in qualunque forma («dimmi un po' tutto quello che sai fare», «mi spieghi come funzioni», «cosa sa fare»), mai se la frase contiene già un'azione sul menu.
export function isHelpRequest(raw:string){
 const t=' '+plainText(raw).replace(/[,.]/g,' ').replace(/\s+/g,' ').trim()+' '
 if(/\d|\b(ignora|costa|costano|finit\w*|esaurit\w*|tornat\w*|nascondi|togli|rimetti|evidenza|aggiungi|prezzo|scrivi)\b/.test(t))return false
 return /\b(cosa|che cosa|che|cos|quali cose)\b( \w+){0,4} (sai|sa|sapete|puoi|puo|potete|posso|riesci|fai|fa|fate)( \w+){0,2} (fare|fai|chiederti|chiederle|chiedere|domandarti|gestire|cambiare|farmi)\b/.test(t)
  ||/\b(che|cosa) (fai|fa|sai fare|puoi fare)\s*$/.test(t)
  ||/\bcome (funzion\w*|si usa|ti uso|usarti|ti si usa|lavori|ti devo scrivere|ti scrivo)\b/.test(t)
  ||/\b(aiut\w*|help|istruzion\w*|comand\w*|funzion(i|alita)|menu comandi|guida|tutorial|spiegami|mi spieghi|spiegazion\w*)\b/.test(t)
}
export function capabilityFromText(raw:string):string[]|null{
 const t=plainText(raw).replace(/[,.]/g,' ').replace(/\s+/g,' ').trim();if(/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/.test(t+raw))return['bulk'];if(helpWords.includes(t)||isHelpRequest(raw))return['all']
 const question=/\?\s*$/.test(raw)||/^(puoi|potresti|sai|posso|riesci|si puo|e possibile|come (faccio|si fa)|si possono)\b/.test(t),imperative=/^rinomina \w+/.test(t)||/^(elimina|cancella|rimuovi) \w+/.test(t)&&/\b(categori\w*|sezion\w*|tutt[oiea]|menu intero|intero menu)\b/.test(t)
 if(/tutti i (prezzi|piatti)|tutto il menu|in blocco|per ?cento|%/.test(t+raw))return['bulk'];if(!question&&!imperative)return null;const ids=capabilityWords.filter(([r])=>r.test(t)).map(([,id])=>id);return ids.length?[...new Set(ids)].slice(0,2):null
}
// Frasi comuni con un solo piatto: niente IA. Le frasi composte («… e …») restano all'IA.
export function parseIntent(raw:string):Intent|null{
 // G4: una domanda non è mai un'azione («il tiramisù è finito?», «la carbonara costa 13?»): diventa una lettura.
 // Round 2: domande senza «?» («c'è ancora la tagliata», «sai se la carbonara è finita», «la lasagna è finita vero»).
 const q=plainText(raw).replace(/(?<!\d)[,.!]|[,.!](?!\d)/g,' ').replace(/\s+/g,' ').trim(),spoken=q.match(/^(?:c e ancora|ce ancora|ci sono ancora|abbiamo ancora|avete ancora|ce l abbiamo ancora|ce lo abbiamo ancora|ce la abbiamo ancora|ce l hai ancora|ce l avete ancora|e rimast[oaie] (?:ancora )?) (.+)$/)
 if(spoken)return{kind:'ask',target:spoken[1]!.replace(/ vero$/,'')}
 // 17/10 (bassi round 2): «volevo sapere il prezzo della pizza 4 formaggi», «la lasagna è ancora disponibile», «… o no», «… o ce n'è ancora».
 const priceAsk=q.match(/^(?:volevo|vorrei|voglio) sapere (?:il prezzo|quanto costa|quanto costano|quanto viene) (?:di |del |della |dello |dei |degli |delle |dell |de )?(.+)$/);if(priceAsk)return{kind:'ask',target:priceAsk[1]!}
 const still=q.match(/^(?:ma )?(.+?) (?:e|sono) ancora (?:disponibil\w*|finit\w*|esaurit\w*|nel menu|in menu|online)$/);if(still&&!/\b(?:metti|togli|nascondi|aggiungi)\b/.test(still[1]!))return{kind:'ask',target:still[1]!}
 const orNo=q.match(/^(?:ma )?(.+?) o (?:no|non|ce n e ancora|c e ancora|ancora c e|e finit\w*|e disponibil\w*|e tornat\w*)$/);if(orNo){const inner=parseIntentCore(orNo[1]!);if(inner&&'target' in inner)return{kind:'ask',target:inner.target};if(inner&&inner.kind==='read')return inner}
 const lead=q.match(/^(?:volevo sapere se|vorrei sapere se|ti volevo chiedere se|volevo chiederti se|volevo chiedere se|ti chiedo se|sai se|mi sai dire se|mi sapresti dire se|mi dici se|dimmi se|puoi dirmi se|potresti dirmi se|mi puoi dire se|mi confermi che|confermami che|mi confermi se|e vero che|ma) (.+)$/),tail=/ vero$/.test(q)
 // Round 4: «potresti dirmi cosa è finito?», «mi dici se ho messo la tagliata in evidenza?» → letture.
 const told=q.match(/^(?:puoi|potresti|mi sai|mi sapresti|mi puoi|ce la fai a|riesci a|riusciresti a|sai|sapresti) dirmi (cosa|che cosa|quali piatti|quali|quanto) (.+)$/);if(told)return parseIntentCore(`${told[1]} ${told[2]}`)
 if(lead&&q.startsWith('ma ')===false||tail){const inner=parseIntentCore((lead?lead[1]!:q).replace(/ vero$/,'').replace(/^(?:ho|abbiamo|hai) (?:messo|segnato|tolto|nascosto|cambiato) /,''));if(inner&&'target' in inner)return{kind:'ask',target:inner.target.replace(/^(?:ho|abbiamo) (?:messo|segnato) /,'')}
  if(inner&&inner.kind==='read')return inner}
 const found=parseIntentCore(raw);if(found&&'target' in found&&found.kind!=='ask'&&/\?\s*$/.test(raw.trim()))return{kind:'ask',target:found.target};return found
}
const nluActionTarget=/\b(promo|offerta|offerte|sconto|scontat\w*|aggiung\w*|inserisc\w*|nuov[oa]|nel menu|al menu|categoria|descrizione|foto)\b/
const nluUnits:Record<string,number>={uno:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9},nluTeens:Record<string,number>={dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19},nluTens:[string,number][]=[['venti',20],['vent',20],['trenta',30],['trent',30],['quaranta',40],['quarant',40],['cinquanta',50],['cinquant',50],['sessanta',60],['sessant',60],['settanta',70],['settant',70],['ottanta',80],['ottant',80],['novanta',90],['novant',90]]
function nluBelow100(w:string):number|null{if(!w)return 0;if(w in nluUnits)return nluUnits[w]!;if(w in nluTeens)return nluTeens[w]!;for(const [p,v] of nluTens)if(w.startsWith(p)){const r=w.slice(p.length);if(!r)return v;if(r in nluUnits)return v+nluUnits[r]!}return null}
function nluWordNumber(w:string):number|null{const m=w.match(/^(due|tre|quattro|cinque|sei|sette|otto|nove)?cento?(.*)$/);if(m&&w.includes('cent')){const r=nluBelow100(m[2]!);return r===null?null:(m[1]?nluUnits[m[1]]!:1)*100+r}const v=w?nluBelow100(w):null;return v===0?null:v}
/** Numero in lettere fino a 999 («tredici», «centoventi»), null se non è un numero. */
export const wordNumber=(w:string)=>nluWordNumber(w)
/** Verbi che tolgono un piatto dal menu (nascondere): «togli», «leva», «levami», «elimina», «cancella», «rimuovi» e varianti. */
export const removeVerb='(?:nascondi|nascondimi|togli|toglie|toglimi|toglici|togliete|togliamo|leva|levami|levaci|levate|leviamo|elimina|eliminami|eliminate|eliminiamo|cancella|cancellami|cancellate|cancelliamo|rimuovi|rimuovimi|rimuovete|rimuoviamo)'
// Anche le forme con il pronome («toglilo», «levala»): solo per riconoscere il verbo, mai come comando da solo.
const removeAny='(?:'+removeVerb.slice(3,-1)+'|nascondil[aoie]|toglil[aoie]|leval[aoie]|eliminal[aoie]|cancellal[aoie]|rimuovil[aoie])'
export const removeVerbRe=new RegExp(`\\b${removeAny}\\b`)
function parseIntentCore(raw:string):Intent|null{
 const original=raw.trim(),t=plainText(raw).replace(/(?<!\d)[,.]|[,.](?!\d)/g,' ').replace(/\s+/g,' ').trim()
 if(/^(cosa|che cosa|quali piatti|quali|che piatti) (e|sono|ci sono|risultano) (gia )?(finit|esaurit)\w*/.test(t)||/^(cosa|che cosa) (manca|non c e)/.test(t))return{kind:'read',read:'unavailable'}
 if(/^(cosa|che cosa|quali piatti|quali|che piatti) (e|sono|abbiamo|ho|hai|avete|risultano) (gia )?nascost\w*/.test(t))return{kind:'read',read:'hidden'}
 if(/^(cosa|che cosa|quali piatti|quali|che piatti) (abbiamo|ho|hai|avete) (gia )?(finit|esaurit)\w*/.test(t))return{kind:'read',read:'unavailable'}
 const description=original.match(/^(?:nella|nel|nello|nei|negli|nelle|per (?:la|il|lo|i|gli|le)|alla|al|allo)\s+(.+?)\s+scrivi\s*:\s*(.+)$/i);if(description)return{kind:'description',target:description[1]!,text:description[2]!.trim()}
 // Round 2: «costa novantacinque euro» → «costa 95 euro» (numeri in lettere fino a 999, solo davanti a «euro»).
 // Round 3 (E): decimali a voce «dieci virgola cinque», «tredici e mezzo».
 const nv=(w:string)=>/^\d+$/.test(w)?Number(w):nluWordNumber(w)
 const tDec=t.replace(/\b(\w+) virgola (\w+)\b/g,(all,a,b)=>{const x=nv(a),y=nv(b);return x===null||y===null?all:`${x}.${String(y).padStart(b.length>=2&&/^\d/.test(b)?b.length:1,'0')}`}).replace(/\b(\w+)(?: euro)? e mezz[oa]\b/g,(all,a)=>{const x=nv(a);return x===null?all:`${x}.5`})
 if(tDec!==t)return parseIntentCore(tDec)
 const tSpoken=t.replace(/\b([a-z]{3,})( euro)?$/,(all,w,e)=>{const n=/costa|costano|a/.test(t)?nluWordNumber(w):null;return n===null?all:n+(e??'')}).replace(/\b([a-z]{3,}) euro\b/g,(all,w)=>{const n=nluWordNumber(w);return n===null?all:n+' euro'});if(tSpoken!==t)return parseIntentCore(tSpoken)
 // G5: negazioni («non è finita», «non cambiare…», «non ci sarà») non sono comandi; restano «non c'è più», «non abbiamo più».
 if(/\bnon\b/.test(t)&&!/\bnon (c e|ce|abbiamo) piu\b/.test(t))return null
 let m:RegExpMatchArray|null
 if((m=t.match(/^quanto (?:costa|costano|viene|vengono) (.+)$/)))return{kind:'ask',target:m[1]!}
 if((m=t.match(/^(?:(?:ma|e|allora|senti|ciao|scusa) )*(.+?) quanto (?:costa|costano|viene|vengono)(?: adesso| ora| oggi)?$/)))return{kind:'ask',target:m[1]!}
 if((t.match(/\b(costa|costano|finit\w*|esaurit\w*|tornat\w*|nascondi|togli|rimetti|evidenza|mettil\w*|portal\w*|disponibil\w*|niente)\b/g)||[]).length>=2&&!/^oggi niente [a-z ]+ (finit|esaurit)\w*$/.test(t))return null
 if((m=t.match(new RegExp(`^(?:prezzo |(?:metti|porta|cambia|imposta)(?: il prezzo (?:di|del|della|dei|delle))? )(.+?) (?:a|=) ${num}(?: euro)?$`)))||(m=t.match(new RegExp(`^(.+?) (?:(?:costa|costano)(?: (?:sempre|ancora|ora|adesso|da oggi))?|viene|vengono|(?:mettil|portal)[aeio](?: a)?|(?:passa|passano|sale|salgono|scende|scendono) a|a) ${num}(?: euro)?$`)))){const price=amount(m[2]!);return price===null||nluActionTarget.test(m[1]!)?null:{kind:'price',target:m[1]!,price}}
 if((m=t.match(/^(?:e |sono )?(?:finit|esaurit)[oaie] (.+)$/))||(m=t.match(/^(.+?) (?:e|sono) (?:gia )?(?:finit|esaurit)[oaie]$/))||(m=t.match(/^oggi niente (.+?)(?: (?:e )?(?:finit|esaurit)[oaie])?$/))||(m=t.match(/^(?:non c e piu|non ce piu|non abbiamo piu) (.+)$/))||(m=t.match(/^(.+?) non (?:c e|ce) piu$/))||(m=t.match(/^(?:esaurito|finito) (.+)$/))||(m=t.match(/^(?!.*\b(?:e|sono)\b)(.{3,60}?) (?:finit|esaurit)[oaie]$/)))return{kind:'available',target:m[1]!,value:false}
 if((m=t.match(/^(.+?) (?:e|sono) (?:tornat[oaie]|di nuovo disponibil[ei]|disponibil[ei]|ritornat[oaie])$/))||(m=t.match(/^(?:e |sono )?(?:tornat[oaie]|ritornat[oaie]) (.+)$/))||(m=t.match(/^(?:disponibile|rendi disponibile|di nuovo disponibile) (.+)$/)))return{kind:'available',target:m[1]!,value:true}
 if((m=t.match(/^(?:togli|leva) (?:dall evidenza|dalla evidenza|dai piatti in evidenza) (.+)$/)))return{kind:'featured',target:m[1]!,value:false}
 if((m=t.match(/^metti in evidenza (.+)$/))||(m=t.match(/^(.+?) in evidenza$/)))return{kind:'featured',target:m[1]!,value:true}
 // 17/10 (regola Manuel): «togli/leva/levami/elimina/cancella/rimuovi X» = SEMPRE nascondere dal menu, mai «esaurito».
 // Esaurito solo con «finito/esaurito/non c'è più/nun ce sta». Un «no,»/«scusa,» davanti non cambia il verbo («no, togli boh»).
 if((m=t.match(new RegExp(`^(?:(?:no|scusa|anzi|allora|ok|si|senti|ah|e|ma|intendevo|volevo dire)\\s+)*${removeVerb}(?: (?:dal|dalla) (?:menu|carta|lista)(?: di oggi)?)? (.+?)(?: (?:dal|dalla) (?:menu|carta|lista)(?: di oggi)?)?$`))))return{kind:'hidden',target:m[1]!,value:true}
 if((m=t.match(/^(?:rimetti|mostra)(?: nel menu)? (.+?)(?: nel menu)?$/)))return{kind:'hidden',target:m[1]!,value:false}
 if((m=t.match(/^(.+?) (?:e|sono) (piccant|vegetarian|vegan|biologic|surgelat)[oaie]$/)))return{kind:'tag',target:m[1]!,tag:{piccant:'piccante',vegetarian:'vegetariano',vegan:'vegano',biologic:'biologico',surgelat:'surgelato'}[m[2]!]!}
 return null
}
const ordinals:[RegExp,number][]=[[/^(1|uno|il primo|la prima|primo|prima|l primo)$/,0],[/^(2|due|il secondo|la seconda|secondo|seconda)$/,1],[/^(3|tre|il terzo|la terza|terzo|terza)$/,2],[/^(4|quattro|il quarto|la quarta|quarto|quarta)$/,3],[/^(5|cinque|il quinto|la quinta|quinto|quinta)$/,4],[/^(6|sei|il sesto|la sesta)$/,5],[/^(7|sette|il settimo|la settima)$/,6],[/^(8|otto|l ottavo|l ottava)$/,7]]
// Risposta a «Quale intendi?»: numero, ordinale o nome tra le opzioni proposte.
export function resolveChoice(raw:string,options:MenuRef[]):MenuRef|null{
 const t=plainText(raw).replace(/[.,!?]+/g,' ').replace(/\s+/g,' ').trim().replace(/^(il|la|lo|i|gli|le|l|quello|quella|quelli|quelle|numero)\s+/,'').trim()
 for(const [r,i] of ordinals)if(r.test(t)||r.test(plainText(raw).replace(/[.,!?]+/g,'').trim()))return options[i]??null
 const hits=findDishes(raw,options);if(hits.length===1)return hits[0]!
 // «quelli alla carbonara», «quelli aglio e olio»: una parola distintiva del nome basta, se indica una sola opzione.
 const q=words(raw),tolerant=options.filter(o=>nameWords(o.name).some(n=>n.length>=4&&q.some(w=>sameWord(w,n))));return tolerant.length===1?tolerant[0]!:null
}
export const wantsCreateText=(m:string)=>/\b(aggiung\w*|inserisc\w*|inserire|nuov[oa]|crea\w*)\b/.test(plainText(m))
export const wantsSpecialText=(m:string)=>/\b(del giorno|di oggi)\b/.test(plainText(m))
// Round 3 (C, D): richieste cortesi o domande con verbo d'azione sono comandi («mi metti la carbonara a 13?», «possiamo
// mettere…», «puoi segnare finita…», «… ? mettila a 13»); «lascia stare X, <comando>» tiene solo il comando.
// Restituisce il testo riscritto come comando, oppure null se il messaggio va lasciato com'è.
/** Round 3 (E): «dieci virgola cinque» → 10.5, «tredici e mezzo» → 13.5 (prima del controllo «frase composta»). */
/** 17/10 (QA 11:13): «tredici euro e cinquanta» → «13,50 euro»: il centesimo detto dopo «euro» non rende composta la frase.
 * Solo per le modifiche singole: il menu intero da messaggio legge il testo originale. */
export function spokenCents(raw:string):string{const nv=(w:string)=>/^\d+$/.test(w)?Number(w):nluWordNumber(plainText(w))
 // 17/10 (A2.1): centesimi solo se il secondo numero (10–99) chiude la frase o la parte («… e 50», «… e cinquanta centesimi»,
 // «… e 50, il tiramisù…»): «10 euro e uno deve essere…» non è 10,01.
 return raw.replace(/\b([\p{L}\d]+)\s+euro\s+e\s+([\p{L}\d]+)\b(?!\s*(?:euro|€))(?=\s*(?:centesimi\b|cent\b|[.,;:!?)]|$|\s+(?:nei|nel|nella|nelle|negli|tra|fra|in|per|invece|poi|anche|e\s+(?:il|la|lo|i|gli|le|l|la|metti|togli|nascondi)\b)))/giu,(all,a,b)=>{const x=nv(a),y=/^\d{1,2}$/.test(b)?Number(b):nluWordNumber(plainText(b));return x===null||y===null||y<10||y>=100?all:`${x},${String(y).padStart(2,'0')} euro`}).replace(/(\d+,\d{2} euro)\s+(?:centesimi|cent)\b/g,'$1')}
export function spokenDecimals(raw:string):string{const nv=(w:string)=>/^\d+$/.test(w)?Number(w):nluWordNumber(plainText(w))
 return raw.replace(/\b([\p{L}\d]+)\s+virgola\s+([\p{L}\d]+)\b/giu,(all,a,b)=>{const x=nv(a),y=nv(b);return x===null||y===null?all:`${x},${y}`}).replace(/\b([\p{L}\d]+)(\s+euro)?\s+e\s+mezz[oa]\b/giu,(all,a,e)=>{const x=nv(a);return x===null?all:`${x},5${e??''}`})}
export function politeCommand(raw:string):string|null{
 let t=raw.trim(),changed=false
 // 17/10: «la carbonara la lasciamo in promo a 10», «il tiramisù lo mettiamo a 6» → «la carbonara in promo a 10», «il tiramisù a 6».
 const keep=t.match(/^(.+?)\s+(?:la|lo|li|le|l')\s*(?:lasciamo|lascio|lasciate|mettiamo|metto|facciamo|faccio)\s+((?:in (?:promo|offerta) )?a\s+\d+(?:[.,]\d{1,2})?(?:\s*(?:euro|€))?)\s*[.!]?$/i)
 if(keep){t=`${keep[1]} ${/^in /i.test(keep[2]!)?keep[2]:'costa '+keep[2]!.replace(/^a\s+/i,'')}`;return t}
 const two=t.match(/^(.+?)\?\s*(mettil[aoie]|portal[aoie]|fall[aoie]) a (\d+(?:[.,]\d{1,2})?)(?:\s*(?:euro|€))?[.!]?$/i)
 if(two){const asked=parseIntentCore(two[1]!);if(asked&&'target' in asked)return `prezzo ${asked.target} a ${two[3]}`}
 const lead=/^(?:ciao |allora |senti )?(?:per (?:piacere|favore) )?(?:mi |ci |me l[ao] |ce l[ao] |me li |me le )?(?:(?:puoi|potresti|possiamo|potete|riesci a|riusciresti a|ce la fai a|vorrei|volevo|dovresti|devi)\s+)?(?:mi |me l[ao] |ce l[ao] )?/i
 const verbs:[RegExp,string][]=[[/^metter[ei]\b|^metti\b/i,'metti'],[/^nasconder[ei]\b|^nascondi\b/i,'nascondi'],[/^toglier[ei]\b|^togli\b/i,'togli'],[/^segnar[ei]\b|^segn[ai]\b/i,'segna'],[/^aggiunger[ei]\b|^aggiungi\b/i,'aggiungi'],[/^rimetter[ei]\b|^rimetti\b/i,'rimetti'],[/^cambiar[ei]\b|^cambi\b/i,'cambia'],[/^portar[ei]\b|^porti\b/i,'porta']]
 const body=t.replace(/\s*\?+\s*$/,'').replace(/\s*,?\s*per (?:favore|piacere|cortesia)\s*$/i,'')
 const m=body.match(lead),after=body.slice(m?m[0].length:0),hasLead=!!m&&m[0].trim().length>0
 const v=verbs.find(([r])=>r.test(after))
 if(v&&(hasLead||/\?\s*$/.test(t))){t=after.replace(v[0],v[1]);changed=true}
 // «segna finita la carbonara» / «segna la carbonara finita» → «finita la carbonara» / «la carbonara finita»
 if(/^segna\s/i.test(t)){const rest=t.replace(/^segna\s+/i,'');if(/\b(finit|esaurit|disponibil|tornat)\w*\b/i.test(rest)){t=rest;changed=true}}
 if(/^rimetti\s+disponibil[ei]\s+/i.test(t)){t='disponibile '+t.replace(/^rimetti\s+disponibil[ei]\s+/i,'');changed=true}
 return changed?t:null
}
export const looksLikeQuestion=(m:string)=>/\?\s*$/.test(m)||/^(puoi|potresti|sai|posso|riesci|come|cosa|che|quali|quanto|quando|si puo|e possibile)\b/.test(plainText(m))
export const capabilityIds=capabilities.map(c=>c.id)
export const sectionsFor=(sections:SectionRef[])=>sections.slice(0,60)
// Candidati per l'IA: prima i piatti riconosciuti frase per frase («X è finita e Y mettila a 25»), altrimenti la preselezione larga.
export function candidatesFor(text:string,refs:MenuRef[],max=12):MenuRef[]{
 const found=new Map<string,MenuRef>();let unresolved=false
 for(const clause of plainText(text).split(/\s(?:e|poi|invece|mentre)\s|[;,]\s?(?!\d)/).map(c=>c.trim()).filter(Boolean)){if(!words(clause).length)continue;const hits=findDishes(clause,refs);if(!hits.length||hits.length>4){unresolved=true;continue}for(const r of hits)found.set(r.id,r)}
 return found.size&&!unresolved?[...found.values()].slice(0,max):[...new Map([...found.values(),...preselect(text,refs,max)].map(r=>[r.id,r])).values()].slice(0,max)
}
export const isThanks=(raw:string)=>/^(ok |okay |perfetto |benissimo |ottimo |va bene )?(grazie|grazie mille|grazie tante|ti ringrazio)( mille| tante| ciao)?$/.test(plainText(raw).replace(/[,.!]/g,' ').replace(/\s+/g,' ').trim())
type ChangeIntent=Exclude<Intent,{kind:'read'}|{kind:'ask'}|{kind:'capability'}>
// Frasi composte risolte senza IA quando ogni pezzo è un comando chiaro su un solo piatto: «le vongole sono finite e la tagliata coi porcini mettila a 25».
export function compoundIntents(raw:string,refs:MenuRef[]):{intent:ChangeIntent,ref:MenuRef}[]|null{
 const t=plainText(raw).replace(/(?<!\d)[,.]|[,.](?!\d)/g,' e ').replace(/\s+/g,' ').replace(/( e)+ /g,' e ').trim()
 const one=(part:string,previous?:ChangeIntent):{intent:ChangeIntent,ref:MenuRef}|null=>{let intent=parseIntent(part) as Intent|null;if(!intent&&previous?.kind==='price'){const m=part.match(/^(.+?) (?:a )?(\d+(?:[.,]\d{1,2})?)(?: euro)?$/);const price=m?Number(m[2]!.replace(',','.')):NaN;if(m&&price>=0&&price<=100000)intent={kind:'price',target:m[1]!,price:Math.round(price*100)/100}}
  if(!intent||!('target' in intent)||intent.kind==='ask')return null;const hits=findDishes(intent.target,refs);return hits.length===1?{intent:intent as ChangeIntent,ref:hits[0]!}:null}
 const walk=(rest:string,previous:ChangeIntent|undefined,depth:number):{intent:ChangeIntent,ref:MenuRef}[]|null=>{if(depth>5)return null;const whole=depth>0?one(rest,previous):null;if(whole)return[whole]
  for(const m of rest.matchAll(/ e /g)){const left=one(rest.slice(0,m.index),previous);if(!left)continue;const right=walk(rest.slice(m.index!+3),left.intent,depth+1);if(right)return[left,...right]}return null}
 return / e /.test(t)?walk(t,undefined,0):null
}
// Separatori di frase composta («e», virgola, «;», a capo). Quelli che fanno parte del nome di un piatto del menu
// («Pasta e fagioli», «Piatto live E») non rendono composta la frase: «prezzo Pasta e fagioli a 9» è un comando semplice.
const compoundSeparator=/(?<!\d),(?!\d)|[;\n]|\s+e\s+/i
// Lowercase only: accents are kept, «è» (verb) must never become the separator «e».
const lowerPlain=(s:string)=>s.normalize('NFC').toLowerCase()
export function maskDishNames(raw:string,refs:MenuRef[]){
 let t=lowerPlain(raw)
 const names=[...new Set(refs.map(r=>lowerPlain(r.name).replace(/\s+/g,' ').trim()).filter(n=>n&&compoundSeparator.test(n)))].sort((a,b)=>b.length-a.length)
 for(const n of names)t=t.replace(new RegExp(`(?<![\\p{L}\\d])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+')}(?![\\p{L}\\d])`,'giu'),' piatto ')
 return t
}
const completePart=(part:string)=>!!parseMenuCommand(part)||!!parseIntent(part)||/^\s*\S.*?\s(?:a|=)\s*(?:€\s*)?\d+(?:[.,]\d{1,2})?\s*(?:€|euro)?\s*$/i.test(part)
/** Frase da trattare come composta: c'è un separatore che non appartiene a un nome di piatto e, se l'intero messaggio è
 * già un comando semplice, ogni pezzo è a sua volta un comando completo («prezzo Burger a 12 e Tiramisu a 6»). */
export function isCompoundMessage(raw:string,refs:MenuRef[]){
 const masked=maskDishNames(raw,refs);if(!compoundSeparator.test(masked))return false
 if(!parseMenuCommand(raw))return true
 const parts=masked.split(new RegExp(compoundSeparator.source,'gi')).map(x=>x.trim()).filter(Boolean)
 return parts.length>1&&parts.every(completePart)
}
