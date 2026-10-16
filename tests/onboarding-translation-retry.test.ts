import {describe,it,expect} from 'vitest'
import {classifyOnboardingTranslationFailure as classify,shouldRetryOnboardingTranslation as retry} from '../apps/server/src/lib/onboarding-translation-retry.js'
describe('translation error retry classification',()=>{
 it.each([{status:429},{status:500},{status:503},{name:'APIConnectionTimeoutError'},{name:'APIConnectionError'},{code:'ECONNRESET'},{cause:{code:'ETIMEDOUT'}}])('retries a transient error a bounded number of times: %j',error=>{const e=classify(error,'nl');expect(retry(e,{})).toBe(true);expect(retry(e,{OnboardingTranslationRetry:'1'})).toBe(true);expect(retry(e,{OnboardingTranslationRetry:'5'})).toBe(true);expect(retry(e,{OnboardingTranslationRetry:'6'})).toBe(false);expect(retry(e,{OnboardingTranslationRetry:'garbage'})).toBe(false)})
 it.each([{status:400},{status:401},{status:403},new SyntaxError('JSON'),{name:'ZodError'},new Error('unknown')])('does not retry unknown or validation errors: %j',error=>expect(retry(classify(error,'nl'),{})).toBe(false))
 it('stores only a bounded sanitized diagnostic',()=>expect(classify({status:429,message:'secret',request:'private'},'nl').diagnostic).toEqual({kind:'rate_limit',status:429,language:'nl'}))
})
