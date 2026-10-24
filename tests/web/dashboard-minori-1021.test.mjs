// Punti minori dashboard (21/10/2026): promo nascosta nei Menu a prezzo fisso, lessico «Sottomenu» nel vecchio schermo Menu,
// scheda PDF nella navigazione mobile, notifiche mobili in basso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';

const req=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const src=f=>readFileSync('apps/dashboard/public/staff/src/'+f,'utf8');
const ctx={window:{},React,useState:React.useState,useEffect:React.useEffect,useRef:React.useRef,Intl,Date,Number,String,Object,Math};
runInNewContext((await transform(src('13-menu-sales.js'),{loader:'jsx'})).code,ctx);
const {MenuWorkspaceSales,MenuWorkspaceSalesMarks}=ctx.window;
const item={id:'i1',name:'Carbonara',price:12,promo:{price:9,until:null},scarcity:{lastPortions:true},available:true};
const html=props=>renderToStaticMarkup(React.createElement(MenuWorkspaceSales,{item,onChange(){},disabled:false,...props}));

test('riquadro piatto: prezzo promo visibile alla carta, nascosto nel menu fisso (dato invariato)',()=>{
 const carta=html({}),fisso=html({fixed:true});
 assert.match(carta,/Prezzo promo/);assert.match(carta,/Fine promo/);
 assert.doesNotMatch(fisso,/Prezzo promo|Fine promo|Resta finché/);assert.match(fisso,/Ultime porzioni/);assert.match(fisso,/Solo oggi/);
 assert.deepEqual(JSON.parse(JSON.stringify(item.promo)),{price:9,until:null},'la promo salvata non si tocca');
});

test('riga piatto: segno «Promo» solo alla carta',()=>{
 const carta=renderToStaticMarkup(React.createElement(MenuWorkspaceSalesMarks,{item})),fisso=renderToStaticMarkup(React.createElement(MenuWorkspaceSalesMarks,{item,fixed:true}));
 assert.match(carta,/Promo/);assert.doesNotMatch(fisso,/Promo/);assert.match(fisso,/Ultime porzioni/);
});

test('editor: il riquadro piatto e la riga ricevono fixed',()=>{
 const w=src('13-menu-workspace.js');
 assert.match(w,/<window\.MenuWorkspaceSales item=\{inspector\} fixed=\{fixed\}/);assert.match(w,/<window\.MenuWorkspaceSalesMarks item=\{item\} fixed=\{fixed\}\/>/);
});

test('vecchio schermo Menu: «Sottomenu», mai «sezione» o «categoria» nei testi visibili',()=>{
 const s=src('06-screens-gestione.js').split('\n').slice(0,180).join('\n');
 const visible=[...s.matchAll(/(?:>([^<>{}]+)<|"([^"]*)"|`([^`]*)`)/g)].map(m=>m[1]||m[2]||m[3]||'').filter(t=>/[a-z]/i.test(t)&&!/^[\w.-]+$/.test(t.trim()));
 for(const t of visible)assert.doesNotMatch(t.replace(/\$\{[^}]*\}/g,''),/\bsezion|\bcategori/i,t);
 for(const t of ['Nuovo sottomenu','Nome sottomenu','Elimina sottomenu','Sottomenu creato','Sottomenu eliminato'])assert.ok(s.includes(t),t);
});

test('telefono: la scheda PDF è nella navigazione del Menu (solo mobile, con permesso pdf)',()=>{
 const w=src('13-menu-workspace.js');
 assert.match(w,/\['qr','Condividi'\],\.\.\.\(mobile\?\[\['print','PDF'\]\]:\[\]\)/);assert.match(w,/id!=='print'\|\|can\('pdf'\)/);
});

test('telefono: notifiche in basso sopra la barra, non più in alto; desktop invariato',()=>{
 const k=src('02-kit.js');
 assert.doesNotMatch(k,/top: 66/);assert.match(k,/querySelector\("\.mobile-bottom-nav"\)/);assert.match(k,/className="ds-toaster-mobile"[^>]*position: "absolute", bottom,/);
 assert.match(k,/position: "absolute", bottom: 22, right: 22/);
});
