import test from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const path = 'apps/dashboard/public/staff/src/';
const shell = readFileSync(path + '03-shell-nav.js', 'utf8');
const definitions = shell.slice(shell.indexOf('const NAV ='), shell.indexOf('/* ───────────────── desktop sidebar'));
const api = runInNewContext(definitions + '\n({NAV, ROLE_ACCESS, MOBILE_PRIMARY, navAllowed, canNavigate, safeRoute, navParent, findItem, navBadge})', { Object });

test('owner navigation is grouped by task without duplicate legacy screens', () => {
  assert.deepEqual(Array.from(api.NAV, g => g.group), ['Tako', 'Servizio', 'Gestione']);
  assert.deepEqual(Array.from(api.NAV.flatMap(g => g.items), i => i.label), ['Panoramica','Sala','Ordini','Cucina','Cassa','Prenotazioni','Menu','Magazzino','Team','Report']);
  for (const [route, parent] of Object.entries({tavoli:'sala',turni:'staff',dispositivi:'impostazioni',qr:'impostazioni',insights:'statistiche'})) assert.equal(api.navParent(route),parent);
});
test('every role-visible route is authorized; direct shortcuts use the same guard', () => {
  for (const role of Object.keys(api.ROLE_ACCESS)) {
    for (const group of api.navAllowed(role)) for (const item of group.items) assert.equal(api.canNavigate(role,item.id),true);
    for (const id of api.MOBILE_PRIMARY[role]) assert.equal(api.canNavigate(role,id),true);
  }
  for (const role of ['cameriere','chef','cassiere']) for (const id of ['staff','cowork','impostazioni','dispositivi','qr','insights']) assert.equal(api.canNavigate(role,id),false);
  assert.equal(api.safeRoute('chef','cassa'),'kds');
  assert.equal(api.safeRoute('cassiere','comanda'),'cassa');
  assert.equal(api.safeRoute('cameriere','cowork'),'sala');
  assert.equal(api.canNavigate('unexpected-role','menu'),false);
  assert.equal(api.canNavigate('owner','unexpected-route'),false);
});
test('waiter mobile has direct calls and order creation; staff shifts remain reachable', () => {
  assert.deepEqual(Array.from(api.MOBILE_PRIMARY.cameriere),['sala','ordini','chiamate','comanda']);
  for(const role of ['cameriere','chef','cassiere']) assert.ok(api.navAllowed(role).some(g => g.items.some(i => i.id === 'turni' && i.label === 'Team')));
  assert.equal(api.findItem('comanda').label,'Nuovo ordine');
  assert.equal(api.navBadge(api.findItem('chiamate'),{ordini:8,chiamate:2}),2);
});
test('both JSX sources compile with all grouped screens preserved', async () => {
  for(const file of ['03-shell-nav.js','07-app-root.js']) await transform(readFileSync(path+file,'utf8'),{loader:'jsx'});
  const app = readFileSync(path+'07-app-root.js','utf8');
  assert.ok(app.includes('const next=safeRoute(role,id)'));
  assert.ok(app.includes('setRoute(next)'));
  assert.ok(app.includes('/tables/waiter-calls'));
  for(const id of ['sala','tavoli','staff','turni','dispositivi','qr','collega','comanda','chiamate','insights']) assert.ok(app.includes(`case "${id}"`));
});

test('sidebar and mobile navigation render with role-specific labels and no unauthorized settings', async () => {
  const require = createRequire(new URL('../../apps/dashboard/package.json', import.meta.url));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const component = ({ children }) => React.createElement('span', null, children);
  const context = {
    window: {}, React, ReactDOM: {}, ...React,
    ROLES: Object.fromEntries(['owner','cameriere','chef','cassiere'].map(role => [role,{name:role,initials:'TA',label:role}])),
    Icon: component, Tako: component, Avatar: component, IconBtn: component,
    useScrollDown: () => false, useMountTransition: () => ({mounted:false,active:false}),
  };
  const { code } = await transform(shell,{loader:'jsx'});
  runInNewContext(code,context);
  for(const role of ['owner','cameriere','chef','cassiere']) {
    const props={route:'sala',go:()=>{},role,badges:{ordini:2,chiamate:1}};
    const html=renderToStaticMarkup(React.createElement(context.window.Sidebar,props));
    assert.ok(html.includes('Panoramica'));
    assert.equal(html.includes('Impostazioni'),role==='owner');
    const mobile=renderToStaticMarkup(React.createElement(context.window.BottomBar,props));
    if(role==='cameriere') { assert.ok(mobile.includes('Chiamate'));assert.ok(mobile.includes('Nuovo ordine')); }
    if(role==='chef') assert.ok(mobile.includes('Cucina'));
    if(role==='cassiere') assert.ok(mobile.includes('Cassa'));
  }
});

test('SPA navigation retains draft when leave guard rejects and still applies role restrictions',()=>{const app=readFileSync(path+'07-app-root.js','utf8');const body=app.match(/const go = \(id\) => \{([\s\S]*?)\n  \};/)[1];const routes=[];const ctx={role:'owner',route:'menu',window:{__takoMenuLeaveGuard:()=>false},safeRoute:api.safeRoute,setRoute:id=>routes.push(id),setDrawer(){}};const go=runInNewContext(`(id)=>{${body}}`,ctx);go('sala');assert.deepEqual(routes,[]);ctx.window.__takoMenuLeaveGuard=()=>true;go('sala');assert.deepEqual(routes,['sala']);ctx.role='menu_editor';go('cassa');assert.equal(routes.at(-1),'menu');});
