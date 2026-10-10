import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
import { isWebMode } from './web-runtime.js'
export async function resolveWebLocation(token: string, user: {id:string;restaurantId:string|null;role:string}) {
 if (!isWebMode()) return user.restaurantId ? {restaurantId:user.restaurantId,role:user.role} : null
 const rows=await db.execute(sql`SELECT l.restaurant_id,m.role,r.active FROM web_session_locations l JOIN restaurants r ON r.id=l.restaurant_id LEFT JOIN web_location_memberships m ON m.restaurant_id=l.restaurant_id AND m.user_id=${user.id} WHERE l.session_token=${token}`)
 const row=rows[0]
 if (!row) return user.restaurantId ? {restaurantId:user.restaurantId,role:user.role} : null
 if (!row.active) return null
 if(row.restaurant_id===user.restaurantId) return {restaurantId:user.restaurantId!,role:user.role}
 return row.role ? {restaurantId:String(row.restaurant_id),role:String(row.role)} : null
}
export function menuEditorAllowed(url: string, method: string) {
 const path=url.split('?')[0]!.replace(/\/$/,'')
 return (path==='/api/menu-workspace'||path.startsWith('/api/menu-workspace/')) || (method==='GET' && ['/api/auth/me','/api/web-locations','/api/web-locations/'].includes(path)) || (method==='POST' && ['/api/web-locations/switch','/api/auth/logout'].includes(path))
}
