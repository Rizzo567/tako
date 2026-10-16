import {createHmac,randomUUID} from 'node:crypto'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
export async function recordMenuEvents(tenant:string,menuId:string,events:{kind:'scan'|'language'|'link';lang:string}[],visit:string,timezone='Europe/Rome'){
 const visitHash=createHmac('sha256',process.env.JWT_SECRET!).update(`${tenant}:${visit}`).digest('hex');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));const day=`${p.year}-${p.month}-${p.day}`
 if(!events.length)return
 const values=events.map(event=>sql`(${randomUUID()},${tenant},${menuId},${event.kind},${event.lang},${visitHash},${day}::date)`)
 await db.execute(sql`INSERT INTO menu_workspace_events(id,restaurant_id,menu_id,kind,lang,visit_hash,day) VALUES ${sql.join(values,sql`, `)} ON CONFLICT DO NOTHING`)
}
export async function recordMenuEvent(tenant:string,menuId:string,kind:'scan'|'language'|'link',lang:string,visit:string,timezone='Europe/Rome'){
 return recordMenuEvents(tenant,menuId,[{kind,lang}],visit,timezone)
}
