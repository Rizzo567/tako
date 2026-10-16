export function scheduledVisible(schedule,now=new Date()){
 if(!schedule?.enabled)return true;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(v=>[v.type,v.value]));
 const date=`${p.year}-${p.month}-${p.day}`;
 if((schedule.from&&date<schedule.from)||(schedule.until&&date>schedule.until))return false;
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),minute=Number(p.hour)*60+Number(p.minute);
 const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
 return schedule.windows.some(w=>{const a=minutes(w.start),b=minutes(w.end);return a===b?w.weekdays.includes(day):a<b?w.weekdays.includes(day)&&minute>=a&&minute<b:(w.weekdays.includes(day)&&minute>=a)||(w.weekdays.includes((day+6)%7)&&minute<b)});
}
/** Immutable public releases: GET-only, never consults private staff drafts. */
export async function publicMenuResponse(request,env){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/customer\/restaurant\/([a-f0-9-]{36})\/menu$/);
 if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Metodo non consentito'},{status:405,headers:{Allow:'GET, HEAD'}});
 const file=await env.ASSETS.fetch(new Request(new URL(`/public-menu-data/${match[1]}.json`,url),{method:'GET'}));
 if(file.status!==200)return null;
 let snapshot;try{snapshot=await file.json()}catch{return Response.json({error:'Menu non disponibile'},{status:503})}
 const lang=snapshot.languages.includes(url.searchParams.get('lang'))?url.searchParams.get('lang'):snapshot.defaultLanguage;
 // Reading a menu never places an order: keep every populated published menu browsable.
 const schedules=snapshot.availability?.schedules||{},now=new Date(),visible=()=>true;
 const candidates=Object.values(snapshot.responses).find(r=>r.menus)?.menus?.filter(m=>visible(m.id))||[];
 const menuId=url.searchParams.get('menuId')||candidates[0]?.id||snapshot.defaultMenuId;
 const raw=visible(menuId)?snapshot.responses[`${menuId}:${lang}`]:null;
 const data=raw?structuredClone(raw):null;
 if(!data)return Response.json({error:'Menu non disponibile'},{status:404});
 if(data.menus)data.menus=data.menus.map(m=>({...m,availableNow:scheduledVisible(schedules[m.id],now)}));
 if(data.features)data.features={...data.features,customerOrderingEnabled:false,reservationsEnabled:false};
 return new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Takomenu-Release':snapshot.release}});
}
