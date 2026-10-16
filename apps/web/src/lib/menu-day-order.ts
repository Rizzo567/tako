export type DayMenu={id:string;name:string;type?:string}
// Colazione (regola 16/10/2026): menu dedicato, type 'main', sempre primo nella lista. Riconosciuto dal nome,
// anche tradotto (stesse voci di menu-name-copy), perché il type resta 'main'.
const BREAKFAST=/colazion|breakfast|brunch|fruhstuck|petit-dejeuner|desayuno|pequeno-almoco|ontbijt|sniadanie|завтрак|الإفطار|早餐|朝食/
export function dayMenuKind(menu:Pick<DayMenu,'name'|'type'>):string {
 const name=menu.name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
 if(BREAKFAST.test(name)||BREAKFAST.test(menu.name.toLowerCase()))return 'breakfast'
 if(['lunch','dinner','drinks'].includes(menu.type||''))return menu.type!
 return /pranzo|lunch/.test(name)?'lunch':/drink|cocktail|bevande/.test(name)?'drinks':/cena|dinner|^menu$/.test(name)?'dinner':'other'
}
/** Local device hour, intentionally independent of restaurant/server timezone. Breakfast always leads. */
export function orderDayMenus<T extends DayMenu>(menus:readonly T[],hour:number):T[]{
 const order=hour>=6&&hour<16?['breakfast','lunch','dinner','drinks']:hour>=16&&hour<22?['breakfast','dinner','drinks','lunch']:['breakfast','drinks','lunch','dinner']
 return menus.map((menu,index)=>({menu,index,rank:order.indexOf(dayMenuKind(menu))})).sort((a,b)=>(a.rank<0?order.length:a.rank)-(b.rank<0?order.length:b.rank)||a.index-b.index).map(x=>x.menu)
}
