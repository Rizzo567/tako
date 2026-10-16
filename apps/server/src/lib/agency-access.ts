/** Explicit server-side account grants. Empty/malformed config denies every account. */
export function agencyUserIds(env:NodeJS.ProcessEnv=process.env):ReadonlySet<string>{
 const raw=env['TAKOMENU_AGENCY_USER_IDS']?.trim();if(!raw)return new Set()
 const ids=raw.split(',').map(value=>value.trim().toLowerCase())
 if(ids.length>100||ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)))return new Set()
 return new Set(ids)
}
export function isAgencyUser(userId:unknown,env:NodeJS.ProcessEnv=process.env):boolean{
 return typeof userId==='string'&&agencyUserIds(env).has(userId.toLowerCase())
}
