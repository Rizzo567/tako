import {it,expect} from 'vitest'
import {orderDayMenus} from '../apps/web/src/lib/menu-day-order'
const menus=[{id:'c',name:'Cena',type:'dinner'},{id:'d',name:'Drinks',type:'drinks'},{id:'p',name:'Pranzo',type:'lunch'},{id:'e',name:'Eventi'}]
it('orders by exact local-hour boundaries, retains extras and original input',()=>{for(const [hour,expected] of [[5,'d,p,c,e'],[6,'p,c,d,e'],[15,'p,c,d,e'],[16,'c,d,p,e'],[21,'c,d,p,e'],[22,'d,p,c,e']])expect(orderDayMenus(menus,Number(hour)).map(m=>m.id).join(',')).toBe(expected);expect(menus.map(m=>m.id)).toEqual(['c','d','p','e'])})
it('uses type even when names are translated',()=>{expect(orderDayMenus([{id:'d',name:'Abendessen',type:'dinner'},{id:'p',name:'Lunch',type:'lunch'}],10)[0].id).toBe('p')})
it('puts the dedicated Colazione menu (type main) first at every hour',()=>{const withBreakfast=[...menus,{id:'b',name:'Colazione',type:'main'}];for(const hour of [5,8,16,22])expect(orderDayMenus(withBreakfast,hour)[0].id).toBe('b')})
