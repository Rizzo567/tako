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
