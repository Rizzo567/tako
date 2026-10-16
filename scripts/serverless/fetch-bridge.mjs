import {Buffer} from 'node:buffer';
import {verifyGatewayContext} from './gateway-context.mjs';
/** Request/Response bridge for a preconfigured Fastify app.
 * Does not initialize auth, DB, routes, or provider configuration.
 * Caller must configure those boundaries before passing the app.
 */
export function createFetchBridge(app, {maxBodyBytes=11*1024*1024,gateway=null,pathPrefix='',maxHeavyRequests=1}={}) {
  if(!Number.isInteger(maxHeavyRequests)||maxHeavyRequests<1)throw new Error('Invalid heavy request limit');
  let heavyRequests=0;
  return async function handle(request) {
    const url=new URL(request.url);
    const context=gateway?verifyGatewayContext(request,gateway):null;
    if(gateway&&!context)return Response.json({error:{code:'GATEWAY_REJECTED',message:'Accesso non consentito.'}},{status:403});
    if(pathPrefix&&!(url.pathname===pathPrefix||url.pathname.startsWith(pathPrefix+'/')))return Response.json({error:{code:'INVALID_PATH',message:'Percorso non valido.'}},{status:404});
    const routePath=pathPrefix?url.pathname.slice(pathPrefix.length)||'/':url.pathname;
    const heavy=request.method==='POST'&&(/^(?:\/api\/uploads\/image|\/api\/menu-workspace\/(?:assets|pdf)|\/api\/menus\/items\/[^/]+\/image)\/?$/.test(routePath));
    if(heavy&&heavyRequests>=maxHeavyRequests)return Response.json({error:{code:'RUNTIME_BUSY',message:'Operazione in corso, riprova tra poco.'}},{status:503,headers:{'Retry-After':'2'}});
    if(heavy)heavyRequests++;
    try {
    const declared=Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared>maxBodyBytes) return Response.json({error:{code:'BODY_TOO_LARGE',message:'File troppo grande.'}},{status:413});
    let payload;
    if(!['GET','HEAD'].includes(request.method) && request.body) {
      const reader=request.body.getReader(),chunks=[];let size=0;
      try {
        while(true) {
          const part=await reader.read();if(part.done)break;
          size+=part.value.byteLength;
          if(size>maxBodyBytes){await reader.cancel();return Response.json({error:{code:'BODY_TOO_LARGE',message:'File troppo grande.'}},{status:413});}
          chunks.push(part.value);
        }
      } finally {reader.releaseLock();}
      payload=new Uint8Array(size);let offset=0;
      for(const chunk of chunks){payload.set(chunk,offset);offset+=chunk.byteLength;}
    }
    const headers={};
    // Preserve authentication and CSRF headers; never trust identity/proxy headers
    // supplied by a browser. Verified remote IP must be passed by a separate gateway.
    for(const name of ['accept','authorization','cookie','content-type','origin','user-agent','if-none-match','if-modified-since','x-twilio-signature']) {
      const value=request.headers.get(name);if(value!==null)headers[name]=value;
    }
    headers.host=url.host;
    try {
      const appStarted=performance.now();const result=await app.inject({method:request.method,url:routePath+url.search,headers,...(payload?{payload:Buffer.from(payload)}:{}),remoteAddress:context?.ip||'127.0.0.1'});
      const responseHeaders=new Headers();
      for(const [name,value] of Object.entries(result.headers)) {
        if(['connection','keep-alive','transfer-encoding'].includes(name.toLowerCase())||value===undefined)continue;
        for(const entry of Array.isArray(value)?value:[value])responseHeaders.append(name,String(entry));
      }
      const timing=responseHeaders.get('Server-Timing');responseHeaders.set('Server-Timing',(timing?timing+',':'')+`app;dur=${(performance.now()-appStarted).toFixed(1)}`);
      const empty=request.method==='HEAD'||[204,205,304].includes(result.statusCode);
      return new Response(empty?null:result.rawPayload,{status:result.statusCode,headers:responseHeaders});
    } catch {
      return Response.json({error:{code:'INTERNAL',message:'Errore interno'}},{status:500});
    }
    } finally {if(heavy)heavyRequests--;}
  }
}
