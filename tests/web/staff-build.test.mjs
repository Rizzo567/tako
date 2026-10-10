import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {buildStaffWeb} from '../../scripts/build-staff-web.mjs';

test('hosted build compiles all source scripts in order, copies original design, and removes runtime Babel/inline JS',async t=> {
 const dir=await mkdtemp(join(tmpdir(),'tako-staff-build-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const source=resolve('apps/dashboard/public/staff');const before=await readFile(join(source,'index.html'),'utf8');
 const result=await buildStaffWeb(join(dir,'out'));
 assert.equal(result.sources.length,18);assert.equal(result.sources.at(-1),'src/07-app-root.js');
 const html=await readFile(join(result.out,'index.html'),'utf8');
 assert.ok(html.includes('src="app.js"'));assert.ok(html.includes('src="boot.js"'));
 assert.equal(/text\/babel|lib\/babel|onclick=|<script\b(?![^>]*\bsrc=)/i.test(html),false);
 assert.deepEqual((await readdir(join(result.out,'lib'))).sort(),['pdfjs','react-dom.js','react.js']);
 assert.equal(await readFile(join(result.out,'styles.css'),'utf8'),await readFile(join(source,'styles.css'),'utf8'));
 assert.equal(await readFile(join(source,'index.html'),'utf8'),before);
 assert.equal(await readFile(join(result.out,'src/menu-workspace.css'),'utf8'),await readFile(join(source,'src/menu-workspace.css'),'utf8'));
 assert.ok(!((await readdir(join(result.out,'src'))).some(f=>f.endsWith('.js'))));
 assert.ok((await readFile(join(result.out,'lib/pdfjs/pdf.worker.mjs'),'utf8')).length>100000);
 assert.ok((await readFile(join(result.out,'lib/pdfjs/pdf.mjs'),'utf8')).length>100000);
 const app=await readFile(join(result.out,'app.js'),'utf8');assert.equal(/\beval\s*\(|new Function\s*\(/.test(app),false);
 const boot=await readFile(join(result.out,'boot.js'),'utf8');assert.equal(/innerHTML|onclick=/.test(boot),false);assert.ok(boot.includes('textContent'));
 let renders=0;
 const element=()=>({style:{},appendChild(){},append(){},setAttribute(){},addEventListener(){},replaceChildren(){}});
 const context={console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},navigator:{onLine:true},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{readyState:'loading',getElementById:()=>null,createElement:element,head:element(),body:element(),addEventListener(){}},React:{createElement:(type,props,...children)=>({type,props,children}),createContext:()=>({}),Component:class{}},ReactDOM:{createRoot:()=>({render:()=>renders++})},addEventListener(){},dispatchEvent(){}};
 context.window=context;
 runInNewContext(app,context,{timeout:2000});
 assert.equal(renders,1);assert.equal(typeof context.Sidebar,'function');assert.equal(typeof context.LoginGate,'function');assert.equal(typeof context.ScreenCowork,'function');assert.equal(context.canNavigate('chef','cassa'),false);
});
test('source tree cannot be selected as destructive output',async()=> {
 for(const path of ['apps/dashboard/public/staff','apps/dashboard/public','apps/dashboard/public/staff/generated']) await assert.rejects(()=>buildStaffWeb(resolve(path)),/separate/);
});
