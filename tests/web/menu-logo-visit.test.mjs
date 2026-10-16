import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';import{transform}from'esbuild';
test('restaurant entrance runs once even after logo URL changes and renderer remounts',async()=>{
 const source=readFileSync('apps/web/src/components/AnimatedMenuLogo.tsx','utf8').replace(/^import .*$/gm,'').replace('export function AnimatedMenuLogo','function AnimatedMenuLogo');
 let hooks=[],cursor=0,effects=[];const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
 const context={React,window:{},document:{body:{}},innerWidth:390,innerHeight:844,styles:{},motion:{div:'motion.div',img:'motion.img'},createPortal:node=>node,useReducedMotion:()=>false,luminance:()=>0,MENU_MOTION:{durationMs:{exit:220,reveal:420}},MENU_LOGO_MOTION:{header:840,ease:[.22,1,.36,1]},TakoLoading:()=>null,useRef:value=>({current:value}),useState:initial=>{const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return[hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value}]},useEffect:fn=>effects.push(fn),setTimeout:()=>0,clearTimeout:()=>{},module:{exports:{}}};
 runInNewContext((await transform(source+'\nmodule.exports=AnimatedMenuLogo',{loader:'tsx',jsx:'transform'})).code,context);const Logo=context.module.exports;
 const mount=props=>{hooks=[];cursor=0;effects=[];const tree=Logo(props);for(const effect of effects)effect();return tree};const props={src:'/panuzza.svg?menu=pranzo',alt:'Panuzza',introKey:'panuzza'};
 const first=mount(props);assert.equal(first.children[1].props['data-menu-logo-intro'],true);assert.equal(first.children[0].props.style.opacity,0);
 for(let i=0;i<30;i++){const next=mount({...props,src:'/panuzza.svg?menu='+i});assert.equal(next.children[1],null);assert.equal(next.children[0].props.style.opacity,1)}
 const other=mount({...props,introKey:'victoria'});assert.equal(other.children[1].props['data-menu-logo-intro'],true);
});
test('all deployed wordmark copies are actual vector paths, without embedded raster or filters',()=>{
 const files=['apps/web/public/branding/takomenu-wordmark-v2.svg','apps/dashboard/public/staff/assets/branding/takomenu-wordmark-v2.svg','apps/web/public/branding/takomenu-wordmark.svg','apps/dashboard/public/staff/assets/branding/takomenu-wordmark.svg'];const vector=readFileSync(files[0],'utf8');assert.match(vector,/<path\s/);assert.doesNotMatch(vector,/<image|<filter|base64|<foreignObject/i);assert.ok(Buffer.byteLength(vector)<10000);for(const file of files)assert.equal(readFileSync(file,'utf8'),vector);
});
