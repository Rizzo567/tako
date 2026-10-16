import {describe,expect,it} from 'vitest'
import {databaseOptions} from '../packages/db/src/client.js'
describe('Edge database options without connections',()=>{
 it('preserves Node defaults',()=>expect(databaseOptions({})).toEqual({}))
 it('preserves Node file CA with strict verification',()=>expect(databaseOptions({DATABASE_CA_CERT_PATH:'/ca'},()=> 'test-ca')).toEqual({ssl:{ca:'test-ca',rejectUnauthorized:true}}))
 it('limits Edge transaction pooling and keeps TLS verification on',()=>expect(databaseOptions({TAKO_EXECUTION_RUNTIME:'edge',DATABASE_URL:'postgresql://fixture.invalid/tako'})).toEqual({max:1,prepare:false,idle_timeout:5,max_lifetime:60,connect_timeout:10,ssl:{rejectUnauthorized:true}}))
 it('uses inline CA before any local path without filesystem access',()=>expect(databaseOptions({TAKO_EXECUTION_RUNTIME:'edge',DATABASE_URL:'postgresql://fixture.invalid/tako',DATABASE_CA_CERT:'inline-ca',DATABASE_CA_CERT_PATH:'/missing'},()=>{throw Error('must not read')})).toEqual({max:1,prepare:false,idle_timeout:5,max_lifetime:60,connect_timeout:10,ssl:{ca:'inline-ca',rejectUnauthorized:true}}))
 it('rejects missing Edge connection string and filesystem-only CA',()=>{expect(()=>databaseOptions({TAKO_EXECUTION_RUNTIME:'edge'})).toThrow('requires DATABASE_URL');expect(()=>databaseOptions({TAKO_EXECUTION_RUNTIME:'edge',DATABASE_URL:'postgresql://fixture.invalid/tako',DATABASE_CA_CERT_PATH:'/ca'})).toThrow('inline DATABASE_CA_CERT')})
})
