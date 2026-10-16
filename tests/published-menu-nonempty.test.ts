import {it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({workspace:null as any,available:[] as {id:string}[]}))
vi.mock('../packages/db/src/index.ts',()=>({menuItems:{restaurantId:'restaurant',available:'available',id:'id'},db:{select:()=>({from:()=>({where:async()=>state.available})})}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({readWorkspace:async()=>state.workspace?{published:state.workspace}:null}))
import{publishedMenu}from'../apps/server/src/lib/published-menu.js'
it('skips active placeholders and menus made empty by hidden or operational availability while preserving populated extras',async()=>{
 const item=(id:string,extra={})=>({id,name:id,available:true,hidden:false,...extra});const menu=(id:string,items:any[])=>({id,name:id,active:true,sections:[{id:id+'-section',name:'section',active:true,parentSectionId:null,items}]});state.workspace={menus:[menu('placeholder',[]),menu('hidden',[item('hidden',{hidden:true})]),menu('unavailable',[item('offline')]),menu('lunch',[item('dish')]),menu('event',[item('event-dish')])]};state.available=[{id:'dish'},{id:'event-dish'}];const before=structuredClone(state.workspace);const result=await publishedMenu('tenant');expect(result?.menus.map(m=>m.id)).toEqual(['lunch','event']);expect(state.workspace).toEqual(before)
})
it('does not initialize or expose draft when no publication exists',async()=>{state.workspace=null;expect(await publishedMenu('tenant')).toBeNull()})
