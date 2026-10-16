import {expect,it,vi} from 'vitest'
import {PgDialect} from '../apps/server/node_modules/drizzle-orm/pg-core/index.js'
vi.mock('@tako/db',()=>({db:{}}))
vi.mock('../apps/server/src/lib/agency-access.js',()=>({isAgencyUser:()=>true}))
import {redeemAgencyOnboardingCode} from '../apps/server/src/lib/onboarding-lifecycle.js'
import {updateOnboarding} from '../apps/server/src/lib/onboarding-store.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
const actor='44444444-4444-4444-8444-444444444444',id='33333333-3333-4333-8333-333333333333',oldPhone='whatsapp:+390000000011',newPhone='whatsapp:+390000000022',dialect=new PgDialect()
it('rejects the former-phone worker snapshot after an authorized handoff without overwriting saved materials',async()=>{
 process.env.TWILIO_WHATSAPP_NUMBER='whatsapp:+18382622788';const data={name:'Locale riservato',slug:'locale-riservato',workspace:workspaceSchema.parse({menus:[]}),warnings:[],unresolved:[]},row={id,actorId:actor,phone:oldPhone,state:'collecting',revision:5,data:structuredClone(data)},before=structuredClone(row),calls:string[]=[];let used=false;
 const execute=async(q:any):Promise<any[]>=>{const {sql,params}=dialect.sqlToQuery(q);calls.push(sql);
  if(sql.startsWith('SELECT tako_purge')||sql.includes('pg_advisory_xact_lock'))return[];
  if(sql.startsWith('SELECT l.actor_id'))return[{actor_id:actor}];
  if(sql.startsWith('SELECT session_id FROM tako_onboarding_agency_tokens'))return used?[]:[{session_id:id}];
  if(sql.startsWith('SELECT t.actor_id,t.session_id'))return used?[]:[{actor_id:actor,session_id:id}];
  if(sql.startsWith('SELECT id FROM tako_onboarding_sessions'))return row.phone===newPhone?[{id}]:[];
  if(sql.startsWith('UPDATE tako_onboarding_sessions SET phone=')){row.phone=String(params[0]);row.revision++;return[{id}]}
  if(sql.startsWith('UPDATE tako_onboarding_tokens'))return[];
  if(sql.startsWith('UPDATE tako_onboarding_agency_tokens')){used=true;return[]}
  if(sql.startsWith('SELECT id FROM users'))return[{id:actor}];
  if(sql.startsWith('UPDATE tako_onboarding_sessions SET data=')){const expected=Number(params[4]);if(row.revision!==expected)return[];row.data=JSON.parse(String(params[0]));row.revision++;return[structuredClone(row)]}
  throw Error('Unexpected SQL '+sql)
 };
 const db={execute,transaction:async(fn:any)=>fn({execute})};expect(await redeemAgencyOnboardingCode(actor,newPhone,'riprendi onboarding '+'a'.repeat(64),db as any)).toEqual({id});expect(row.phone).toBe(newPhone);expect(row.revision).toBe(before.revision+1);
 const formerWorker={...data,name:'Stale overwrite'};await expect(updateOnboarding(id,actor,before.revision,formerWorker,'collecting',db as any)).rejects.toMatchObject({code:'CONFLICT'});expect(row.data).toEqual(before.data);expect(row.phone).toBe(newPhone);expect(row.revision).toBe(6);
 expect(calls.some(sql=>sql.includes('onboarding_agency_tokens SET used_at=now() WHERE session_id='))).toBe(true);expect(calls.some(sql=>sql.includes("kind='preview' AND used_at IS NULL"))).toBe(true)
})
