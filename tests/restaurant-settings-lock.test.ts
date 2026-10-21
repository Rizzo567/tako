// PATCH /api/restaurants/me (21/10/2026): il merge di restaurants.settings avviene in transazione con la riga bloccata
// (SELECT … FOR UPDATE) e le chiavi scritte da altre route (pdfDocuments, botEngine, botBrain…) non vengono mai
// riscritte con un valore vecchio. Route vera (requireRole + Fastify) su un finto database in memoria con un lock di riga.
import {createRequire} from 'node:module'
import {describe,it,expect,vi,beforeEach} from 'vitest'
const state=vi.hoisted(()=>({settings:{} as any,rows:new Map<unknown,any[]>(),log:[] as string[],lock:null as Promise<void>|null,release:null as null|(()=>void),afterSelect:null as null|(()=>Promise<void>)}))
const chunksText=(query:any)=>{try{return JSON.stringify(query?.queryChunks??'')}catch{return ''}}
vi.mock('../packages/db/src/index.ts',async importOriginal=>{
 const real:any=await importOriginal()
 const chain=()=>{let table:unknown;const q:any={from(t:unknown){table=t;return q},where(){return q},orderBy(){return q},limit(){return q},innerJoin(){return q},then(res:any,rej:any){return Promise.resolve(state.rows.get(table)??[]).then(res,rej)}};return q}
 const acquire=async()=>{while(state.lock)await state.lock;state.lock=new Promise<void>(r=>{state.release=()=>{state.lock=null;state.release=null;r()}})}
 const update=()=>({set(data:any){return {where(){const apply=()=>{if(data.settings)state.settings=structuredClone(data.settings);state.log.push('update');return [{id:'r1',settings:structuredClone(state.settings)}]};return {returning:async()=>apply(),then:(a:any,b:any)=>Promise.resolve().then(apply).then(a,b)}}}}})
 const execute=async(query:any)=>{const text=chunksText(query)
  if(text.includes('FOR UPDATE')){await acquire();state.log.push('select-for-update');const rows=[{settings:structuredClone(state.settings)}];if(state.afterSelect){const f=state.afterSelect;state.afterSelect=null;await f()}return rows}
  return []}
 const transaction=async(fn:any)=>{try{return await fn({execute,update,select(){return chain()}})}finally{state.log.push('commit');state.release?.()}}
 return {...real,db:{select(){return chain()},execute,update,transaction}}
})
vi.mock('../apps/server/src/index.js',()=>({io:{}}))
import {sessions} from '../packages/db/src/index.ts'
import {restaurantRoutes,mergeRestaurantSettings,SYSTEM_SETTINGS_KEYS} from '../apps/server/src/routes/restaurants.js'
const Fastify=createRequire(new URL('../apps/server/package.json',import.meta.url))('fastify')
const tenant='11111111-1111-4111-8111-111111111111'
const auth={authorization:'Bearer short-token'}
async function app(){const a=Fastify();await a.register(restaurantRoutes as any,{prefix:'/api/restaurants'});await a.ready();return a}
// Scrittura «di sistema» di un'altra route (es. PDF salvati): aspetta il lock della riga come farebbe Postgres.
async function otherRouteWrites(key:string,value:unknown){while(state.lock)await state.lock;state.settings={...state.settings,[key]:value};state.log.push('other-write:'+key)}
beforeEach(()=>{
 state.settings={timezone:'Europe/Rome',vatRate:10,pdfDocuments:[{id:'d1',name:'Cena',menuIds:['m1'],shareToken:'tok-old'}],botEngine:'anthropic',botBrain:true}
 state.log=[];state.lock=null;state.release=null;state.afterSelect=null
 state.rows=new Map<unknown,any[]>([[sessions,[{session:{token:'short-token',expiresAt:new Date('2099-01-01T00:00:00Z'),kind:'staff'},user:{id:'22222222-2222-4222-8222-222222222222',name:'Gio',email:'g@example.com',role:'owner',restaurantId:tenant,active:true}}]]])
})

describe('mergeRestaurantSettings',()=>{
 it('le chiavi di sistema non mandate restano quelle correnti; le altre si fondono',()=>{
  const current={vatRate:10,pdfDocuments:[{id:'d1'}],botEngine:'anthropic',botBrain:false,takomenuTrial:true}
  expect(mergeRestaurantSettings(current,{vatRate:22,printerIp:'10.0.0.2'})).toEqual({vatRate:22,printerIp:'10.0.0.2',pdfDocuments:[{id:'d1'}],botEngine:'anthropic',botBrain:false,takomenuTrial:true})
 })
 it('una chiave di sistema mandata esplicitamente vince; una assente nel database non viene inventata',()=>{
  expect(mergeRestaurantSettings({botBrain:false},{botBrain:true})).toEqual({botBrain:true})
  expect(mergeRestaurantSettings(null,{vatRate:4})).toEqual({vatRate:4})
  expect(mergeRestaurantSettings([1,2] as any,{vatRate:4})).toEqual({vatRate:4})
 })
 it('elenco delle chiavi di sistema comprende PDF e bot',()=>{for(const k of ['pdfDocuments','botEngine','botBrain'])expect(SYSTEM_SETTINGS_KEYS).toContain(k)})
})

describe('PATCH /api/restaurants/me',()=>{
 it('legge le impostazioni con FOR UPDATE dentro la transazione e le scrive prima del commit',async()=>{
  const a=await app();const r=await a.inject({method:'PATCH',url:'/api/restaurants/me',headers:auth,payload:{settings:{vatRate:22}}})
  expect(r.statusCode).toBe(200);expect(state.log).toEqual(['select-for-update','update','commit'])
  expect(state.settings).toMatchObject({vatRate:22,timezone:'Europe/Rome',botEngine:'anthropic',botBrain:true});expect(state.settings.pdfDocuments[0].shareToken).toBe('tok-old')
  await a.close()
 })
 it('un PDF salvato mentre il titolare salva non viene perso: l’altra scrittura aspetta il commit e resta',async()=>{
  const a=await app();let other:Promise<void>|null=null
  state.afterSelect=async()=>{other=otherRouteWrites('pdfDocuments',[{id:'d1',name:'Cena',menuIds:['m1'],shareToken:'tok-new'}]);await new Promise(r=>setTimeout(r,20))}
  const r=await a.inject({method:'PATCH',url:'/api/restaurants/me',headers:auth,payload:{settings:{printerIp:'192.168.1.50'}}});await other
  expect(r.statusCode).toBe(200);expect(state.log).toEqual(['select-for-update','update','commit','other-write:pdfDocuments'])
  expect(state.settings.printerIp).toBe('192.168.1.50');expect(state.settings.pdfDocuments[0].shareToken).toBe('tok-new')
  await a.close()
 })
 it('il client non può riscrivere chiavi di sistema con dati vecchi (pdfDocuments, botEngine, botBrain ignorati)',async()=>{
  const a=await app();const r=await a.inject({method:'PATCH',url:'/api/restaurants/me',headers:auth,payload:{settings:{vatRate:5,pdfDocuments:[],botEngine:'groq',botBrain:false}}})
  expect(r.statusCode).toBe(200);expect(state.settings).toMatchObject({vatRate:5,botEngine:'anthropic',botBrain:true});expect(state.settings.pdfDocuments).toHaveLength(1)
  await a.close()
 })
 it('senza settings nel corpo non blocca né rilegge le impostazioni',async()=>{
  const a=await app();const r=await a.inject({method:'PATCH',url:'/api/restaurants/me',headers:auth,payload:{name:'Victoria'}})
  expect(r.statusCode).toBe(200);expect(state.log).toEqual(['update','commit']);expect(state.settings.pdfDocuments).toHaveLength(1)
  await a.close()
 })
 it('solo il titolare',async()=>{
  state.rows.get(sessions)![0].user.role='cameriere'
  const a=await app();const r=await a.inject({method:'PATCH',url:'/api/restaurants/me',headers:auth,payload:{settings:{vatRate:1}}})
  expect(r.statusCode).toBe(403);expect(state.settings.vatRate).toBe(10);await a.close()
 })
})
