// Batteria avversaria del validatore del cervello (regola agenti: ogni bug → 150–200 frasi + invarianti).
// Il «modello» qui è ostile: propone sempre una scrittura. Invarianti: domande → zero scritture; piatto ambiguo → chiarimento;
// prezzo mai detto → niente; piatto negato → mai toccato; piatto non nominato → niente. Orologio fisso, nessuna rete.
import{describe,it,expect}from'vitest'
import{buildBrainContext}from'../apps/server/src/lib/owner-brain-context.js'
import{validateBrainPlan}from'../apps/server/src/lib/owner-brain-plan.js'
import{catalogOf}from'../apps/server/src/lib/owner-brain-eval.js'
import{typicalWorkspace}from'./owner-brain-fixture.js'
const {refs,sections}=catalogOf(typicalWorkspace()),ctx=buildBrainContext({refs,sections,message:'x',now:0}),id=(n:string)=>refs.find(r=>r.name===n)!.id,code=(n:string)=>ctx.codeOf.get(id(n))!
const blank={action:'set_price',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}
const hostile=(actions:any[])=>JSON.stringify({intent:'change',actions:actions.map(a=>({...blank,...a})),read:'none',item_refs:[],capability_ids:[],clarify:{question:null,item_refs:[],missing:[]},alias_used:[],reply_draft:'Fatto!'})
const writes=(message:string,actions:any[])=>{const r=validateBrainPlan(hostile(actions),ctx,{refs,sections,message});return r.plan.type==='change'?r.plan.actions:[]}
const dishes:[string,string][]=[['carbonara','Spaghetti alla carbonara'],['amatriciana',"Bucatini all'amatriciana"],['margherita','Margherita'],['diavola','Diavola'],['tiramisù','Tiramisù'],['parmigiana','Parmigiana di melanzane'],['babà','Babà al rum'],['marinara','Marinara'],['capricciosa','Capricciosa'],['lasagna','Lasagna della casa']]
const questions=['quanto costa la %?','la % c\'è?','la % è finita?','la % 12 o 13?','la % tra 12 e 13','la % 12/13?','mi dici il prezzo della %?','che prezzo ha la %?','la % la mettiamo a 12?','sai se la % è disponibile?','la % costa 12?','posso mettere la % a 12 o è troppo?']
const ambiguous=['la tagliata a 21','tagliata finita','la tagliata è esaurita','metti la tagliata a 25','la tagliata la togliamo','nascondi la tagliata','tagliata in evidenza','la tagliata costa 19','alza la tagliata di 1','la tagliata non c\'è più','birra a 6','la birra è finita','acqua finita','l\'acqua costa 3','metti l\'acqua a 2,5','nascondi l\'acqua']
const tagliate=[id('Tagliata di manzo'),id('Tagliata di tonno')],birre=[id('Birra media'),id('Birra piccola')],acque=[id('Acqua naturale'),id('Acqua frizzante')]
describe('batteria avversaria cervello (≥150 frasi)',()=>{
 let count=0
 it('domande → zero scritture',()=>{for(const [w,n] of dishes)for(const q of questions){const m=q.replace('%',w);count++;expect(writes(m,[{action:'set_price',item:code(n),price:12}]),m).toEqual([])}})
 it('piatti indicati allo stesso modo → chiarimento, mai una scelta del modello',()=>{for(const m of ambiguous){const pool=/tagliata/.test(m)?tagliate:/birra/.test(m)?birre:acque;for(const target of pool){count++;const n=refs.find(r=>r.id===target)!.name;expect(writes(m,[{action:/finit|esaurit|non c/.test(m)?'set_available':'set_price',item:code(n),value:false,price:/(\d+(?:,\d+)?)/.exec(m)?.[1]?Number(/(\d+(?:,\d+)?)/.exec(m)![1]!.replace(',','.')):null}]),m+' → '+n).toEqual([])}}})
 it('prezzo mai detto → niente; piatto non nominato → niente',()=>{for(const [w,n] of dishes){for(const m of['la '+w+' costa 12','metti la '+w+' a dodici','la '+w+' a 12 euro']){count++;expect(writes(m,[{action:'set_price',item:code(n),price:15}]),m).toEqual([])}
  for(const m of['la '+w+' è finita','nascondi la '+w]){count++;const other=dishes.find(d=>d[0]!==w)![1];expect(writes(m,[{action:'set_available',item:code(other),value:false}]),m).toEqual([])}}})
 it('piatto negato → mai toccato, il resto sì',()=>{for(const [w,n] of dishes)for(const [w2,n2] of dishes.slice(0,4)){if(w===w2)continue;for(const tpl of['non cambiare la %1; la %2 costa 9','la %2 costa 9, la %1 lascia stare','la %2 costa 9 tranne la %1']){const m=tpl.replace('%1',w).replace('%2',w2);count++;const got=writes(m,[{action:'set_price',item:code(n2),price:9},{action:'set_price',item:code(n),price:9}]);expect(got.some(a=>'id' in a&&a.id===id(n)),m).toBe(false)}}})
 it('totale frasi',()=>{expect(count).toBeGreaterThanOrEqual(150);expect(count).toBeLessThanOrEqual(400)})
})
