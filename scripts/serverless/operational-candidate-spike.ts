// Full route graph import/registration only. No database queries or user writes.
import {createApp} from '../../apps/server/src/index.ts';
for(const [key,value] of Object.entries({TAKO_MODE:'web',TAKO_EXECUTION_RUNTIME:'edge',NODE_ENV:'development',WEB_ORIGIN:'http://localhost:5137',JWT_SECRET:'fixture-candidate-secret-over-thirty-two-characters',DATABASE_URL:'postgresql://fixture:fixture@database.invalid/tako',UPLOADS_DRIVER:'supabase',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key-over-thirty-two-characters'}))Deno.env.set(key,value);
const app=await createApp({runtime:'edge-candidate'});
try{
 if(app.server.listening)throw new Error('Unexpected listener');
 for(const [method,url] of [['POST','/api/auth/login'],['GET','/api/restaurants/me'],['GET','/api/menu-workspace']])if(!app.hasRoute({method,url}))throw new Error('Missing route '+url);
 const response=await app.inject('/api/restaurants/me');if(response.statusCode!==401)throw new Error('Auth guard failed');
 console.log(JSON.stringify({routeGraph:'PASS',authWithoutSession:401,productionReady:false}));
}finally{await app.close()}
