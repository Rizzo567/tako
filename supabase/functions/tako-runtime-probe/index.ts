// Protected hosted-runtime compatibility probe. No database, storage or business routes.
// verify_jwt must remain enabled; this is not the Tako backend.
import Fastify from 'npm:fastify@5.2.1';
import cookie from 'npm:@fastify/cookie@11.0.2';
const app=Fastify({logger:false});
await app.register(cookie);
app.get('/health', async (_request,reply)=>{
 reply.setCookie('tako_probe','non-secret',{secure:true,httpOnly:true,sameSite:'strict'});
 return {status:'ok',runtime:'supabase-edge',scope:'compatibility-probe',operational:false};
});
await app.ready();
Deno.serve(async(request)=>{
 const result=await app.inject({method:'GET',url:'/health'});
 return new Response(result.rawPayload,{status:result.statusCode,headers:{'content-type':'application/json','set-cookie':String(result.headers['set-cookie'])}});
});
