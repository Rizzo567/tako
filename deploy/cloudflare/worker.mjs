import {menuSocialDocument} from './menu-social.mjs';
import {publicMenuResponse} from './public-snapshots.mjs';
import {parseStaticRoute} from '../../apps/web-static/src/routes.mjs';
/** Same-origin gateway. Backend activation is explicit and fails closed. */
export function backendURL(env) {
  if (env.TAKO_BACKEND_READY !== 'true') return null;
  try {
    const url = new URL(env.TAKO_EDGE_URL);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.search || url.hash || !/^\/functions\/v1\/[a-z0-9-]+\/?$/.test(url.pathname)) return null;
    return url;
  } catch { return null; }
}
async function freshDocument(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Takomenu-UI', 'mobile-rounded-20261012');
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}
const unavailable = () => Response.json({error:'Servizio temporaneamente non disponibile'}, {status:503,headers:{'Cache-Control':'no-store'}});
const customerMenuPath=path=>/^\/api\/customer\/restaurant\/[a-f0-9-]{36}\/menu$/.test(path);
export function catalogRequest(request){
  const url=new URL(request.url);
  if(!customerMenuPath(url.pathname)||!['GET','HEAD'].includes(request.method))return request;
  url.searchParams.set('catalogOnly','1');
  return new Request(url,request);
}
/** Public menu catalog keeps its approved read-only policy, independently of legacy tenant settings. */
export async function readOnlyMenu(response,method){
  if(method==='HEAD'||response.status!==200)return response;
  let data;try{data=await response.json()}catch{return unavailable()}
  if(!data||typeof data!=='object'||Array.isArray(data))return unavailable();
  data.features={...(data.features||{}),customerOrderingEnabled:false,reservationsEnabled:false};
  const headers=new Headers(response.headers);
  for(const key of ['Content-Length','Content-Encoding','ETag'])headers.delete(key);
  headers.set('Content-Type','application/json; charset=utf-8');
  headers.set('Cache-Control','no-store');
  return new Response(JSON.stringify(data),{status:response.status,headers});
}
export async function proxy(request, env, fetcher = fetch) {
  const base = backendURL(env);
  if (!base) return unavailable();
  if(typeof env.TAKO_GATEWAY_SECRET!=='string'||env.TAKO_GATEWAY_SECRET.length<32)return unavailable();
  const trustedIP=request.headers.get('CF-Connecting-IP');
  if(!trustedIP)return unavailable();
  const incoming = new URL(request.url);
  const target = new URL(base.href.replace(/\/$/, '') + incoming.pathname + incoming.search);
  const headers = new Headers(request.headers);
  for (const key of ['host','connection','x-forwarded-host','x-forwarded-proto','x-forwarded-for','forwarded','x-tako-gateway-secret','x-tako-gateway-origin','x-tako-client-ip','x-restaurant-id','x-user-id','x-role']) headers.delete(key);
  headers.set('x-forwarded-host', incoming.host);
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-tako-gateway-secret',env.TAKO_GATEWAY_SECRET);
  headers.set('x-tako-gateway-origin',incoming.origin);
  headers.set('x-tako-client-ip',trustedIP);
  // Origin, Cookie, Authorization, CSRF and multipart boundary remain intact.
  try {
    const upstream = await fetcher(new Request(target, {method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',duplex:'half',signal:request.signal}));
    const responseHeaders = new Headers(upstream.headers);
    const image=/^\/uploads\/[a-f0-9-]{36}\/[A-Za-z0-9_-]{16}\.(?:jpg|png|webp|gif)$/.test(incoming.pathname)&&['GET','HEAD'].includes(request.method)&&upstream.ok&&/^image\/(?:jpeg|png|webp|gif)(?:;|$)/.test(upstream.headers.get('Content-Type')||'');
    if(!image)responseHeaders.set('Cache-Control','no-store');
    const cookies = upstream.headers.getSetCookie?.() ?? [];
    if (cookies.length) {
      responseHeaders.delete('Set-Cookie');
      for (const cookie of cookies) responseHeaders.append('Set-Cookie',cookie.replace(/;\s*Domain=[^;]+/ig,'').replace(/;\s*Path=\/functions\/v1\/[^;]+/ig,'; Path=/'));
    }
    const location = responseHeaders.get('Location');
    if (location) {
      const redirect = new URL(location,target);
      if (redirect.origin === target.origin && redirect.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/')) {
        responseHeaders.set('Location',incoming.origin + redirect.pathname.slice(base.pathname.replace(/\/$/, '').length) + redirect.search + redirect.hash);
      }
    }
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
  } catch { return unavailable(); }
}
// File con hash Vite nel nome (assets/nome-XXXXXXXX.ext): il contenuto non cambia mai, cache di un anno.
export function hashedAsset(path,response){if(!response.ok||!/^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|ttf|woff2|png|svg|webp|jpg)$/.test(path))return response;const headers=new Headers(response.headers);headers.set('Cache-Control','public, max-age=31536000, immutable');return new Response(response.body,{status:response.status,headers})}
export default {
  async fetch(request, env,ctx) {
    const path = new URL(request.url).pathname;
    // An activated gateway reads published data from the operational backend.
    // Immutable snapshots are used only while the cloud backend is disabled.
    if(customerMenuPath(path)&&!['GET','HEAD'].includes(request.method))return Response.json({error:'Metodo non consentito'},{status:405,headers:{Allow:'GET, HEAD'}});
    if (/^\/(api|uploads)(\/|$)/.test(path) && backendURL(env)) {
      const isImage=/^\/uploads\/[a-f0-9-]{36}\/[A-Za-z0-9_-]{16}\.(?:jpg|png|webp|gif)$/.test(path)&&['GET','HEAD'].includes(request.method);
      const cacheKey=isImage?new Request(new URL(path,request.url),{method:'GET'}):null;
      const cache=isImage&&typeof caches!=='undefined'?caches.default:null;
      if(cache&&cacheKey){const hit=await cache.match(cacheKey);if(hit)return request.method==='HEAD'?new Response(null,{status:hit.status,headers:hit.headers}):hit;}
      const readPath=isImage||customerMenuPath(path)||['/api/auth/bootstrap','/api/agency/restaurants','/api/menu-workspace','/api/menu-workspace/presentation','/api/menu-workspace/publish/diff','/api/auth/me','/api/orders/active','/api/tables/rooms','/api/tables/waiter-calls','/api/reservations','/api/stats/dashboard','/api/restaurants/me','/api/agency/me'].includes(path);
      const readEnv=['GET','HEAD'].includes(request.method)&&readPath&&backendURL({...env,TAKO_EDGE_URL:env.TAKO_READ_EDGE_URL})?{...env,TAKO_EDGE_URL:env.TAKO_READ_EDGE_URL}:env;
      let response=await proxy(catalogRequest(request),readEnv);
      if([501,502,503,504].includes(response.status)&&readEnv!==env){const prior=response;response=await proxy(catalogRequest(request),env);const cookies=prior.headers.getSetCookie?.()||[];if(cookies.length){const headers=new Headers(response.headers);for(const cookie of cookies)headers.append('Set-Cookie',cookie);response=new Response(response.body,{status:response.status,headers})}}
      if(cache&&cacheKey&&request.method==='GET'&&response.ok&&/^image\//.test(response.headers.get('Content-Type')||'')&&/public.*immutable/.test(response.headers.get('Cache-Control')||'')){const saving=cache.put(cacheKey,response.clone()).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(saving);}

      return customerMenuPath(path)?readOnlyMenu(response,request.method):response;
    }
    const snapshot=await publicMenuResponse(request,env);if(snapshot)return snapshot;
    if(path==='/menu'||path==='/menu/')return new Response('Pagina non disponibile',{status:410,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    if(path.startsWith('/takomenu-public/'))return hashedAsset(path.slice('/takomenu-public'.length),await env.ASSETS.fetch(new Request(new URL(path.slice('/takomenu-public'.length),request.url),request)));
    if(path.startsWith('/takomenu-app/'))return hashedAsset(path.slice('/takomenu-app'.length),await env.ASSETS.fetch(new Request(new URL(path.slice('/takomenu-app'.length),request.url),request)));
    if(path.startsWith('/public-menu-data/'))return new Response('Not found',{status:404});
    if (/^\/(api|uploads)(\/|$)/.test(path)) return proxy(request,env);
    if (/^\/socket\.io(\/|$)/.test(path)) return Response.json({error:'Usare il polling della webapp'}, {status:404,headers:{'Cache-Control':'no-store'}});
    if (path === '/staff') return Response.redirect(new URL('/staff/',request.url),301);
    if (path === '/staff/') return freshDocument(await env.ASSETS.fetch(new Request(new URL('/staff/index.html',request.url),request)));
    if(/^\/onboarding-(?:preview|claim)\//.test(path)){const doc=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request));const headers=new Headers(doc.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',"frame-ancestors 'none'");return new Response(doc.body,{status:doc.status,headers})}
    const route = parseStaticRoute(path);
    if (!['home','not-found'].includes(route.kind)) return freshDocument(await menuSocialDocument(await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),request)),route,request.method));
    const asset=await env.ASSETS.fetch(request);if(/^\/staff\/(?:app\.[a-f0-9]{12}\.js|lib\/react(?:-dom)?-18\.3\.1\.production\.min\.js)$/.test(path)&&asset.ok){const headers=new Headers(asset.headers);headers.set('Cache-Control','public, max-age=31536000, immutable');return new Response(asset.body,{status:asset.status,headers})}return asset;
  }
};
