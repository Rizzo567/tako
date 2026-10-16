// Spike 3a (senza LLM, senza rete): il «cancello» deterministico del parser di onboarding sui prezzi
// come li scrive whisper. Un modello perfetto che restituisce {name, price, evidence} viene comunque
// scartato da verifyOnboardingMenuRow se il prezzo non è letterale nell'evidenza.
// Esegui: npx tsx docs/webapp/feature-vendita-2026-10-16/spike/price-gate.ts
import {verifyOnboardingMenuRow} from '../../../../apps/server/src/lib/onboarding-planner.ts'
type Case={say:string,name:string,price:number,section?:string}
const cases:Case[]=[
 {say:'carbonara 10',name:'carbonara',price:10},
 {say:'carbonara 10 euro',name:'carbonara',price:10},
 {say:'carbonara 10,50',name:'carbonara',price:10.5},
 {say:'carbonara 10.50',name:'carbonara',price:10.5},
 {say:'carbonara 10 euro e 50',name:'carbonara',price:10.5},
 {say:'carbonara 10 e 50',name:'carbonara',price:10.5},
 {say:'carbonara 10 euro e cinquanta',name:'carbonara',price:10.5},
 {say:'carbonara dieci euro',name:'carbonara',price:10},
 {say:'carbonara dieci euro e cinquanta',name:'carbonara',price:10.5},
 {say:'carbonara dieci euro e cinquanta centesimi',name:'carbonara',price:10.5},
 {say:'carbonara dieci e cinquanta',name:'carbonara',price:10.5},
 {say:'carbonara dieci cinquanta',name:'carbonara',price:10.5},
 {say:'carbonara dieci',name:'carbonara',price:10},
 {say:'carbonara dieci e mezzo',name:'carbonara',price:10.5},
 {say:'carbonara dieci euro e mezzo',name:'carbonara',price:10.5},
 {say:'carbonara dodici euro',name:'carbonara',price:12},
 {say:'carbonara dodici',name:'carbonara',price:12},
 {say:'carbonara un euro e cinquanta',name:'carbonara',price:1.5},
 {say:'caffè un euro',name:'caffè',price:1},
 {say:'tiramisù cinque euro',name:'tiramisù',price:5},
 {say:'tiramisù 5 euro',name:'tiramisù',price:5},
 {say:'tiramisù a 5 euro',name:'tiramisù',price:5},
 {say:'tiramisù a cinque euro',name:'tiramisù',price:5},
 {say:'tagliata sedici euro',name:'tagliata',price:16},
 {say:'tagliata ventidue euro',name:'tagliata',price:22},
 {say:'tagliata ventidue e cinquanta',name:'tagliata',price:22.5},
 {say:'tagliata 22 e 50',name:'tagliata',price:22.5},
 {say:'tagliata sedici euro e cinquanta centesimi',name:'tagliata',price:16.5},
 {say:'tagliata di manzo 300 g 18 euro',name:'tagliata di manzo',price:18},
 {say:'carbonara 10 euro amatriciana 9',name:'carbonara',price:10}, // evidenza lunga: due piatti
]
const out:any[]=[]
for(const c of cases){
 const source=c.say
 const row={section:c.section??'Primi',name:c.name,price:c.price,description:'',evidence:c.say}
 const v=verifyOnboardingMenuRow(row as any,source)
 out.push({say:c.say,expected:c.price,accepted:!!v.row,issue:v.issue??null})
}
const ok=out.filter(o=>o.accepted).length
console.log(JSON.stringify({accepted:ok,total:out.length,rejected:out.filter(o=>!o.accepted)},null,1))
