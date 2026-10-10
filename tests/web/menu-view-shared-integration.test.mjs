import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url)),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const menu={id:'menu-1',name:'Cena',sections:[{id:'section-1',name:'Primi',items:[{id:'item-1',name:'Ravioli',price:12,available:true,allergens:['latte'],tags:[]}]}]}
async function render({excluded=new Set(),filterOpen=false,cart=[]}={}){
 const source=readFileSync('apps/web/src/components/MenuView.tsx','utf8').replace(/^import .*$/gm,'').replace('export function MenuView','function MenuView')
 let hook=0,received
 const overrides={0:[{id:'menu-1',name:'Cena'},{id:'menu-2',name:'Pranzo'}],4:menu,8:excluded,9:filterOpen}
 const ctx={React,useState:initial=>[Object.hasOwn(overrides,hook)?overrides[hook++]:((hook++),typeof initial==='function'?initial():initial),()=>{}],useEffect:React.useEffect,useRef:React.useRef,useMemo:React.useMemo,useCallback:React.useCallback,useReducedMotion:()=>true,useCountUp:v=>v,useI18n:()=>({t:key=>key,lang:'it',defaultLang:'it',languages:['it','en'],setLang(){}}),useSessionStore:select=>select({restaurantId:'tenant-1',orderingEnabled:true,setSession(){}}),useCartStore:select=>select({items:cart,add(){}}),formatEuro:v=>`${v} €`,SPRING:{},SPRING_SOFT:{},trAllergen:(_id,_lang,label)=>label,motion:new Proxy({},{get:(_,tag)=>({children,...props})=>React.createElement(tag,Object.fromEntries(Object.entries(props).filter(([key])=>!['initial','animate','exit','transition'].includes(key))),children)}),AnimatePresence:({children})=>children,Sheet:({children,open})=>open?React.createElement('div',null,children):null,Plus:()=>null,Minus:()=>null,Filter:()=>null,Info:()=>null,X:()=>null,WorkspaceMenuRenderer:props=>{received=props;return React.createElement('main',{'data-shared':'true'},props.toolbar,props.menu.sections.length===0?props.emptyState:null)},module:{exports:{}}}
 runInNewContext((await transform(source+'\nmodule.exports=MenuView',{loader:'tsx',jsx:'transform'})).code,ctx)
 const html=renderToStaticMarkup(React.createElement(ctx.module.exports,{onGoCart(){},serviceActions:React.createElement('button',null,'Chiedi al cameriere')}));return {html,received}
}
test('legacy menus use shared renderer, macro tabs/language callbacks and service controls',async()=>{const {html,received}=await render();assert.ok(html.includes('data-shared="true"'));assert.deepEqual(Object.keys(received.design),[]);assert.equal(received.menus.length,2);assert.equal(received.language,'it');assert.equal(typeof received.onSelectMenu,'function');assert.equal(typeof received.onSelectLanguage,'function');assert.ok(html.includes('Chiedi al cameriere'));assert.ok(html.includes('aria-haspopup="dialog"'));assert.ok(!html.includes('<select'));assert.ok(!html.includes('scrollbar-hide'))})
test('allergen filtering retains accessible reset inside shared surface',async()=>{const {html,received}=await render({excluded:new Set(['latte']),filterOpen:true});assert.equal(received.menu.sections.length,0);assert.ok(html.includes('menuNoFilter'));assert.ok(html.includes('reset'));assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('aria-expanded="true"'))})
test('shared layout preserves cart quantities and monetary totals',async()=>{const {html}=await render({cart:[{menuItemId:'item-1',quantity:3,unitPrice:12}]});assert.ok(html.includes('viewCart'));assert.ok(html.includes('36 €'));assert.ok(html.includes('>3<'))})
