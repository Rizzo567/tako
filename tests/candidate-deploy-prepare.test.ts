import {it,expect} from 'vitest'
import {candidateSecretNames,validateCandidateSecrets} from '../scripts/serverless/prepare-candidate-deploy.mjs'
it('accepts only complete scoped candidate configuration',()=>{
 expect(candidateSecretNames.every(name=>name.startsWith('TAKO_CANDIDATE_'))).toBe(true)
 expect(()=>validateCandidateSecrets({DATABASE_URL:'generic'})).toThrow('TAKO_CANDIDATE_DATABASE_URL')
 const values=Object.fromEntries(candidateSecretNames.map(name=>[name,'x'.repeat(40)]))
 values.TAKO_CANDIDATE_WEB_ORIGIN='https://staging.example.test'
 values.TAKO_CANDIDATE_TAKO_IMAGE_SEEDS_JSON='[{"tenantId":"fixture","checkpoint":"checkpoint"}]'
 expect(validateCandidateSecrets(values)).toEqual(candidateSecretNames)
 values.TAKO_CANDIDATE_TAKO_IMAGE_SEEDS_JSON='[]'
 expect(()=>validateCandidateSecrets(values)).toThrow('seed')
})
it('includes the bot engine env names in both closed lists (Haiku 21/10)',async()=>{
 const {candidateEntry}=await import('../scripts/serverless/candidate-entry.mjs')
 const entry=candidateEntry({appEntry:'/a.ts',initializerEntry:'/i.ts',fontInitializerEntry:'/f.ts',bridgeEntry:'/b.ts'})
 // 22/10: foto salvate senza ricodifica → avvio solo-quota registrato accanto a quello completo (codec WASM)
 expect(entry).toContain('imageStore.configureImageQuotaInitializer(');expect(entry).toContain('initializeEdgeImageQuota()')
 for(const key of ['ANTHROPIC_API_KEY','TAKO_BOT_ENGINE_DEFAULT','GROQ_API_KEY']){
  expect(entry).toContain(`'${key}'`)
 }
 for(const key of ['ANTHROPIC_API_KEY','TAKO_BOT_ENGINE_DEFAULT'])expect(candidateSecretNames).toContain('TAKO_CANDIDATE_'+key)
 // Optional: a missing Anthropic key must not block validation of the required set.
 const values=Object.fromEntries(candidateSecretNames.filter(n=>!/ANTHROPIC|BOT_ENGINE/.test(n)).map(name=>[name,'x'.repeat(40)]))
 values.TAKO_CANDIDATE_WEB_ORIGIN='https://staging.example.test'
 values.TAKO_CANDIDATE_TAKO_IMAGE_SEEDS_JSON='[{"tenantId":"fixture","checkpoint":"checkpoint"}]'
 expect(validateCandidateSecrets(values)).not.toContain('TAKO_CANDIDATE_ANTHROPIC_API_KEY')
})
