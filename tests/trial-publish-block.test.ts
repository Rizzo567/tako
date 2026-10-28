import {it,expect} from 'vitest'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import * as schema from '../packages/db/src/schema/index.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {mutateWorkspace,WorkspaceTrialLocked,TRIAL_PUBLISH_BLOCKED_MESSAGE,isTrialRestaurant} from '../apps/server/src/lib/menu-workspace-store.js'

// Menu PROVA (settings.takomenuTrial=true): mai sul menu pubblico, da nessuna strada. La bozza resta salvabile.
it('blocca la pubblicazione di un locale PROVA senza cambiare nulla, salva la bozza e si sblocca col flag a false',async()=>{
 const directory=mkdtempSync(tmpdir()+'/tako-trial-block-'),run=(name:string,args:string[])=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/'+name,args,{stdio:'pipe'});let client:ReturnType<typeof postgres>|undefined,started=false
 try{
 run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8']);run('pg_ctl',['-D',directory+'/data','-l',directory+'/log','-o',`-k ${directory} -p 55461 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55461,database:'postgres',username:process.env.USER,max:1,onnotice:()=>{}})
 await client.unsafe(`CREATE TABLE restaurants(id uuid PRIMARY KEY,settings jsonb);
 CREATE TABLE menus(id uuid PRIMARY KEY,restaurant_id uuid,name text,description text,type text,active boolean,position int,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
 CREATE TABLE menu_sections(id uuid PRIMARY KEY,menu_id uuid REFERENCES menus(id),name text,name_translations jsonb,description text,position int,active boolean);
 CREATE TABLE menu_items(id uuid PRIMARY KEY,section_id uuid REFERENCES menu_sections(id),restaurant_id uuid,name text,name_translations jsonb,description text,description_translations jsonb,price numeric,image_url text,allergens text[],tags text[],calories int,available boolean,featured boolean,position int,kitchen_station text,prep_time_minutes int,cost_price numeric,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
 CREATE TABLE item_variants(id uuid PRIMARY KEY,item_id uuid REFERENCES menu_items(id),name text,price_modifier numeric,available boolean);
 CREATE TABLE menu_item_translations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid,item_id uuid REFERENCES menu_items(id),lang text,name text,description text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now(),UNIQUE(item_id,lang));
 CREATE TABLE menu_workspaces(restaurant_id uuid PRIMARY KEY,draft jsonb,published jsonb,revision int,published_revision int,updated_at timestamp DEFAULT now());
 CREATE TABLE menu_workspace_versions(id uuid PRIMARY KEY,restaurant_id uuid,revision int,label text,snapshot jsonb,created_by uuid);`)
 const connection=drizzle(client,{schema}),actor=randomUUID()
 const fixture=()=>workspaceSchema.parse({languages:['it'],menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Carbonara',price:12}]}]}]})
 const trial=randomUUID(),client2=randomUUID(),w=fixture(),w2=fixture()
 await client`INSERT INTO restaurants(id,settings) VALUES(${trial},${JSON.stringify({takomenuTrial:true,trialLeadId:randomUUID()})}::jsonb),(${client2},${JSON.stringify({takomenuTrial:false})}::jsonb)`
 await client`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${trial},${JSON.stringify(w)}::jsonb,NULL,1,NULL),(${client2},${JSON.stringify(w2)}::jsonb,NULL,1,NULL)`
 const snapshot=async(id:string)=>JSON.stringify({ws:await client!`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${id}`,versions:(await client!`SELECT count(*)::int n FROM menu_workspace_versions WHERE restaurant_id=${id}`)[0]!.n,menus:(await client!`SELECT count(*)::int n FROM menus WHERE restaurant_id=${id}`)[0]!.n,items:(await client!`SELECT count(*)::int n FROM menu_items WHERE restaurant_id=${id}`)[0]!.n})
 expect(await isTrialRestaurant(trial,connection)).toBe(true);expect(await isTrialRestaurant(client2,connection)).toBe(false)
 // 1) Pubblicazione di un PROVA: errore chiaro, nessuna riga toccata.
 const before=await snapshot(trial)
 const blocked=await mutateWorkspace(trial,actor,1,w,true,'Pubblicazione',connection).catch(e=>e)
 expect(blocked).toBeInstanceOf(WorkspaceTrialLocked);expect(blocked.message).toBe(TRIAL_PUBLISH_BLOCKED_MESSAGE);expect(blocked.message).not.toMatch(/sql|error|trial/i)
 expect(await snapshot(trial)).toBe(before)
 // 2) La bozza resta salvabile.
 const draft=structuredClone(w);draft.menus[0]!.sections[0]!.items[0]!.price=13
 const saved=await mutateWorkspace(trial,actor,1,draft,false,'Salvataggio',connection);expect(saved.revision).toBe(2);expect(saved.publishedRevision).toBeUndefined()
 const afterSave=(await client`SELECT published,published_revision FROM menu_workspaces WHERE restaurant_id=${trial}`)[0]!;expect(afterSave.published).toBeNull();expect(afterSave.published_revision).toBeNull()
 // Anche la sequenza bozza→pubblica usata da WhatsApp e dai preset si ferma al passo di pubblicazione.
 await expect(mutateWorkspace(trial,actor,2,draft,true,'WhatsApp: pubblicazione automatica',connection)).rejects.toBeInstanceOf(WorkspaceTrialLocked)
 expect(Number((await client`SELECT count(*) n FROM menu_items WHERE restaurant_id=${trial}`)[0]!.n)).toBe(0)
 // 3) Un locale non PROVA pubblica come sempre.
 const ok=await mutateWorkspace(client2,actor,1,w2,true,'Pubblicazione',connection);expect(ok.publishedRevision).toBe(2)
 // 4) Sblocco quando il lead diventa cliente: flag a false (o assente) → pubblica.
 await client`UPDATE restaurants SET settings=settings||'{"takomenuTrial":false}'::jsonb WHERE id=${trial}`
 const unlocked=await mutateWorkspace(trial,actor,2,draft,true,'Pubblicazione',connection);expect(unlocked.publishedRevision).toBe(3)
 expect(Number((await client`SELECT price FROM menu_items WHERE restaurant_id=${trial}`)[0]!.price)).toBe(13)
 }finally{await client?.end();if(started)run('pg_ctl',['-D',directory+'/data','-m','immediate','stop']);rmSync(directory,{recursive:true,force:true})}
},60000)

// Le strade di pubblicazione traducono il blocco in un messaggio non tecnico (niente 500).
it('dashboard, preset e WhatsApp rispondono col messaggio del blocco',()=>{
 const src=(p:string)=>readFileSync(new URL('../apps/server/src/'+p,import.meta.url),'utf8')
 const workspace=src('routes/menu-workspace.ts'),presets=src('routes/menu-day-presets.ts'),whatsapp=src('routes/twilio-menu.ts'),store=src('lib/menu-workspace-store.ts')
 expect(store).toMatch(/if\(publish&&\(row\?row\.trial===true:await isTrialRestaurant\(tenant,tx\)\)\)throw new WorkspaceTrialLocked\(\)/)
 expect(workspace).toMatch(/fastify\.post\('\/publish'[^\n]*e instanceof WorkspaceTrialLocked\)return reply\.code\(403\)/)
 expect(presets).toMatch(/e instanceof WorkspaceTrialLocked\) return reply\.code\(403\)/)
 expect(whatsapp.match(/instanceof WorkspaceTrialLocked\)return error\.message/g)?.length).toBe(2)
})
