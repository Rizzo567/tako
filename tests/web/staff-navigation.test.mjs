import test from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const path = 'apps/dashboard/public/staff/src/';
const shell = readFileSync(path + '03-shell-nav.js', 'utf8');
const definitions = shell.slice(shell.indexOf('const NAV ='), shell.indexOf('/* ───────────────── desktop sidebar'));
const api = runInNewContext(definitions + '\n({NAV, ROLE_ACCESS, MOBILE_PRIMARY, mobilePrimary, navAllowed, canNavigate, safeRoute, navParent, findItem, navBadge})', { Object });

test('owner navigation is grouped by task without duplicate legacy screens', () => {
  assert.deepEqual(Array.from(api.NAV, g => g.group), ['Servizio', 'Gestione']);
  assert.deepEqual(Array.from(api.NAV.flatMap(g => g.items), i => i.label), ['Panoramica','Sala','Ordini','Cucina','Prenotazioni','Menu','Report']);
  for (const [route, parent] of Object.entries({staff:'impostazioni'})) assert.equal(api.navParent(route),parent);
  // Team e Impostazioni non sono voci della sidebar, ma le route legacy restano valide.
  for (const id of ['staff','impostazioni']) assert.equal(api.canNavigate('owner',id),true);
  assert.equal(api.findItem('staff').label,'Team');
});
test('every role-visible route is authorized; direct shortcuts use the same guard', () => {
  for (const role of Object.keys(api.ROLE_ACCESS)) {
    for (const group of api.navAllowed(role)) for (const item of group.items) assert.equal(api.canNavigate(role,item.id),true);
    for (const id of api.MOBILE_PRIMARY[role]) assert.equal(api.canNavigate(role,id),true);
  }
  for (const role of ['cameriere','chef','cassiere']) for (const id of ['staff','cowork','impostazioni','dispositivi','qr','insights']) assert.equal(api.canNavigate(role,id),false);
  assert.equal(api.safeRoute('chef','cassa'),'kds');
  assert.equal(api.safeRoute('cassiere','comanda'),'ordini');
  assert.equal(api.safeRoute('cameriere','cowork'),'sala');
  assert.equal(api.canNavigate('unexpected-role','menu'),false);
  assert.equal(api.canNavigate('owner','unexpected-route'),false);
});
test('removed screens reject saved routes for every role', () => {
  for (const role of Object.keys(api.ROLE_ACCESS)) for (const id of ['cassa','inventario','turni','tavoli','dispositivi','qr','collega','insights']) {
    assert.equal(api.canNavigate(role,id),false);
    assert.notEqual(api.safeRoute(role,id),id);
  }
  assert.deepEqual(Array.from(api.MOBILE_PRIMARY.cameriere),['sala','ordini','chiamate','comanda']);
});
test('both JSX sources compile with all grouped screens preserved', async () => {
  for(const file of ['03-shell-nav.js','07-app-root.js']) await transform(readFileSync(path+file,'utf8'),{loader:'jsx'});
  const app = readFileSync(path+'07-app-root.js','utf8');
  assert.ok(app.includes('const next=safeRoute(role,id)'));
  assert.ok(app.includes('setRoute(next)'));
  assert.ok(app.includes('/tables/waiter-calls'));
  for(const id of ['sala','staff','comanda','chiamate']) assert.ok(app.includes(`case "${id}"`));
});

test('sidebar and mobile navigation render with role-specific labels and no unauthorized settings', async () => {
  const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
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
    // Impostazioni si apre dal menu utente (chiuso al primo render), non è una voce della sidebar.
    assert.equal(html.includes('Impostazioni'),false);
    assert.equal(html.includes('>Team<'),false);
    const mobile=renderToStaticMarkup(React.createElement(context.window.BottomBar,props));
    if(role==='cameriere') { assert.ok(mobile.includes('Chiamate'));assert.ok(mobile.includes('Nuovo ordine')); }
    if(role==='chef') assert.ok(mobile.includes('Cucina'));
    if(role==='cassiere') { assert.ok(mobile.includes('Ordini')); assert.equal(mobile.includes('Cassa'),false); }
  }
});

test('SPA navigation retains draft when leave guard rejects and still applies role restrictions',()=>{const app=readFileSync(path+'07-app-root.js','utf8');const body=app.match(/const go = \(id\) => \{([\s\S]*?)\n {2}\};/)[1];const routes=[];const ctx={role:'owner',route:'menu',window:{__takoMenuLeaveGuard:()=>false},safeRoute:api.safeRoute,setRoute:id=>routes.push(id),setDrawer(){}};const go=runInNewContext(`(id)=>{${body}}`,ctx);go('sala');assert.deepEqual(routes,[]);ctx.window.__takoMenuLeaveGuard=()=>true;go('sala');assert.deepEqual(routes,['sala']);ctx.role='menu_editor';go('cassa');assert.equal(routes.at(-1),'menu');});

test('assistant uses one complete-response request without the Streaming panel',()=>{const chat=readFileSync(path+'11-copilot.js','utf8');assert.equal(chat.includes('/chat/stream'),false);assert.equal(chat.includes('function StreamingPreview'),false);assert.ok(chat.includes('TakoAPI.post("/ai/owner/chat"'));assert.ok(chat.includes('Array.isArray(data.pending)'));});

test('agency navigation is visible only with the server-issued capability', () => {
  for (const enabled of [false, true]) {
    const scoped = runInNewContext(definitions + '\n({navAllowed,canNavigate})', { Object, window: {__takomenuAgency:enabled} });
    assert.equal(scoped.canNavigate('owner','agency'),enabled);
    assert.equal(scoped.navAllowed('owner').some(group=>group.items.some(item=>item.id==='agency')),enabled);
  }
});

test('mobile owner has Menu immediately and agency shortcut requires server grant', () => {
  assert.deepEqual(Array.from(api.mobilePrimary('owner')),['dashboard','menu','cowork']);
  const granted = runInNewContext(definitions + '\n({mobilePrimary})', { Object, window:{__takomenuAgency:true} });
  assert.deepEqual(Array.from(granted.mobilePrimary('owner')),['agency','menu','dashboard']);
  assert.deepEqual(Array.from(granted.mobilePrimary('menu_editor')),['menu']);
});
