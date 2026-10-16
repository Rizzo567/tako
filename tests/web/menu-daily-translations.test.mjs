import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../apps/dashboard/public/staff/src/12-menu-translations.js',import.meta.url),'utf8');
const scope=vm.createContext({});vm.runInContext(source.slice(0,source.indexOf('function MenuWorkspaceLanguagesDaily')),scope);
const call=(name,...args)=>scope[name](...args);
const entity={id:'item',name:'Ravioli',description:'Ricotta',translations:{}};
test('translation state marks missing name or description',()=>{assert.equal(call('mwTranslationState',entity,'en'),'missing');assert.equal(call('mwTranslationState',{...entity,translations:{en:{name:'Ravioli'}}},'en'),'missing');});
test('legacy manual translations are distinct from source changes',()=>{assert.equal(call('mwTranslationState',{...entity,translations:{en:{name:'Ravioli',description:'Ricotta'}}},'en'),'legacy');});
test('approved source becomes stale on change, price alone does not stale',()=>{const fingerprint=call('mwTranslationFingerprint',entity);const approved={...entity,translations:{en:{name:'Ravioli',description:'Ricotta',sourceFingerprint:fingerprint,approved:true}}};assert.equal(call('mwTranslationState',approved,'en'),'approved');assert.equal(call('mwTranslationState',{...approved,price:20},'en'),'approved');assert.equal(call('mwTranslationState',{...approved,description:'Spinaci'},'en'),'stale');});
test('completeness counts content plus missing and stale separately',()=>{const doc={defaultLanguage:'it',menus:[{...entity,translations:{en:{name:'Ravioli',description:'Ricotta',sourceFingerprint:'v1:old'}},sections:[{id:'section',name:'Piatti',description:null,translations:{},items:[]}]}]};const s=call('mwTranslationCompleteness',doc,'en');assert.equal(s.total,2);assert.equal(s.complete,1);assert.equal(s.missing,1);assert.equal(s.stale,1);assert.equal(call('mwTranslationCompleteness',doc,'it').complete,2);});

test('unchecking stale approval retains previous fingerprint until explicit review',()=>{const e={...entity,translations:{en:{name:'Ravioli',description:'Old',approved:true,sourceFingerprint:'v1:old'}}};call('mwSetTranslationApproval',e,'en',false);assert.equal(e.translations.en.approved,false);assert.equal(e.translations.en.sourceFingerprint,'v1:old');assert.equal(call('mwTranslationState',e,'en'),'stale');call('mwSetTranslationApproval',e,'en',true);assert.equal(call('mwTranslationState',e,'en'),'approved');});
