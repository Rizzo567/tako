/** Only provider calls receive this wrapper; persistence and WhatsApp send failures never retry translation. */
export class OnboardingTranslationFailure extends Error {
 constructor(readonly diagnostic: {kind:'rate_limit'|'provider'|'timeout'|'network'|'validation';status:number|null;language:string;retryAfterMs?:number},readonly transient:boolean){super('Onboarding translation failed');this.name='OnboardingTranslationFailure'}
}
/** Consecutive automatic retries without progress. Any translated language resets the counter (new continuation). */
export const MAX_TRANSLATION_RETRIES=6
/** Provider wait hint (Retry-After or Groq reset headers), bounded; works with Headers and plain objects. */
export function providerRetryAfterMs(headers:unknown):number|undefined{
 const get=(name:string)=>{const h=headers as any;if(!h)return '';if(typeof h.get==='function')return String(h.get(name)??'');const v=h[name]??h[name.toLowerCase()];return typeof v==='string'?v:''}
 const direct=Number(get('retry-after'));if(Number.isFinite(direct)&&direct>0)return Math.min(120000,Math.ceil(direct*1000))
 const reset=get('x-ratelimit-reset-tokens')||get('x-ratelimit-reset-requests'),m=reset.match(/^(?:(\d+)m)?(?:([\d.]+)s)?$/)
 return reset&&m?Math.min(120000,Math.ceil((Number(m[1]||0)*60+Number(m[2]||0))*1000)):undefined
}
export function classifyOnboardingTranslationFailure(error:unknown,language:string){
 const e=error as {status?:unknown;name?:unknown;code?:unknown;cause?:{code?:unknown};headers?:unknown}|null;
 const status=typeof e?.status==='number'&&Number.isInteger(e.status)&&e.status>=100&&e.status<=599?e.status:null;
 const name=typeof e?.name==='string'?e.name:'',code=typeof e?.code==='string'?e.code:typeof e?.cause?.code==='string'?e.cause.code:'';
 const timeout=['APIConnectionTimeoutError','TimeoutError','AbortError'].includes(name)||['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(code);
 const network=name==='APIConnectionError'||['ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','EPIPE'].includes(code);
 const kind=status===429?'rate_limit':status!==null&&status>=500?'provider':timeout?'timeout':network?'network':'validation';
 const retryAfterMs=kind==='rate_limit'?providerRetryAfterMs(e?.headers):undefined
 return new OnboardingTranslationFailure({kind,status,language:/^[a-z]{2,3}$/.test(language)?language:'unknown',...(retryAfterMs?{retryAfterMs}:{})},kind!=='validation');
}
/** Retries done so far in this continuation chain; legacy '1' counts as one, garbage as exhausted. */
export function onboardingTranslationRetries(form:Record<string,string>){const raw=form.OnboardingTranslationRetry;if(!raw)return 0;const n=Number(raw);return Number.isSafeInteger(n)&&n>=0?n:MAX_TRANSLATION_RETRIES}
export function shouldRetryOnboardingTranslation(error:unknown,form:Record<string,string>){
 return error instanceof OnboardingTranslationFailure&&error.transient&&onboardingTranslationRetries(form)<MAX_TRANSLATION_RETRIES;
}
/** Exponential backoff that honours the provider hint; bounded so one edge invocation can wait for it. */
export function onboardingRetryDelayMs(retries:number,retryAfterMs?:number,env:NodeJS.ProcessEnv=process.env){
 const base=Number(env.TAKO_ONBOARDING_RETRY_BASE_MS??5000),max=Number(env.TAKO_ONBOARDING_RETRY_MAX_MS??45000)
 return Math.max(0,Math.min(max,Math.max(retryAfterMs??0,base*2**Math.max(0,retries))))
}
