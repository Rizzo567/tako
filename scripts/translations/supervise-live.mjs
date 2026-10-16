// Bounded supervisor: runs the generator (which waits on Groq quotas itself, never fatal on 429) within a total
// budget (default 8 h). Restarts only after crashes (max 3). Never publishes: publication is a separate verified step.
// Usage: node scripts/translations/supervise-live.mjs [--hours=8]
import {readFile,writeFile,open} from 'node:fs/promises';import {spawn} from 'node:child_process';import {dir} from './common.mjs';
const hours=Number(process.argv.find(a=>a.startsWith('--hours='))?.slice(8)??8),deadline=Date.now()+hours*3600000,maxRestarts=3;
async function journal(data){await writeFile(dir+'/supervisor-status.json',JSON.stringify({...data,deadline:new Date(deadline).toISOString(),updatedAt:new Date().toISOString()}),{mode:0o600})}
const readStatus=async()=>{try{return JSON.parse(await readFile(dir+'/translation-status.json','utf8'))}catch{return {}}};
let child,stopping=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopping=true;child?.kill('SIGTERM')});
async function run(){const log=await open(dir+'/supervisor.log','a',0o600);try{return await new Promise((resolve,reject)=>{child=spawn(process.execPath,['scripts/translations/run-live.mjs','--max-hours='+Math.max(0.01,(deadline-Date.now())/3600000).toFixed(3)],{cwd:process.cwd(),stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>resolve(code))})}finally{await log.close()}}
try{
 for(let attempt=0;attempt<=maxRestarts;attempt++){
  await journal({state:'running',attempt,pid:process.pid});const code=await run(),status=await readStatus();
  if(code===0&&status.state==='complete'){await journal({state:'complete',remainingUnique:0,attempt});process.exit(0)}
  if(stopping){await journal({state:'stopped-by-signal',translationState:status.state,remainingUnique:status.remainingUnique});process.exit(3)}
  if(code===2||status.state==='paused'||status.state==='stopped'){await journal({state:'bounded-stop',translationState:status.state,remainingUnique:status.remainingUnique,quarantined:status.quarantined,workers:status.workers,attempt});process.exit(2)}
  if(status.state==='stopped-error'){await journal({state:'stopped-error',reason:status.error,attempt});process.exit(1)}
  if(Date.now()>=deadline)break;await journal({state:'restarting-after-crash',exitCode:code,attempt});await new Promise(r=>setTimeout(r,60000));
 }
 await journal({state:'bounded-stop',reason:'restart budget or deadline exhausted',remainingUnique:(await readStatus()).remainingUnique});process.exitCode=2;
}catch(error){await journal({state:'stopped-error',reason:String(error)});process.exitCode=1}
