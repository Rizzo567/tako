import {it,expect} from 'vitest'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import * as schema from '../packages/db/src/schema/index.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {mutateWorkspace,WorkspaceOwnership,WorkspaceConflict} from '../apps/server/src/lib/menu-workspace-store.js'
it('publishes 277 dishes and 1108 translations atomically, preserves historical IDs and rejects foreign ownership',async()=>{
 const directory=mkdtempSync(tmpdir()+'/tako-publication-'),run=(name:string,args:string[])=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/'+name,args,{stdio:'pipe'});let client:ReturnType<typeof postgres>|undefined,started=false
 try{
 run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8']);run('pg_ctl',['-D',directory+'/data','-l',directory+'/log','-o',`-k ${directory} -p 55449 -h ''`,'-w','start']);started=true
 client=postgres({host:directory,port:55449,database:'postgres',username:process.env.USER,max:1})
 await client.unsafe(`CREATE TABLE menus(id uuid PRIMARY KEY,restaurant_id uuid,name text,description text,type text,active boolean,position int,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
 CREATE TABLE menu_sections(id uuid PRIMARY KEY,menu_id uuid REFERENCES menus(id),name text,name_translations jsonb,description text,position int,active boolean);
 CREATE TABLE menu_items(id uuid PRIMARY KEY,section_id uuid REFERENCES menu_sections(id),restaurant_id uuid,name text,name_translations jsonb,description text,description_translations jsonb,price numeric,image_url text,allergens text[],tags text[],calories int,available boolean,featured boolean,position int,kitchen_station text,prep_time_minutes int,cost_price numeric,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
 CREATE TABLE item_variants(id uuid PRIMARY KEY,item_id uuid REFERENCES menu_items(id),name text,price_modifier numeric,available boolean);
 CREATE TABLE menu_item_translations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid,item_id uuid REFERENCES menu_items(id),lang text,name text,description text,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now(),UNIQUE(item_id,lang));
 CREATE TABLE menu_workspaces(restaurant_id uuid PRIMARY KEY,draft jsonb,published jsonb,revision int,published_revision int,updated_at timestamp DEFAULT now());
 CREATE TABLE menu_workspace_versions(id uuid PRIMARY KEY,restaurant_id uuid,revision int,label text,snapshot jsonb,created_by uuid);`)
 const tenant=randomUUID(),actor=randomUUID(),menu=randomUUID(),section=randomUUID(),retired=randomUUID(),variant=randomUUID(),historicalVariant=randomUUID();const languages=['it','en','fr','de','es'];const w=workspaceSchema.parse({languages,menus:[{id:menu,name:'Cena',sections:[{id:section,name:'Piatti',items:Array.from({length:277},(_,n)=>({id:randomUUID(),name:'Piatto '+n,price:12+n/100,translations:Object.fromEntries(languages.slice(1).map(l=>[l,{name:l+' '+n,description:'Description '+n}])),variants:n===0?[{id:variant,name:'Grande',priceModifier:2}]:[]}))}]}]});const first=w.menus[0]!.sections[0]!.items[0]!
 await client`INSERT INTO menus(id,restaurant_id,name,active) VALUES(${menu},${tenant},'Prima',true)`;await client`INSERT INTO menu_sections(id,menu_id,name,active) VALUES(${section},${menu},'Prima',true)`;await client`INSERT INTO menu_items(id,section_id,restaurant_id,name,price,available) VALUES(${first.id},${section},${tenant},'Prima',1,false),(${retired},${section},${tenant},'Storico',2,true)`;await client`INSERT INTO item_variants(id,item_id,name,price_modifier,available) VALUES(${historicalVariant},${first.id},'Vecchia',1,true)`;await client`INSERT INTO menu_item_translations(restaurant_id,item_id,lang,name) VALUES(${tenant},${retired},'en','Historical preserved')`
 // Existing live availability false must survive unchanged draft/published availability true.
 await client`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${tenant},${client.json(w)},${client.json(w)},1,1)`
 let queries=0;const connection=drizzle(client,{schema,logger:{logQuery(){queries++}}});const result=await mutateWorkspace(tenant,actor,1,w,true,'Batch fixture',connection)
 expect(result.revision).toBe(2);expect(queries).toBeLessThanOrEqual(22);const firstQueries=queries
 expect(Number((await client`SELECT count(*) AS n FROM menu_items WHERE restaurant_id=${tenant}`)[0]!.n)).toBe(278)
 expect(Number((await client`SELECT count(*) AS n FROM menu_item_translations WHERE restaurant_id=${tenant}`)[0]!.n)).toBe(1109)
 expect((await client`SELECT available FROM menu_items WHERE id=${retired}`)[0]!.available).toBe(false)
 expect((await client`SELECT available FROM menu_items WHERE id=${first.id}`)[0]!.available).toBe(false)
 expect((await client`SELECT available FROM item_variants WHERE id=${historicalVariant}`)[0]!.available).toBe(false)
 expect(Number((await client`SELECT price_modifier FROM item_variants WHERE id=${variant}`)[0]!.price_modifier)).toBe(2)
 expect((await client`SELECT published_revision,published FROM menu_workspaces WHERE restaurant_id=${tenant}`)[0]!.published_revision).toBe(2)
 // Publishing a new price again replaces translations rather than duplicating them.
 const next=structuredClone(result.data);next.menus[0]!.sections[0]!.items[1]!.price=99;await mutateWorkspace(tenant,actor,2,next,false,'Draft fixture',connection);queries=0;await mutateWorkspace(tenant,actor,3,next,true,'Republish fixture',connection);expect(queries).toBeLessThanOrEqual(22)
 expect(Number((await client`SELECT price FROM menu_items WHERE id=${next.menus[0]!.sections[0]!.items[1]!.id}`)[0]!.price)).toBe(99)
 expect(Number((await client`SELECT count(*) AS n FROM menu_item_translations WHERE restaurant_id=${tenant}`)[0]!.n)).toBe(1109)
 const foreign=randomUUID(),foreignMenu=randomUUID();await client`INSERT INTO menus(id,restaurant_id,name,active) VALUES(${foreignMenu},${foreign},'Foreign',true)`;const hostile=structuredClone(next);hostile.menus[0]!.id=foreignMenu;await client`UPDATE menu_workspaces SET draft=${JSON.stringify(hostile)}::jsonb WHERE restaurant_id=${tenant}`
 await expect(mutateWorkspace(tenant,actor,4,hostile,true,'Rejected',connection)).rejects.toBeInstanceOf(WorkspaceOwnership)
 expect((await client`SELECT active FROM menus WHERE id=${foreignMenu}`)[0]!.active).toBe(true);expect((await client`SELECT revision FROM menu_workspaces WHERE restaurant_id=${tenant}`)[0]!.revision).toBe(4)
 await expect(mutateWorkspace(tenant,actor,3,next,true,'Conflict',connection)).rejects.toBeInstanceOf(WorkspaceConflict)
 console.log(JSON.stringify({batchPublication:true,items:277,translations:1108,queries:firstQueries,ownershipRollback:true}))
 }finally{await client?.end({timeout:1});if(started)run('pg_ctl',['-D',directory+'/data','-m','immediate','stop']);rmSync(directory,{recursive:true,force:true})}
},30000)
