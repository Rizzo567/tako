import {createHmac,timingSafeEqual} from 'node:crypto'
import {Buffer} from 'node:buffer'

const ORIGIN='https://takoitalia.com'
const TTL_SECONDS=300
const SID=/^(?:OB|SM|MM)[a-f0-9]{32}$/
export type OnboardingDispatchOptions={env?:NodeJS.ProcessEnv;now?:()=>number}
function key(options:OnboardingDispatchOptions):string{
 const value=(options.env??process.env).JWT_SECRET??''
 if(value.length<32)throw Error('Onboarding dispatch requires JWT_SECRET of at least 32 characters')
 return value
}
function epoch(options:OnboardingDispatchOptions){return Math.floor((options.now??Date.now)()/1000)}
function validExpiry(expires:number,options:OnboardingDispatchOptions){const now=epoch(options);return Number.isSafeInteger(expires)&&expires>now&&expires<=now+TTL_SECONDS}
function mac(sid:string,expires:number,secret:string){return createHmac('sha256',secret).update(`takomenu:onboarding-dispatch:v1:${sid}:${expires}`).digest('hex')}
/** Expiry is Unix seconds. Domain-separated HMAC authorizes exactly one internal job ID.
 * It is never a user session and never signs a caller-selected destination. */
export function signOnboardingDispatch(sid:string,expires?:number,options:OnboardingDispatchOptions={}):{signature:string;expires:number}{
 const until=expires??epoch(options)+TTL_SECONDS
 if(!SID.test(sid)||!validExpiry(until,options))throw Error('Invalid onboarding dispatch job or expiry')
 return{signature:mac(sid,until,key(options)),expires:until}
}
/** Fail closed before the caller looks up a job or starts any background work. */
export function verifyOnboardingDispatch(sid:unknown,expires:unknown,signature:unknown,options:OnboardingDispatchOptions={}):boolean{
 if(typeof sid!=='string'||!SID.test(sid)||typeof expires!=='number'||!validExpiry(expires,options)||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return false
 try{return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(mac(sid,expires,key(options)),'hex'))}catch{return false}
}
/** Requests a fresh edge invocation for an already persisted pending job.
 * A failed/slow dispatch leaves that job pending for explicit RIPRENDI; no data is discarded.
 * The HTTP endpoint must verify the signature, claim the job and acknowledge promptly.
 */
export async function dispatchOnboardingJob(sid:string,options:OnboardingDispatchOptions&{fetcher?:typeof fetch}={}):Promise<boolean>{
 let proof:{signature:string;expires:number};try{proof=signOnboardingDispatch(sid,undefined,options)}catch{return false}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000)
 try{
  const response=await(options.fetcher??fetch)(`${ORIGIN}/api/onboarding/jobs/${sid}/run`,{
   method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(proof),redirect:'error',signal:controller.signal,
  })
  await response.body?.cancel()
  return response.ok
 }catch{return false}finally{clearTimeout(timer)}
}
