// Shared helpers for the live translation pipeline (private state outside the repository).
import {readFile,writeFile,rename,mkdir,chmod} from 'node:fs/promises';import {homedir} from 'node:os';import {dirname} from 'node:path';
export const base='https://takoitalia.com';
export const dir=process.env.TAKO_TRANSLATION_DIR||homedir()+'/.config/tako-webapp/live-translations-20261014';
export const previousDirs=[homedir()+'/.config/tako-webapp/live-translations-20261012',homedir()+'/.config/tako-webapp/menusmart-migration-converted-20261011-v2',homedir()+'/.config/tako-webapp/san-galdino-import',homedir()+'/.config/tako-webapp/victoria-import'];
export async function atomic(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});const tmp=path+'.tmp';await writeFile(tmp,typeof value==='string'?value:JSON.stringify(value),{mode:0o600});await chmod(tmp,0o600);await rename(tmp,path)}
export function client(cookie=''){
 const state={cookie};
 async function call(path,opt={}){for(let attempt=0;;attempt++){const r=await fetch(base+path,{...opt,headers:{Origin:base,Cookie:state.cookie,...opt.headers},signal:AbortSignal.timeout(60000)});if(r.headers.getSetCookie().length){const jar=new Map(state.cookie.split('; ').filter(Boolean).map(c=>[c.split('=')[0],c]));for(const x of r.headers.getSetCookie()){const c=x.split(';')[0],n=c.split('=')[0];if(/max-age=0|expires=thu, 01 jan 1970/i.test(x)||c===n+'=')jar.delete(n);else jar.set(n,c)}state.cookie=[...jar.values()].join('; ')}if(r.status===429&&attempt<6){const wait=Number(r.headers.get('retry-after')||0)*1000||2000*2**attempt;await new Promise(res=>setTimeout(res,Math.min(wait,120000)));continue}const text=await r.text();let b;try{b=JSON.parse(text)}catch{b={raw:text.slice(0,200)}}if(!r.ok){const e=Error(path+' '+r.status+' '+(b.error?.code||b.error||''));e.status=r.status;throw e}return b}}
 return {state,call};
}
export const json=b=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
export async function login(api){const credential=await readFile(homedir()+'/.config/tako-webapp/agency-manuel-credenziali.txt','utf8');await api.call('/api/auth/login',json({email:credential.match(/^Email:\s*(.+)$/m)[1].trim(),password:credential.match(/^Password[^:]*:\s*(.+)$/m)[1].trim()}))}
export async function sessionClient(){let cookie='';try{cookie=(await readFile(dir+'/session.txt','utf8')).trim()}catch{}const api=client(cookie);try{if(!cookie)throw Error('no session');await api.call('/api/auth/me')}catch{api.state.cookie='';await login(api)}return api}
export async function saveSession(api){await atomic(dir+'/session.txt',api.state.cookie)}
export const entities=w=>w.menus.flatMap(m=>[m,...m.sections.flatMap(s=>[s,...s.items])]);
export const foodKeyList=catalogs=>['allergens','traits','additives',...['allergens','traits','additives'].flatMap(k=>Array.isArray(catalogs[k])?catalogs[k]:[]).map(e=>e.id).filter(Boolean)];
export const targetLanguages=w=>w.languages.filter(l=>l!==w.defaultLanguage);
export function missing(w,foodKeys){return targetLanguages(w).flatMap(l=>entities(w).filter(e=>!e.translations[l]?.name?.trim()||(e.description?.trim()&&!e.translations[l]?.description?.trim())).map(e=>({id:e.id,language:l})).concat(foodKeys.filter(k=>!w.foodTranslations[l]?.[k]?.trim()).map(k=>({id:'food:'+k,language:l}))))}
export const strip=w=>JSON.stringify(w,(k,v)=>['translations','foodTranslations'].includes(k)?undefined:v);
export const restaurantsFromLinks=async()=>JSON.parse(await readFile('docs/webapp/customer-links/links.json','utf8')).map(r=>({restaurantId:r.id,name:r.name,slug:r.slug}));
