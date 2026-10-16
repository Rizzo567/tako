import {describe,expect,it} from 'vitest'
import {extractOnboardingMessage,OnboardingBusy} from '../apps/server/src/lib/onboarding-planner.js'
// 15/10 sera: Groq free tier returned 429 (tokens per minute, then tokens per day) and the step failed.
const ok=(content:unknown)=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}),{status:200})
const busy=(retryAfter:string)=>new Response('{}',{status:429,headers:{'retry-after':retryAfter}})
describe('onboarding extractor under provider rate limits',()=>{
 it('waits a short per-minute window on the same model',async()=>{const models:string[]=[];let n=0;const fetcher=(async(_u:string,init:any)=>{models.push(JSON.parse(init.body).model);return n++===0?busy('1'):ok({name:'Collaudo Finale'})}) as any
  expect(await extractOnboardingMessage('Il locale si chiama Collaudo Finale',' k',fetcher)).toMatchObject({name:'Collaudo Finale'});expect(models).toEqual(['openai/gpt-oss-120b','openai/gpt-oss-120b'])})
 it('moves to the fallback model when the primary is out of quota for long (tokens per day)',async()=>{const models:string[]=[];const fetcher=(async(_u:string,init:any)=>{const model=JSON.parse(init.body).model;models.push(model);return model==='openai/gpt-oss-120b'?busy('1014'):ok({name:'Collaudo Finale'})}) as any
  expect(await extractOnboardingMessage('Il locale si chiama Collaudo Finale','k',fetcher)).toMatchObject({name:'Collaudo Finale'});expect(models).toEqual(['openai/gpt-oss-120b','openai/gpt-oss-20b'])})
 it('reports busy (resendable) only when every model is out of quota',async()=>{const fetcher=(async()=>busy('1014')) as any;await expect(extractOnboardingMessage('Il locale si chiama X','k',fetcher)).rejects.toBeInstanceOf(OnboardingBusy)})
 it('a fallback that answers with an error still reports busy, not a generic failure',async()=>{const fetcher=(async(_u:string,init:any)=>JSON.parse(init.body).model==='openai/gpt-oss-120b'?busy('1014'):new Response('{}',{status:400})) as any;await expect(extractOnboardingMessage('Il locale si chiama X','k',fetcher)).rejects.toBeInstanceOf(OnboardingBusy)})
})
