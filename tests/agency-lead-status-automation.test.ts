import {it,expect} from 'vitest'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import * as schema from '../packages/db/src/schema/index.js'
import {createAgencyLeadStore,LeadError,leadPatchSchema} from '../apps/server/src/lib/agency-leads.js'
import {isTrialRestaurant} from '../apps/server/src/lib/menu-workspace-store.js'

it('schema: la rimozione accompagna solo lo stato Rifiutato',()=>{
 expect(leadPatchSchema.safeParse({revision:1,status:'not_interested',removeTrial:true}).success).toBe(true)
 expect(leadPatchSchema.safeParse({revision:1,status:'trial',removeTrial:true}).success).toBe(false)
 expect(leadPatchSchema.safeParse({revision:1,removeTrial:false}).success).toBe(false)
})

it('Prova attiva sblocca il PROVA nella stessa transazione; Rifiutato+rimozione disattiva solo i PROVA, in modo recuperabile',async()=>{
 const directory=mkdtempSync(tmpdir()+'/tako-lead-auto-'),run=(name:string,args:string[])=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/'+name,args,{stdio:'pipe'});let client:ReturnType<typeof postgres>|undefined,started=false
 try{
 run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8']);run('pg_ctl',['-D',directory+'/data','-l',directory+'/log','-o',`-k ${directory} -p 55463 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55463,database:'postgres',username:process.env.USER,max:1,onnotice:()=>{}})
 await client.unsafe(`CREATE TABLE restaurants(id uuid PRIMARY KEY,name text,active boolean DEFAULT true,settings jsonb,updated_at timestamptz DEFAULT now());
 CREATE TABLE menu_workspaces(restaurant_id uuid PRIMARY KEY,draft jsonb,published jsonb,revision int,published_revision int);
 CREATE TABLE tako_agency_leads(id text PRIMARY KEY,source_id text,source jsonb DEFAULT '{}',status text,notes text,assignee text,next_contact_at timestamptz,restaurant_id uuid,demo_token_hash text,revision int DEFAULT 1,updated_at timestamptz DEFAULT now());
 CREATE TABLE web_session_locations(session_token text PRIMARY KEY,restaurant_id uuid);
 CREATE TABLE tako_agency_lead_activities(id uuid PRIMARY KEY,lead_id text,type text,outcome text,text text,actor_id uuid,created_at timestamptz DEFAULT now());`)
 const store=createAgencyLeadStore(drizzle(client,{schema}) as any),actor=randomUUID(),draft={languages:['it'],defaultLanguage:'it',menus:[]}
 const mk=async(lead:string,settings:object|null)=>{const rid=randomUUID(),token=randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,'');if(settings){await client!`INSERT INTO restaurants(id,name,settings) VALUES(${rid},${'Locale '+lead},${JSON.stringify(settings)}::jsonb)`;await client!`INSERT INTO menu_workspaces(restaurant_id,draft,revision) VALUES(${rid},${JSON.stringify(draft)}::jsonb,1)`}
  await client!`INSERT INTO tako_agency_leads(id,source_id,status,restaurant_id,demo_token_hash) VALUES(${lead},${lead},'demo_ready',${settings?rid:null},${createHash('sha256').update(token).digest('hex')})`;return{rid,token}}
 const settings=async(rid:string)=>(await client!`SELECT active,settings FROM restaurants WHERE id=${rid}`)[0]!
 const conn=drizzle(client,{schema})
 // 1) Prova attiva → pubblicabile, link di prova ancora valido; tornare indietro non riblocca e lascia una nota.
 const a=await mk('ZA1',{takomenuTrial:true,trialLeadId:'ZA1'})
 expect((await store.preview(a.token)).data.isTrial).toBe(true)
 const s1=await store.patch('ZA1',{revision:1,status:'trial'},actor);expect(s1.data.status).toBe('trial')
 expect(await isTrialRestaurant(a.rid,conn)).toBe(false);expect((await settings(a.rid)).settings.trialActivatedAt).toBeTruthy()
 expect((await store.preview(a.token)).data.name).toBe('Locale ZA1')
 await store.patch('ZA1',{revision:2,status:'follow_up'},actor)
 expect(await isTrialRestaurant(a.rid,conn)).toBe(false)
 expect((await client`SELECT text FROM tako_agency_lead_activities WHERE lead_id='ZA1'`).length).toBe(1)
 // Lead diventato Cliente: il locale non si rimuove più, rifiuto senza scritture.
 await store.patch('ZA1',{revision:3,status:'customer'},actor)
 await expect(store.patch('ZA1',{revision:4,status:'not_interested',removeTrial:true},actor)).rejects.toMatchObject({code:'NOT_TRIAL'})
 expect((await settings(a.rid)).active).toBe(true);expect((await client`SELECT status,revision FROM tako_agency_leads WHERE id='ZA1'`)[0]).toMatchObject({status:'customer',revision:4})
 // Prova attiva poi Rifiutato (prova finita senza contratto): rimovibile.
 const f=await mk('ZF1',{takomenuTrial:true,trialLeadId:'ZF1'});await store.patch('ZF1',{revision:1,status:'trial'},actor);await store.patch('ZF1',{revision:2,status:'not_interested',removeTrial:true},actor)
 expect((await settings(f.rid)).active).toBe(false);await expect(store.preview(f.token)).rejects.toBeInstanceOf(LeadError)
 // Locale con trialLeadId di un altro lead: rifiuto.
 const g=await mk('ZG1',{takomenuTrial:true,trialLeadId:'ALTRO'});await expect(store.patch('ZG1',{revision:1,status:'not_interested',removeTrial:true},actor)).rejects.toMatchObject({code:'NOT_TRIAL'});expect((await settings(g.rid)).active).toBe(true)
 // 2) Rifiutato + rimozione su PROVA: disattivato, marcato, dati conservati, link 404, lead resta Rifiutato.
 const b=await mk('ZB1',{takomenuTrial:true,trialLeadId:'ZB1'})
 await client`INSERT INTO web_session_locations VALUES('sess-b',${b.rid}),('sess-other',${randomUUID()})`
 const s2=await store.patch('ZB1',{revision:1,status:'not_interested',removeTrial:true},actor);expect(s2.data.status).toBe('not_interested')
 const rb=await settings(b.rid);expect(rb.active).toBe(false);expect(rb.settings).toMatchObject({takomenuTrial:true,takomenuRemoved:true,takomenuRemovedBy:actor,takomenuRemovedLeadId:'ZB1'})
 expect((await client`SELECT count(*)::int n FROM menu_workspaces WHERE restaurant_id=${b.rid}`)[0]!.n).toBe(1)
 await expect(store.preview(b.token)).rejects.toBeInstanceOf(LeadError)
 expect((await client`SELECT session_token FROM web_session_locations`).map(r=>r.session_token)).toEqual(['sess-other'])
 expect(await isTrialRestaurant(b.rid,conn)).toBe(true)
 // Ripristino documentato: riattiva e torna visibile.
 await client`UPDATE restaurants SET active=true,settings=settings-'takomenuRemoved'-'takomenuRemovedAt'-'takomenuRemovedBy'-'takomenuRemovedLeadId'-'takomenuRemovedPreviousActive' WHERE id=${b.rid}`
 expect((await store.preview(b.token)).data.name).toBe('Locale ZB1')
 // 3) Stato Rifiutato senza rimozione: solo lo stato. Lead senza locale + rimozione: rifiuto.
 const c=await mk('ZC1',{takomenuTrial:true,trialLeadId:'ZC1'});await store.patch('ZC1',{revision:1,status:'not_interested'},actor);expect((await settings(c.rid)).active).toBe(true)
 await mk('ZD1',null);await expect(store.patch('ZD1',{revision:1,status:'not_interested',removeTrial:true},actor)).rejects.toMatchObject({code:'NOT_TRIAL'})
 // 4) Cliente vero (nessun flag): rifiuto.
 const e=await mk('ZE1',{languages:['it']});await expect(store.patch('ZE1',{revision:1,status:'not_interested',removeTrial:true},actor)).rejects.toMatchObject({code:'NOT_TRIAL'});expect((await settings(e.rid)).active).toBe(true)
 }finally{await client?.end();if(started)run('pg_ctl',['-D',directory+'/data','-m','immediate','stop']);rmSync(directory,{recursive:true,force:true})}
},60000)
