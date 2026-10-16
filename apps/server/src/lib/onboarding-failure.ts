import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {phoneTail} from './whatsapp-phone.js'
/** Non-sensitive cause of a failed onboarding job: never message text, prices, names or provider bodies. */
export type OnboardingFailureCause='quota'|'parse'|'provider'|'timeout'|'store'|'merge'|'translation'|'other'
export function onboardingFailureCause(error:unknown):{cause:OnboardingFailureCause;detail:string}{
 const e=error as {name?:unknown;code?:unknown;cause_?:unknown;detail?:unknown;retryAfterMs?:unknown;diagnostic?:{kind?:unknown;status?:unknown};issues?:{path?:unknown[];code?:unknown}[]}|null
 const name=typeof e?.name==='string'?e.name:'Error'
 if(name==='OnboardingBusy')return{cause:'quota',detail:'provider rate limit'+(typeof e?.retryAfterMs==='number'?` retry-after ${Math.round(e.retryAfterMs/1000)}s`:'')}
 if(name==='OnboardingModelError'){const cause=e?.cause_==='parse'||e?.cause_==='timeout'?e.cause_:'provider';return{cause,detail:String(e?.detail??'').slice(0,120)}}
 if(name==='OnboardingTranslationFailure')return{cause:'translation',detail:`${String(e?.diagnostic?.kind??'')} ${String(e?.diagnostic?.status??'')}`.trim()}
 if(typeof e?.code==='string'&&/^(?:CONFLICT|VALIDATION|NOT_FOUND|FORBIDDEN|SLUG_EXISTS)$/.test(e.code))return{cause:'store',detail:e.code}
 if(name==='ZodError'||Array.isArray(e?.issues))return{cause:'merge',detail:'schema '+(e?.issues||[]).slice(0,3).map(i=>(Array.isArray(i.path)?i.path.join('.'):'')+':'+String(i.code??'')).join(',')}
 return{cause:'other',detail:name.slice(0,60)}
}
/** Records the cause in tako_whatsapp_errors (insert only: the agency already gets a reply in chat). Never throws. */
export async function recordOnboardingFailure(error:unknown,phone:string,note?:string){
 try{const {cause,detail}=onboardingFailureCause(error);await db.execute(sql`INSERT INTO tako_whatsapp_errors(kind,restaurant_id,phone_tail,detail,alerted) VALUES(${'onboarding_'+cause},${null},${phoneTail(phone)},${(note?note+' · ':'')+detail.replace(/\+?\d{9,15}/g,'…').slice(0,160)},${false})`);console.error(JSON.stringify({event:'onboarding_failure',cause}));return cause}
 catch{return null}
}
