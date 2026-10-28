import {Buffer} from 'node:buffer'
import {createHmac,timingSafeEqual} from 'node:crypto'
export const twilioSignature=(token:string,url:string,form:Record<string,string>)=>createHmac('sha1',token).update(url+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
export function validTwilioSignature(token:string,url:string,form:Record<string,string>,signature:string){if(!token||!signature)return false;const expected=Buffer.from(twilioSignature(token,url,form)),received=Buffer.from(signature);return expected.length===received.length&&timingSafeEqual(expected,received)}
export const normalizeMenuText=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const confirmWords=new Set(['conferma','confermo','confermato','confermare','confirma','confirm','conferm','si','ok','okay','va','bene','procedi','vai','applica','pubblica']),cancelWords=new Set(['annulla','annullo','annullare','no','cancella','lascia','stare','stop'])
export function replyIntent(raw:string):'confirm'|'cancel'|null{const words=normalizeMenuText(raw).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean);if(!words.length||words.length>4)return null;const text=words.join(' ');if(words.every(w=>confirmWords.has(w))&&!['va','bene'].includes(text))return 'confirm';if(words.every(w=>cancelWords.has(w))&&!['lascia','stare'].includes(text))return 'cancel';return null}
export const shouldHandleInTako=(linked:boolean,body:string)=>linked||normalizeMenuText(body).startsWith('collega tako')
export async function forwardTwilioWebhook(url:string,token:string,form:Record<string,string>,timeoutMs=12000){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':twilioSignature(token,url,form)},body:new URLSearchParams(form).toString(),signal:AbortSignal.timeout(timeoutMs),redirect:'manual'});return{status:response.status,contentType:response.headers.get('content-type'),body:Buffer.from(await response.arrayBuffer())}}
export type MenuCommand={kind:'price';name:string;price:number}|{kind:'available'|'hidden';name:string;value:boolean}
export function parseMenuCommand(raw:string):MenuCommand|null{
 const text=raw.trim();const price=text.match(/^(?:prezzo\s+|(?:cambia|imposta|metti|porta)\s+(?:il prezzo (?:di |del |della ))?)(.+?)\s+(?:a|=)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*$/i);
 // G1: «metti in offerta X a N», «metti nel menu …» non sono cambi prezzo.
 if(price&&/\b(in (?:offerta|promo\w*|sconto)|nel menu|nuov[oa]|aggiung\w*|tra (?:i|gli|le))\b/i.test(price[1]!))return null
 if(price){const amount=Number(price[2]!.replace(',','.'));return amount<=100000?{kind:'price',name:price[1]!.trim(),price:amount}:null}
 const status=text.match(/^(nascondi|mostra|esaurito|disponibile|rendi disponibile)\s+(.+)$/i);
 if(status){const verb=normalizeMenuText(status[1]!);return {kind:['nascondi','mostra'].includes(verb)?'hidden':'available',name:status[2]!.trim(),value:['nascondi','disponibile','rendi disponibile'].includes(verb)}}return null
}
/** Separatore tra più messaggi nella stessa risposta (es. benvenuto + «cosa sai fare»): ognuno diventa un <Message>. */
export const nextMessage='\u0002'
export function twiml(text:string){const escape=(t:string)=>t.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));return `<?xml version="1.0" encoding="UTF-8"?><Response>${text.split(nextMessage).filter(Boolean).flatMap(t=>{const parts:string[]=[];while(t.length>1400){const cut=t.lastIndexOf('\n',1400),end=cut>700?cut:1400;parts.push(t.slice(0,end));t=t.slice(end).replace(/^\n/,'')}if(t)parts.push(t);return parts}).map(t=>`<Message>${escape(t)}</Message>`).join('')}</Response>`}
/** WhatsApp sends voice notes as audio/*; an audio file sent as a document may arrive as a generic type with its file name as Body. */
export function whatsappAudioType(type:unknown,body:unknown):string|null{
 const t=typeof type==='string'?type.split(';')[0]!.trim().toLowerCase():'',name=typeof body==='string'?body.trim().toLowerCase():''
 if(/^audio\//.test(t))return t
 if(/^(?:application\/octet-stream|video\/mp4|application\/mp4)$/.test(t)){const ext=name.match(/\.(m4a|aac|mp3|mpeg|ogg|oga|opus|wav|webm|amr)$/)?.[1];if(ext)return ext==='m4a'||ext==='aac'?'audio/mp4':ext==='mp3'||ext==='mpeg'?'audio/mpeg':ext==='wav'?'audio/wav':ext==='webm'?'audio/webm':ext==='amr'?'audio/amr':'audio/ogg'}
 return null
}
