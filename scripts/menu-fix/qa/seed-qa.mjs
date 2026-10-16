// Prepara il locale QA "Tako · Verifica web" con i dati di prova usati da qa/ops/tako-verifica-web.json.
// Uso: node --experimental-strip-types scripts/menu-fix/qa/seed-qa.mjs [--apply]
// Solo locale QA (QA_RESTAURANT_IDS, mai clienti). Con --apply: salva lo stato originale in
// ~/.config/tako-webapp/menu-fix-20261016/<id>-qa-original-<ts>.json (ripristinabile con rollback.mjs --backup=...),
// aggiunge sezioni/piatti di prova, salva e pubblica con la stessa verifica di apply-ops. Idempotente: se i dati ci sono già, non fa nulla.
import {QA_RESTAURANT_IDS,backupDir,flag,openLocation,saveAndPublish,atomic,sessionClient,saveSession,requireZodForWrites} from '../live.mjs'
import {parseWorkspace} from '../ops-engine.mjs'

const id='26050ecd-2e55-4057-a4c5-bff2b449cd47',menuId='3af196fb-7c87-4ab5-84c3-7bb067efd377',s1='84d1d0ab-818f-46c9-b6a3-84e4ca6786b5'
if(!QA_RESTAURANT_IDS.has(id))throw Error('locale non QA')
const apply=flag('apply');if(apply)requireZodForWrites()
const item=(id,name,price)=>({id,name,description:null,price,allergens:[],tags:[],additives:[],available:true,hidden:false,variants:[],translations:{}})
const section=(id,name,items)=>({id,parentSectionId:null,name,description:null,active:true,translations:{},items})
const api=await sessionClient()
async function main(){
 const current=await openLocation(api,id)
 const w=structuredClone(current.data),menu=w.menus.find(m=>m.id===menuId),first=menu?.sections.find(s=>s.id===s1)
 if(!first)throw Error('menu/sezione QA attesi non trovati: dati QA cambiati, aggiornare seed e ops')
 if(w.menus.some(m=>m.sections.some(s=>s.id==='62da38c5-b1f5-4fde-be63-9e8038fb5c1f'))){console.log('già preparato, rev',current.revision);return}
 if(current.revision!==current.publishedRevision)throw Error('bozze non pubblicate sul QA')
 first.items.push(item('2f0e9311-04cb-46cd-8ced-756cfe1cfdb2','Cornetto di prova',1.5),item('4c29c47d-a4b6-4b8f-b0ac-34ec832b00de','Calice piccolo di prova',5),item('0fc154b8-364e-421f-a77b-7f1c5bb6c83d','Calice grande di prova',8),item('00530d75-830f-4f84-9123-d9925a28fb79','Piatto da eliminare',4))
 menu.sections.push(section('62da38c5-b1f5-4fde-be63-9e8038fb5c1f','Sezione da spostare',[item('dbb5f2d7-5d42-42f6-b704-93d19f81c77d','Spremuta di prova',3.5)]),section('9cee12f2-422a-49cf-8ec2-a5750535f076','Sezione da eliminare',[item('5bd72538-2635-4c07-b593-aac11a880292','Voce da spostare',2)]))
 if(!apply){console.log('dry-run: pronto (rev',current.revision+')');return}
 const original=`${backupDir}/${id}-qa-original-${Date.now()}.json`
 await atomic(original,{...current,slug:'tako-verifica-web',savedAt:new Date().toISOString(),reason:'stato QA prima del seed menu-fix'})
 const r=await saveAndPublish(api,current,w,parseWorkspace(w))
 console.log('seed',r.state,'rev',r.revision,'/',r.publishedRevision,'\noriginale:',original)
 if(r.state!=='pubblicato')process.exitCode=1
}
try{await main()}finally{await saveSession(api)}
