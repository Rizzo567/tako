import {createPollingTransport} from './polling-core.mjs'
import {useSessionStore} from '@/lib/store'
import {currentMenu,subscribeMenu} from './api-polling'
export const socket=createPollingTransport({interval:5000})
let menuId:string|null=null,joined=false
const broadcast=(event:string,payload?:any)=>{for(const listener of handlers.get(event)||[])listener(payload)}
const handlers=new Map<string,Set<(payload?:any)=>void>>()
// Event methods deliberately keep the existing listener contract; data is from GET.
const on=socket.on.bind(socket),off=socket.off.bind(socket)
socket.on=(event:string,cb:(payload?:any)=>void)=>{if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event)!.add(cb);return on(event,cb)}
socket.off=(event:string,cb?:(payload?:any)=>void)=>{if(cb)handlers.get(event)?.delete(cb);else handlers.delete(event);return off(event,cb)}
function update(){const state=useSessionStore.getState(),tasks:any[]=[]
 if(menuId){const read=currentMenu(menuId);tasks.push({key:'menu',url:read?.url||`/api/customer/restaurant/${encodeURIComponent(menuId)}/menu`,onChange:()=>broadcast('menu:updated')})}
 if(joined&&state.orderId){const id=state.orderId;tasks.push({key:'order:'+id,url:`/api/customer/orders/${encodeURIComponent(id)}`,project:(body:any)=>{if(body.data?.id!==id||typeof body.data?.status!=='string')throw Error('Invalid order snapshot');return {orderId:id,status:body.data.status}},initial:true,onChange:(value:any)=>{if(typeof value.status==='string')broadcast('order:updated',value)},onUnavailable:()=>{if(useSessionStore.getState().orderId===id)useSessionStore.getState().setOrderId(null)}})}
 socket.setTasks(tasks);if(menuId){const read=currentMenu(menuId);if(read)socket.seed('menu',read.body)}
}
subscribeMenu(read=>{if(read.restaurantId===menuId){update();socket.seed('menu',read.body)}})
useSessionStore.subscribe((state,previous)=>{if(state.orderId!==previous.orderId||state.restaurantId!==previous.restaurantId||state.tableId!==previous.tableId){if(state.restaurantId!==previous.restaurantId)menuId=null;update();}})
export function joinTable(_tableId:string){joined=true;update();socket.connect()}
export function joinOrder(_orderId:string){joined=true;update();socket.connect()}
export function joinMenu(restaurantId:string){menuId=restaurantId;update();socket.connect()}
