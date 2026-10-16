import {api} from '../../web/src/lib/api'
export {api}
type MenuRead={restaurantId:string;url:string;body:any}
let sequence=0
const latest=new Map<string,number>()
const menus=new Map<string,MenuRead>(),listeners=new Set<(read:MenuRead)=>void>()
api.interceptors.request.use(config=>{const match=(config.url||'').match(/^\/customer\/restaurant\/([^/?]+)\/menu(?:\?|$)/);if(config.method?.toLowerCase()==='get'&&match){const id=decodeURIComponent(match[1]);latest.set(id,++sequence);(config as any).__takoMenuSequence=sequence;}return config;})
// Capture the actual selected menu/language read, never intercept mutations.
api.interceptors.response.use(response=>{const url=response.config.url||'';const match=url.match(/^\/customer\/restaurant\/([^/?]+)\/menu(?:\?|$)/);if(response.config.method?.toLowerCase()==='get'&&match&&latest.get(decodeURIComponent(match[1]))===(response.config as any).__takoMenuSequence){const read={restaurantId:decodeURIComponent(match[1]),url:'/api'+url,body:response.data};menus.set(read.restaurantId,read);for(const listener of listeners)listener(read);}return response;})
export const currentMenu=(restaurantId:string)=>menus.get(restaurantId)
export const subscribeMenu=(listener:(read:MenuRead)=>void)=>{listeners.add(listener);return()=>listeners.delete(listener)}
