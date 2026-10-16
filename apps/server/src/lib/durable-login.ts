import { createHmac, randomUUID } from 'node:crypto'
import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
export type LoginOutcome='success'|'failure'|'abandon'
export type LoginExecutor={reserve(id:string,pair:string,ip:string):Promise<boolean>;finish(id:string,outcome:LoginOutcome):Promise<boolean>}
const unavailable=()=>Object.assign(new Error('Login protection unavailable'),{statusCode:503,code:'RATE_STORE_UNAVAILABLE'})
export function loginGuard(execute:LoginExecutor,secret:string){
 if(secret.length<32)throw new Error('Durable login requires dedicated secret')
 const hash=(value:string)=>createHmac('sha256',secret).update(`tako-login-v1:${value}`).digest('hex')
 return {async reserve(ip:string,email:string){const id=randomUUID();try{if(!await execute.reserve(id,hash(`pair:${ip}\0${email.toLowerCase()}`),hash(`ip:${ip}`)))return null}catch{throw unavailable()}
 return {async finish(outcome:LoginOutcome){try{if(!await execute.finish(id,outcome))throw unavailable()}catch{throw unavailable()}}}}}
}
export function optionalLoginGuard(){
 if(process.env.TAKO_DURABLE_RATE_LIMIT!=='1')return undefined
 if(process.env.TAKO_EXECUTION_RUNTIME!=='edge'||!process.env.DATABASE_URL)throw new Error('Durable login requires Edge database')
 return loginGuard({
 async reserve(id,pair,ip){const rows=await db.execute(sql`select public.reserve_edge_login(${id}::uuid,${pair},${ip}) as allowed`);return rows[0]?.allowed===true},
 async finish(id,outcome){const rows=await db.execute(sql`select public.finish_edge_login(${id}::uuid,${outcome}) as completed`);return rows[0]?.completed===true},
 },process.env.TAKO_RATE_LIMIT_SECRET??'')
}
