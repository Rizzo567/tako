// Temporary JWT-protected CPU probe, synthetic fixture only. No DB/Storage calls.
import bcrypt from 'npm:bcryptjs@3.0.3'
import Fastify from 'npm:fastify@5.2.1'
const hash='FIXTURE_HASH',password='tako-synthetic-cpu-fixture-only'
const app=Fastify({logger:false})
app.get('/health',async()=>({operational:false}))
await app.ready()
Deno.serve(async request=>{
 const mode=new URL(request.url).searchParams.get('mode')??'correct'
 if(mode==='health'){const result=await app.inject({method:'GET',url:'/health'});return new Response(result.rawPayload,{status:result.statusCode,headers:{'content-type':'application/json'}})}
 if(!['correct','wrong','dual'].includes(mode))return Response.json({error:'unsupported mode'},{status:400})
 const start=performance.now(),results=[]
 const count=mode==='dual'?2:1
 for(let i=0;i<count;i++)results.push(await bcrypt.compare(mode==='wrong'?'incorrect-fixture':password,hash))
 return Response.json({operational:false,scope:'synthetic-bcrypt-cpu-probe',cost:bcrypt.getRounds(hash),mode,results,wallMs:performance.now()-start,memory:Deno.memoryUsage()})
})
