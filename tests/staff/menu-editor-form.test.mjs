// Revisione 22/10: i campi strutturati del pannello Piatto restano locali finché non sono validi per il server.
import {readFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
const src=readFileSync(new URL('../../apps/dashboard/public/staff/src/13-menu-item-form.js',import.meta.url),'utf8');
const code=transformSync(src,{loader:'jsx',jsx:'transform'}).code;
const ctx={window:{},React:{},Intl,console};ctx.window=ctx;runInNewContext(code+'\n;globalThis.__V=MW_ED_VALID;globalThis.__C=MW_ED_CLEAN;',ctx);
const V=ctx.__V,C=ctx.__C;
test('variante senza nome o con prezzo non numerico: non valida (resta locale); con nome: valida',()=>{
 assert.equal(V.variants([{id:'x',name:'',priceModifier:0,available:true}]),false);
 assert.equal(V.variants([{id:'x',name:'  ',priceModifier:0}]),false);
 assert.equal(V.variants([{id:'x',name:'Grande',priceModifier:''}]),false);
 assert.equal(V.variants([{id:'x',name:'Grande',priceModifier:2}]),true);assert.equal(V.variants([]),true);
});
test('link solo https, vuoto = nessun link; programmazione con almeno un giorno; promo > 0',()=>{
 assert.equal(V.externalLink('http://a.it'),false);assert.equal(V.externalLink('https://'),false);assert.equal(V.externalLink('https://tako.it/x'),true);assert.equal(V.externalLink(null),true);
 assert.equal(C.externalLink('  '),null);
 const w={weekdays:[1],start:'12:00',end:'15:00'};
 assert.equal(V.schedule({enabled:true,timezone:'Europe/Rome',windows:[{...w,weekdays:[]}],from:null,until:null}),false);
 assert.equal(V.schedule({enabled:true,timezone:'Europe/Rome',windows:[w],from:'2026-10-30',until:'2026-10-01'}),false);
 assert.equal(V.schedule({enabled:true,timezone:'Europe/Rome',windows:[w],from:null,until:null}),true);assert.equal(V.schedule(undefined),true);
 assert.equal(V.promo({price:0,until:null}),false);assert.equal(V.promo({price:5,until:null}),true);assert.equal(V.promo(null),true);
 assert.equal(V.prepTimeMinutes(''),false);assert.equal(V.costPrice(null),true);
});
