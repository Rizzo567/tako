// Conflitti bot al Pubblica (22/10): logica pura del riquadro (13-menu-editor-core.js).
import {readFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../../apps/dashboard/public/staff/src/13-menu-editor-core.js',import.meta.url),'utf8');
const ctx={console,setTimeout,clearTimeout};ctx.window=ctx;runInNewContext(src,ctx);
const C=ctx.TakoMenuEditorCore;
test('409 BOT_CONFLICTS riconosciuto (forma {error:{code}} e stringa); altri 409 no',()=>{
 assert.equal(C.isBotConflictsError({status:409,body:{error:{code:'BOT_CONFLICTS'}}}),true);
 assert.equal(C.isBotConflictsError({status:409,body:{error:'BOT_CONFLICTS'}}),true);
 assert.equal(C.isBotConflictsError({status:409,body:{error:{code:'CONFLICT'}}}),false);
 assert.equal(C.isBotConflictsError({status:500,body:{error:{code:'BOT_CONFLICTS'}}}),false);
 assert.equal(C.isBotConflictsError(null),false);
});
test('conflitti dal 409 hanno la precedenza, poi dal riepilogo; nessuno → []',()=>{
 const a=[{kind:'item',id:'1',name:'Frittura',reason:'missing'}],b=[{kind:'section',id:'2',name:'Dolci',reason:'missing'}];
 assert.deepEqual([...C.botConflictsOf({conflicts:a,diff:{botConflicts:b}}).map(x=>x.name)],['Frittura']);
 assert.deepEqual([...C.botConflictsOf({diff:{botConflicts:b}}).map(x=>x.name)],['Dolci']);
 assert.equal(C.botConflictsOf({diff:{details:[]}}).length,0);assert.equal(C.botConflictsOf(null).length,0);assert.equal(C.botConflictsOf({conflicts:[],diff:{}}).length,0);
});
test('testo Sobrio con i nomi (senza doppioni), lessico senza «categoria»',()=>{
 const t=C.botConflictsText([{name:'Frittura'},{name:'Dolci'},{name:'Frittura'}]);
 assert.equal(t,'Da WhatsApp sono state fatte modifiche che non sono in questa bozza: Frittura, Dolci. Se pubblichi, ai clienti tornerà la versione della bozza.');
 assert.doesNotMatch(t,/categori/i);
 assert.equal(C.botConflictsText([]),'Da WhatsApp sono state fatte modifiche che non sono in questa bozza. Se pubblichi, ai clienti tornerà la versione della bozza.');
});
