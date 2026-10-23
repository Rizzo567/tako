// Regola di Manuel (17/10 sera): DUE O PIÙ parti incerte in un messaggio → le parti chiare restano in sospeso e per OGNI parte
// incerta c'è una domanda nello stesso messaggio (ipotesi se c'è, altrimenti «non l'ho capito»); le risposte completano ciascuna
// parte; «no» pubblica le parti chiare, «annulla» niente. Batteria della riserva deterministica (twilio-menu-hold), orologio fisso.
import{describe,it,expect}from'vitest'
import{holdFromMessage,holdAnswer,holdAsks,type Hold}from'../apps/server/src/lib/twilio-menu-hold.js'
import type{MenuRef,SectionRef}from'../apps/server/src/lib/twilio-menu-ai.js'

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const sections:SectionRef[]=[{id:id(900),name:'Primi',menu:'Menu'},{id:id(901),name:'Secondi',menu:'Menu'},{id:id(902),name:'Dolci',menu:'Menu'},{id:id(903),name:'Piatti di prova',menu:'Menu'}]
const D:[string,number,number][]=[['boh',20,903],['che ne sacc',18,903],['Spaghetti alla carbonara',12,900],['Spaghetti aglio olio e peperoncino',8,900],['Lasagna al forno',11,900],['Tagliata di manzo',19,901],['Tagliata di tonno',21,901],['Cotoletta alla milanese',15,901],['Tiramisù',5,902],['Panna cotta',5,902]]
const refs:MenuRef[]=D.map(([name,price,s],i)=>({id:id(i+1),name,price,available:true,hidden:false,menu:'Menu',section:sections.find(x=>x.id===id(s))!.name,sectionId:id(s)}))
const R=(name:string)=>refs.find(r=>r.name===name)!.id
const CLEAR:[string,{kind:string,id:string}][]=[['la carbonara a 13',{kind:'price',id:R('Spaghetti alla carbonara')}],['la lasagna è finita',{kind:'available',id:R('Lasagna al forno')}],['la cotoletta costa 16',{kind:'price',id:R('Cotoletta alla milanese')}],['il tiramisù a 6',{kind:'price',id:R('Tiramisù')}],['nascondi la panna cotta',{kind:'hidden',id:R('Panna cotta')}]]
const UNC:{text:string,type:string}[]=[{text:'tojibo',type:'remove'},{text:'toglichenesacc',type:'remove'},{text:'la tagliata è finita',type:'choose'},{text:'gli spaghetti a 9',type:'choose'},{text:'xyzzy blabla',type:'unknown'},{text:'frunz vurp',type:'unknown'}]
const joinParts=(ps:string[])=>ps.slice(0,-1).join(', ')+' e '+ps.at(-1)

type Case={msg:string,clear:typeof CLEAR,unc:typeof UNC}
const cases:Case[]=[]
for(let i=0;i<CLEAR.length;i++)for(let a=0;a<UNC.length;a++)for(let b=a+1;b<UNC.length;b++){
 if(UNC[a]!.type==='remove'&&UNC[b]!.type==='remove')continue
 if(UNC[a]!.type==='choose'&&UNC[b]!.type==='choose')continue
 const clear=[CLEAR[i]!,CLEAR[(i+1)%CLEAR.length]!].slice(0,1+(a+b)%2)
 cases.push({msg:joinParts([...clear.map(c=>c[0]),UNC[a]!.text,UNC[b]!.text]),clear,unc:[UNC[a]!,UNC[b]!]})}

describe('due o più parti incerte: domanda per ciascuna, parti chiare in sospeso',()=>{
 let n=0
 it('il messaggio diventa UNA domanda con tutte le parti incerte e niente pubblicato',()=>{
  for(const c of cases){n++;const h=holdFromMessage(c.msg,sections,refs);expect(h&&'hold' in h,c.msg).toBe(true);if(!h||!('hold' in h))continue
   const hold=h.hold,asks=holdAsks(hold)
   expect(asks.map(a=>a.type).sort(),c.msg).toEqual(c.unc.map(u=>u.type).sort())
   expect(hold.actions.map(a=>a.kind+'|'+('id' in a?a.id:'')).sort(),c.msg).toEqual(c.clear.map(x=>x[1].kind+'|'+x[1].id).sort())
   for(const u of c.unc){if(u.type==='unknown')expect(h.text,c.msg).toContain(`«${u.text}» non l’ho capito`);if(u.type==='remove')expect(h.text,c.msg).toMatch(/intendi \*togliere (boh|che ne sacc)\*/);if(u.type==='choose')expect(h.text,c.msg).toMatch(/quale intendi\?\n1\. \*/)}
   expect(h.text).toContain('Non ho ancora cambiato nulla')}})
 const hold=(c:Case)=>(holdFromMessage(c.msg,sections,refs) as {hold:Hold}).hold
 it('«no» pubblica solo le parti chiare; «annulla» niente',()=>{
  for(const c of cases){n+=2;const hh=hold(c);const no=holdAnswer('no',hh,refs);expect(no!=='cancel'&&no?.actions.length,c.msg).toBe(c.clear.length);expect(no!=='cancel'&&no?.remaining,c.msg).toBeUndefined();expect(holdAnswer('annulla',hh,refs),c.msg).toBe('cancel')}})
 it('risposte con le lettere completano ciascuna parte; mai un piatto non chiesto',()=>{
  for(const c of cases){n++;const hh=hold(c),asks=holdAsks(hh)
   const answer=asks.map((a,i)=>String.fromCharCode(65+i)+' '+(a.type==='remove'?'sì':a.type==='choose'?'la seconda':'la panna cotta è finita')).join(', ')
   const r=holdAnswer(answer,hh,refs);expect(r&&r!=='cancel',c.msg+' → '+answer).toBe(true);if(!r||r==='cancel')continue
   expect(r.remaining,c.msg+' → '+answer).toBeUndefined()
   const allowed=new Set([...hh.actions.flatMap(a=>'id' in a?[a.id]:[]),...asks.flatMap(a=>a.type==='remove'?[a.id]:a.type==='choose'?a.options:a.type==='unknown'?[R('Panna cotta')]:[])])
   for(const a of r.actions)expect(allowed.has((a as any).id),c.msg+' → '+answer).toBe(true)
   expect(r.actions.length,c.msg).toBe(hh.actions.length+asks.length)}})
 it('una risposta parziale lascia aperte le altre domande',()=>{
  for(const c of cases){n++;const hh=hold(c),asks=holdAsks(hh),i=asks.findIndex(a=>a.type==='choose');if(i<0)continue
   const r=holdAnswer('la seconda',hh,refs);expect(r&&r!=='cancel'&&r.remaining?.length,c.msg).toBe(asks.length-1)}})
 it('una sola parte incerta di tipo nuovo resta al flusso di prima (regola prudente di Q)',()=>{
  for(const m of['la carbonara a 13 e xyzzy blabla','la tagliata è finita e la carbonara a 13','la lasagna è finita e gli spaghetti a 9']){n++;expect(holdFromMessage(m,sections,refs),m).toBeNull()}})
 it('numero di frasi',()=>{expect(n).toBeGreaterThanOrEqual(150);expect(n).toBeLessThanOrEqual(400)})
})
