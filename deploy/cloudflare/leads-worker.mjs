import worker from './worker.mjs';
/** Separate routes keep CRM deployments independent of the operational bot. */
export default {async fetch(request,env,ctx){const url=new URL(request.url),path=url.pathname;
 if(path==='/leads'){url.pathname='/leads/';url.searchParams.set('view','leads');return Response.redirect(url,302)}
 const config={...env,TAKO_EDGE_URL:env.TAKO_LEADS_EDGE_URL,TAKO_READ_EDGE_URL:''};
 if(path.startsWith('/leads/')){url.pathname='/staff/'+path.slice('/leads/'.length);const response=await worker.fetch(new Request(url,request),config,ctx);const headers=new Headers(response.headers);headers.set('X-Robots-Tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers})}
 return worker.fetch(request,config,ctx);
}};
