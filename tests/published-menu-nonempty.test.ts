import {it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({workspace:null as any,available:[] as {id:string}[]}))
vi.mock('../packages/db/src/index.ts',()=>({menuItems:{restaurantId:'restaurant',available:'available',id:'id'},db:{select:()=>({from:()=>({where:async()=>state.available})})}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({readWorkspace:async()=>state.workspace?{published:state.workspace}:null}))
import{publishedMenu}from'../apps/server/src/lib/published-menu.js'
it('keeps active placeholders flagged empty, skips menus made empty by hidden or operational availability, preserves populated extras',async()=>{
 const item=(id:string,extra={})=>({id,name:id,available:true,hidden:false,...extra});const menu=(id:string,items:any[])=>({id,name:id,active:true,sections:[{id:id+'-section',name:'section',active:true,parentSectionId:null,items}]});state.workspace={menus:[menu('placeholder',[]),menu('hidden',[item('hidden',{hidden:true})]),menu('unavailable',[item('offline')]),menu('lunch',[item('dish')]),menu('event',[item('event-dish')])]};state.available=[{id:'dish'},{id:'event-dish'}];const before=structuredClone(state.workspace);const result=await publishedMenu('tenant');expect(result?.menus.map(m=>m.id)).toEqual(['placeholder','lunch','event']);expect(result?.menus.map(m=>(m as any).empty??false)).toEqual([true,false,false]);expect((result!.menus[0]!.sections[0] as any).empty).toBe(true);expect(state.workspace).toEqual(before)
})
it('does not initialize or expose draft when no publication exists',async()=>{state.workspace=null;expect(await publishedMenu('tenant')).toBeNull()})

// Regola 21/10: «Menu in arrivo» solo per ciò che è vuoto già nel documento pubblicato.
const dish=(id:string,extra={})=>({id,name:id,available:true,hidden:false,...extra})
const sec=(id:string,items:any[],extra={})=>({id,name:id,active:true,parentSectionId:null,items,...extra})
it('empty active menu stays with the flag; all-sold-out menu disappears as before; inactive menu never shows',async()=>{
 state.workspace={menus:[{id:'empty',name:'Pranzo',active:true,sections:[]},{id:'soldout',name:'Cena',active:true,sections:[sec('s1',[dish('x'),dish('y')])]},{id:'off',name:'Spento',active:false,sections:[]},{id:'ok',name:'Bevande',active:true,sections:[sec('s2',[dish('z')])]}]};state.available=[{id:'z'}]
 const result=await publishedMenu('tenant');expect(result?.menus.map(m=>m.id)).toEqual(['empty','ok']);expect((result!.menus[0] as any).empty).toBe(true);expect((result!.menus[1] as any).empty).toBeUndefined()
})
it('empty sottomenu is flagged; sold-out sottomenu stays without flag; parent with populated child is not empty',async()=>{
 state.workspace={menus:[{id:'m',name:'Cena',active:true,sections:[sec('primi',[dish('a')]),sec('dolci',[]),sec('vini',[dish('b')]),sec('rossi',[dish('c')],{parentSectionId:'cantina'}),sec('cantina',[]),sec('bianchi',[],{parentSectionId:'cantina'})]}]};state.available=[{id:'a'},{id:'c'}]
 const m=(await publishedMenu('tenant'))!.menus[0]!;const flag=(id:string)=>(m.sections.find(s=>s.id===id) as any)?.empty
 expect((m as any).empty).toBeUndefined();expect(flag('dolci')).toBe(true);expect(flag('vini')).toBeUndefined();expect(m.sections.find(s=>s.id==='vini')!.items).toEqual([]);expect(flag('cantina')).toBeUndefined();expect(flag('bianchi')).toBe(true);expect(flag('primi')).toBeUndefined()
})
