import {describe,it,expect} from 'vitest'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {planImport,contentHash,completeness,ADMIN_OWNER_ID} from '../scripts/menusmart-migration/import.js'
import {LANGUAGES,stableId} from '../scripts/menusmart-migration/convert.js'
const entry=()=>({sourceId:'source',restaurantId:stableId('tenant'),slug:'restaurant',name:'R',workspace:workspaceSchema.parse({languages:LANGUAGES,menus:[]})})
describe('MenuSmart import guards',()=>{
 it('never overwrites existing tenant or slug collision',()=>{const e=entry();expect(()=>planImport([e],[{id:e.restaurantId,slug:e.slug,settings:{}}])).toThrow('collision');expect(()=>planImport([e],[{id:stableId('other'),slug:e.slug,settings:{}}])).toThrow('collision')})
 it('is idempotent for matching completed marker',()=>{const e=entry(),hash=contentHash({sourceId:e.sourceId,workspace:e.workspace});expect(planImport([e],[{id:e.restaurantId,slug:e.slug,settings:{menusmartImport:{sourceId:e.sourceId,inputHash:hash,status:'complete'}}}])[0].action).toBe('skip');expect(planImport([e],[])[0].action).toBe('create');expect(ADMIN_OWNER_ID).toBe('737fad5f-6615-4860-8393-65e23547a8c4')})
 it('blocks changed input and duplicate IDs',()=>{const e=entry();expect(()=>planImport([e,e],[])).toThrow('Duplicate');expect(()=>planImport([e],[{id:e.restaurantId,slug:e.slug,settings:{menusmartImport:{sourceId:e.sourceId,inputHash:'wrong',status:'complete'}}}])).toThrow('collision')})
 it('detects missing languages and legend translations even with empty menu',()=>{const w=entry().workspace;expect(completeness(w).some(x=>x.language==='ja')).toBe(true);w.languages=['it'];expect(completeness(w).some(x=>x.field==='language-disabled')).toBe(true)})
})
import {mergeTranslations} from '../scripts/menusmart-migration/import.js'
import {finalizationState} from '../scripts/menusmart-migration/finalize.js'
describe('finalization gates',()=>{
 it('preserves baseline design/price while merging translations by ID',()=>{const id=stableId('menu'),base=workspaceSchema.parse({menus:[{id,name:'Menu'}]}),incoming=structuredClone(base);incoming.design.primary='#000000';incoming.menus[0].name='CHANGED';incoming.menus[0].translations.en={name:'English'};const result=mergeTranslations(base,incoming);expect(result.design).toEqual(base.design);expect(result.menus[0].name).toBe('Menu');expect(result.menus[0].translations.en.name).toBe('English')})
 it('handles clean draft, saved translation, published and rejects edited draft',()=>{const base=entry().workspace,translated=structuredClone(base);translated.foodTranslations.en={allergens:'Allergens'};expect(finalizationState({revision:1,draft:base,published:null},base,translated)).toBe('save');expect(finalizationState({revision:2,draft:translated,published:null},base,translated)).toBe('publish');expect(finalizationState({revision:3,draft:translated,published:translated},base,translated,contentHash(translated))).toBe('complete');expect(()=>finalizationState({revision:4,draft:translated,published:translated},base,translated)).toThrow('edited')})
 it('draft marker is preserved for separate finalization and hashes ignore JSONB key order',()=>{const e=entry(),inputHash=contentHash({sourceId:e.sourceId,workspace:e.workspace});expect(planImport([e],[{id:e.restaurantId,slug:e.slug,settings:{menusmartImport:{sourceId:e.sourceId,inputHash,status:'draft'}}}])[0].action).toBe('draft');expect(contentHash({a:1,b:2})).toBe(contentHash({b:2,a:1}))})
})
