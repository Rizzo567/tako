/** Numero del titolare → E.164 (+39…). Accetta i formati comuni: 333 123 4567, +39 333…, 0039 333…, 39333…, 02 1234567,
 *  con spazi, punti, trattini, barre o parentesi. Altri prefissi internazionali solo se scritti per esteso (+ o 00).
 *  Restituisce null se il numero non è plausibile. */
export function normalizeOwnerPhone(raw:unknown):string|null{
 if(typeof raw!=='string')return null
 let text=raw.trim().replace(/^whatsapp:/i,'').replace(/[\s.\-/()\u00a0]/g,'')
 if(!text||text.length>20)return null
 if(text.startsWith('00'))text='+'+text.slice(2)
 const italian=(national:string)=>/^(3\d{8,9}|0\d{5,10})$/.test(national)?'+39'+national:null
 if(text.startsWith('+')){const digits=text.slice(1);if(!/^\d+$/.test(digits))return null;if(digits.startsWith('39'))return italian(digits.slice(2));return /^[1-9]\d{7,14}$/.test(digits)?'+'+digits:null}
 if(!/^\d+$/.test(text))return null
 // 39 + cellulare (es. 393331234567): il prefisso senza «+». Un cellulare nazionale ha 9–10 cifre (anche 393…), quindi 11–12 cifre che iniziano per 393 sono prefisso + cellulare.
 if(/^393\d{8,9}$/.test(text))return '+'+text
 return italian(text)
}
export const whatsappAddress=(e164:string)=>'whatsapp:'+e164
export const phoneTail=(phone:string)=>phone.replace(/\D/g,'').slice(-3)
