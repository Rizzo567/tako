/** Explicitly authorized PROVA provisioning, never publishes or creates owner accounts.
 * Inputs/credentials stay outside Git. Default validates only; --apply required for DB writes.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {homedir} from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.ts';
import {menuLayoutDefaults} from '../apps/server/src/lib/menu-layout-defaults.ts';
const base=process.env.TAKO_LEADS_PRIVATE_DIR||homedir()+'/.config/tako-webapp/leads-campaign-2026-10-16';
const envPath=process.env.TAKO_LEADS_MIGRATOR_ENV;
if(!envPath)throw Error('Set TAKO_LEADS_MIGRATOR_ENV to a private managed-DB configuration file');
const env=parseEnv(await readFile(envPath,'utf8'));
const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined);
const db=postgres(env.DATABASE_URL!,{max:1,prepare:false,connect_timeout:15,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}});
const id=(value:string)=>{const h=createHash('sha256').update('takomenu-lead-trial-v1:'+value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
const slug=(value:string)=>value.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65);
const safeImage=(value:unknown)=>{try{const u=new URL(String(value));return u.protocol==='https:'?u.href:null}catch{return null}};
try{
 await mkdir(base,{recursive:true,mode:0o700});
 let tokens:Record<string,string>={};try{tokens=JSON.parse(await readFile(base+'/demo-tokens.json','utf8'))}catch{}
 const plans=[];
 for(let n=1;n<=10;n++){
  const leadId='TK'+String(n).padStart(3,'0'),s=JSON.parse(await readFile(base+'/menu-sources/'+leadId+'.json','utf8'));
  if(s.leadId!==leadId||!s.sourceUrl?.startsWith('https://')||!Array.isArray(s.menus)||!s.menus.length)throw Error('Invalid source '+leadId);
  let missing=0;
  const menus=s.menus.map((m:any,mi:number)=>({id:id(`${leadId}:menu:${mi}`),name:m.name,description:'Demo PROVA da fonte pubblica: confermare disponibilità e prezzi con il locale.',type:/bevande|drink|vini/i.test(m.name)?'drinks':'main',sections:m.sections.map((section:any,si:number)=>({id:id(`${leadId}:menu:${mi}:section:${si}`),name:section.name,description:section.description||null,items:section.items.map((item:any,ii:number)=>{
   if(item.price!==null&&(!Number.isFinite(item.price)||item.price<=0))throw Error('Invalid price '+leadId);
   if(item.price===null)missing++;
   return{id:id(`${leadId}:menu:${mi}:section:${si}:item:${ii}`),name:item.name,description:item.description||null,price:item.price??0,priceDisplay:item.price===null?'Da confermare':null};
  })}))}));
  const c=s.colors||{},background=c.background||'#faf8f3',text=c.text||'#242628',accent=c.accent||'#50564b';
  const w=workspaceSchema.parse({languages:['it'],defaultLanguage:'it',menus,design:{...menuLayoutDefaults,preset:'sobrio',font:'sans',background,text,primary:accent,categoryBackground:accent,categoryText:'#ffffff',categoryActiveBackground:accent,categoryActiveText:'#ffffff',logoUrl:safeImage(s.logoUrl),coverUrl:safeImage(s.coverUrl),headerBackground:background,headerToolColor:text,showFoodLegends:false,showReview:false,showAllergens:false,standard:{name:{color:text,bold:true},price:{color:accent},description:{color:text}},categoryTitleStyle:{color:accent},subcategoryTitleStyle:{color:accent}},translationSettings:{protectedNames:[s.name]}});
  tokens[leadId]??=randomBytes(32).toString('hex');
  const note=[s.sourceFreshness,s.note,missing?'Prezzi non pubblici: le voci senza prezzo sono indicate “Da confermare”.':''].filter(Boolean).join(' ');
  plans.push({leadId,name:s.name,restaurantId:id(leadId+':restaurant'),slug:'prova-'+slug(s.name)+'-'+leadId.toLowerCase(),workspace:w,source:s,note,missing,token:tokens[leadId]});
 }
 await writeFile(base+'/demo-tokens.json',JSON.stringify(tokens),{mode:0o600});
 const apply=process.argv.includes('--apply');
 if(apply)await db.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended('takomenu-lead-trials-v1',0))`;
  for(const p of plans){
   const existing=(await tx`select id,settings from restaurants where slug=${p.slug}`)[0];
   if(existing&&(existing.id!==p.restaurantId||existing.settings?.trialLeadId!==p.leadId))throw Error('Restaurant identity conflict '+p.leadId);
   const lead=(await tx`select id,restaurant_id from tako_agency_leads where id=${p.leadId} for update`)[0];if(!lead)throw Error('Missing CRM lead');
   if(lead.restaurant_id&&lead.restaurant_id!==p.restaurantId)throw Error('Lead already associated with another restaurant');
   const settings={takomenuTrial:true,trialLeadId:p.leadId,customerOrderingEnabled:false,reservationsEnabled:false,tableServiceEnabled:false,takeawayEnabled:false,languages:['it'],defaultLanguage:'it'};
   await tx`insert into restaurants(id,name,slug,settings,logo_url,cover_url,primary_color) values(${p.restaurantId},${p.name},${p.slug},${tx.json(settings)},${p.workspace.design.logoUrl},${p.workspace.design.coverUrl},${p.workspace.design.primary}) on conflict(id) do nothing`;
   // Never overwrite subsequent admin edits when provisioning is rerun.
   await tx`insert into menu_workspaces(restaurant_id,draft,revision) values(${p.restaurantId},${tx.json(p.workspace)},1) on conflict(restaurant_id) do nothing`;
   const info={data_menu:p.source.sourceDate||'Data non indicata nella fonte',fonte_menu:p.source.sourceUrl,demoUrl:'https://takoitalia.com/leads-demo/'+p.token,demoSourceUrl:p.source.sourceUrl,demoSourceDate:p.source.sourceDate,demoSourceNote:p.note,demoMissingPrices:p.missing,demoPrepared:true};
   await tx`update tako_agency_leads set restaurant_id=${p.restaurantId},demo_token_hash=${createHash('sha256').update(p.token).digest('hex')},source=source||${tx.json(info)},status=case when status in ('new','demo_preparing') then ${p.missing?'demo_preparing':'demo_ready'} else status end,revision=revision+1,updated_at=now() where id=${p.leadId}`;
  }
 });
 const result=plans.map(p=>({leadId:p.leadId,name:p.name,restaurantId:p.restaurantId,slug:p.slug,items:p.workspace.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).length,missingPrices:p.missing,sourceUrl:p.source.sourceUrl,sourceDate:p.source.sourceDate,published:false}));
 await writeFile(base+'/provision-proof.json',JSON.stringify({applied:apply,restaurants:result},null,2),{mode:0o600});
 console.log(JSON.stringify({applied:apply,restaurants:result.length,items:result.reduce((n,r)=>n+r.items,0),missingPrices:result.reduce((n,r)=>n+r.missingPrices,0),published:0,ownerAccountsCreated:0}));
}catch(e){console.error('Trial provisioning failed',e instanceof Error?e.message.slice(0,160):'Error');process.exitCode=1}finally{await db.end()}
