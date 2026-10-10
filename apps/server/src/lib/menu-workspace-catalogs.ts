export const foodCatalogs = {
 allergens: ['glutine','crostacei','uova','pesce','arachidi','soia','latte','frutta-a-guscio','sedano','senape','sesamo','solfiti','lupini','molluschi'].map((id,index)=>({id,label:['Cereali con glutine','Crostacei','Uova','Pesce','Arachidi','Soia','Latte','Frutta a guscio','Sedano','Senape','Sesamo','Anidride solforosa e solfiti','Lupini','Molluschi'][index],number:index+1})),
 traits:[{id:'vegetariano',label:'Vegetariano'},{id:'vegano',label:'Vegano'},{id:'piccante',label:'Piccante'},{id:'surgelato',label:'Surgelato'},{id:'senza-glutine',label:'Senza glutine'},{id:'senza-lattosio',label:'Senza lattosio'},{id:'biologico',label:'Biologico'},{id:'locale',label:'Locale'}],
 additives:[{id:'coloranti',label:'Coloranti'},{id:'conservanti',label:'Conservanti'},{id:'antiossidanti',label:'Antiossidanti'},{id:'edulcoranti',label:'Edulcoranti'},{id:'esaltatori-sapidita',label:'Esaltatori di sapidità'},{id:'stabilizzanti',label:'Stabilizzanti'},{id:'emulsionanti',label:'Emulsionanti'},{id:'addensanti',label:'Addensanti'},{id:'acidificanti',label:'Acidificanti'},{id:'antiagglomeranti',label:'Antiagglomeranti'},{id:'agenti-lievitanti',label:'Agenti lievitanti'},{id:'agenti-rivestimento',label:'Agenti di rivestimento'},{id:'gas-imballaggio',label:'Gas di imballaggio'}],
 version:1, note:'Catalogo Tako; conservare le etichette legacy non riconosciute. Dichiarazioni alimentari curate dal ristoratore.'
}
export const stylePresets=[
 {id:'tako',name:'Tako',design:{preset:'tako',font:'sans',layout:'list',background:'#f8f5ef',text:'#242628',primary:'#ed725b',categoryBackground:'#242628',categoryText:'#ffffff'}},
 {id:'editorial',name:'Editoriale',design:{preset:'editorial',font:'serif',layout:'compact',background:'#fffdf8',text:'#29251f',primary:'#80573d',categoryBackground:'#ede7db',categoryText:'#29251f'}},
 {id:'night',name:'Notturno',design:{preset:'night',font:'sans',layout:'cards',background:'#181a1c',text:'#f4f1ea',primary:'#ed725b',categoryBackground:'#282b2e',categoryText:'#f4f1ea'}}
]
