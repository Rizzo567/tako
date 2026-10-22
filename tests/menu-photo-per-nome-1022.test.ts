// Decisione 22/10: foto per nome su tutti gli omonimi + eredità della foto (test deterministici, senza DB).
import {describe,it,expect} from 'vitest'
import {inheritPhotos,inheritedNote,photoTargetsByName,groupOf} from '../apps/server/src/lib/menu-photo-inherit.js'
import {applyActions,appliedMenuText,dishMatches,type MenuRef,type MenuAction} from '../apps/server/src/lib/twilio-menu-ai.js'
import {candidatesFor} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {undoRecordFor,applyUndo} from '../apps/server/src/lib/twilio-menu-hold.js'

const item=(id:string,name:string,extra:any={})=>({id,name,price:10,imageUrl:null,hidden:false,available:true,...extra})
const ws=()=>({menus:[
 {id:'m1',name:'Alla carta',sections:[{id:'s1',name:'Primi',items:[item('a1','Riso giallo'),item('a2','Pasta carbonara')]}]},
 {id:'m2',name:'Menu del giorno',sections:[{id:'s2',name:'Primi',items:[item('b1','riso  giallo!'),item('b2','Carbonara',{hidden:true})]}]},
]})
const refsOf=(w:any):MenuRef[]=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:i.available,hidden:i.hidden,menu:m.name,section:s.name,sectionId:s.id,hasImage:!!i.imageUrl}))))
const img=(w:any,id:string)=>w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items)).find((i:any)=>i.id===id)?.imageUrl??null

describe('foto per nome (A)',()=>{
 it('omonimi in due Menu → entrambi, senza domanda',()=>{const refs=refsOf(ws())
  expect(dishMatches('Riso giallo',refs).map(r=>r.id).sort()).toEqual(['a1','b1'])
  expect(photoTargetsByName('riso giallo',candidatesFor('riso giallo',refs),refs)?.sort()).toEqual(['a1','b1'])
  expect(photoTargetsByName('Risò Giallo.',candidatesFor('Risò Giallo.',refs),refs)?.sort()).toEqual(['a1','b1'])})
 it('nomi diversi → si chiede (null)',()=>{const refs=refsOf(ws());const c=refs.filter(r=>/carbonara/i.test(r.name))
  expect(photoTargetsByName('la carbo',c,refs)).toBeNull()})
 it('scelta del modello su un piatto → tutti i suoi omonimi',()=>{expect(groupOf('b1',refsOf(ws())).sort()).toEqual(['a1','b1'])})
 it('applica, risposta «Foto messa su:» con un punto per riga, annulla toglie da tutti',()=>{const w=ws(),before=structuredClone(w),refs=refsOf(w)
  const acts=['a1','b1'].map(id=>({kind:'image',id,mediaUrl:'https://x/m'}) as MenuAction)
  applyActions(w,acts,{uploads:new Map([['a1','/uploads/t/f.jpg'],['b1','/uploads/t/f.jpg']])})
  expect([img(w,'a1'),img(w,'b1')]).toEqual(['/uploads/t/f.jpg','/uploads/t/f.jpg'])
  expect(appliedMenuText(acts,refs)).toBe('*Confermato.* Foto messa su:\n• Alla carta › Primi › Riso giallo\n• Menu del giorno › Primi › riso  giallo!')
  const rec=undoRecordFor(before,w)!;expect(rec.items.map(i=>i.id).sort()).toEqual(['a1','b1'])
  expect(applyUndo(w,rec).ok).toBe(true);expect([img(w,'a1'),img(w,'b1')]).toEqual([null,null])})
})

describe('eredità della foto (B)',()=>{
 it('piatto creato con omonimo con foto → eredita, con nota',()=>{const w:any=ws();w.menus[0].sections[0].items[0].imageUrl='/uploads/t/riso.jpg';const before=structuredClone(w)
  applyActions(w,[{kind:'create',sectionId:'s2',name:'Pasta Carbonara',price:9} as MenuAction])
  const got=inheritPhotos(before,w),created=w.menus[1].sections[0].items.at(-1)
  expect(created.imageUrl).toBeFalsy() // la pasta carbonara di Alla carta non ha foto
  w.menus[0].sections[0].items[1].imageUrl='/uploads/t/carbo.jpg';const before2=structuredClone(w);applyActions(w,[{kind:'create',sectionId:'s2',name:'Riso Giallo ',price:9} as MenuAction])
  const got2=inheritPhotos(before2,w),c2=w.menus[1].sections[0].items.at(-1)
  expect(got).toEqual([]);expect(c2.imageUrl).toBe('/uploads/t/riso.jpg');expect(got2).toEqual([{id:c2.id,name:'Riso Giallo ',fromMenu:'Alla carta',fromSection:'Primi'}])
  expect(inheritedNote(got2)).toBe('*Riso Giallo*: foto presa da Alla carta')})
 it('piatto rimesso visibile senza foto → eredita; annulla toglie anche la foto ereditata',()=>{const w:any=ws();w.menus[0].sections[0].items[1].imageUrl='/uploads/t/carbo.jpg';w.menus[1].sections[0].items[1].name='pasta carbonara';const before=structuredClone(w)
  w.menus[1].sections[0].items[1].hidden=false;const got=inheritPhotos(before,w)
  expect(got.map(x=>x.id)).toEqual(['b2']);expect(img(w,'b2')).toBe('/uploads/t/carbo.jpg')
  const rec=undoRecordFor(before,w)!;expect(applyUndo(w,rec).ok).toBe(true);expect(img(w,'b2')).toBeNull()})
 it('con foto propria → non sovrascrive',()=>{const w:any=ws();w.menus[0].sections[0].items[0].imageUrl='/uploads/t/riso.jpg';const before=structuredClone(w)
  applyActions(w,[{kind:'create',sectionId:'s2',name:'Riso giallo',price:9} as MenuAction]);const c=w.menus[1].sections[0].items.at(-1);c.imageUrl='/uploads/t/mia.jpg'
  expect(inheritPhotos(before,w)).toEqual([]);expect(c.imageUrl).toBe('/uploads/t/mia.jpg')})
 it('piatto già visibile e invariato o nascosto → niente',()=>{const w:any=ws();w.menus[0].sections[0].items[0].imageUrl='/uploads/t/riso.jpg';const before=structuredClone(w)
  w.menus[1].sections[0].items[0].price=11;applyActions(w,[{kind:'create',sectionId:'s2',name:'riso giallo',price:9} as MenuAction]);w.menus[1].sections[0].items.at(-1).hidden=true
  expect(inheritPhotos(before,w)).toEqual([]);expect(img(w,'b1')).toBeNull()})
 it('più omonimi con foto diverse → quella messa in questa modifica',()=>{const w:any=ws();w.menus[0].sections[0].items[0].imageUrl='/uploads/t/vecchia.jpg';const before=structuredClone(w)
  w.menus[1].sections[0].items[0].imageUrl='/uploads/t/nuova.jpg';w.menus[1].sections[0].items.push(item('b3','Riso giallo'))
  inheritPhotos(before,w);expect(img(w,'b3')).toBe('/uploads/t/nuova.jpg')})
})
