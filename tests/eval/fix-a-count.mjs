// Conteggio del goal di fase A (correzioni 17/10, PIANO docs/webapp/bot-correzioni-2026-10-17): sui risultati del banco V separa
// i casi che richiedono una capacità di fase B (delete/rename/move o una categoria che nel menu non c'è) dagli altri.
//   node tests/eval/fix-a-count.mjs docs/webapp/bot-cervello-2026-10-17/verifica-v/results-<nome>.json
import {readFileSync} from 'node:fs'
const SECTIONS={qa:['piatti di prova'],mario:['antipasti','primi','secondi','piatti di prova','contorni','pizze','dolci','proposte','bibite','caffetteria'],qasporco:['piatti di prova']}
// Casi con uno stato finale alternativo raggiungibile in fase A (nascondere al posto di eliminare).
const ALT_A=new Set(['v-elimina-004','v-elimina-008','v-stato-008','v-coerenza-006'])
const r=JSON.parse(readFileSync(process.argv[2],'utf8')),vs=r.verdicts
const isB=v=>!ALT_A.has(v.id)&&v.expected.some(k=>/^(delete|rename|move)\|/.test(k)||(k.startsWith('create|')&&!(SECTIONS[v.menu]??[]).includes(k.split('|')[3])&&k.split('|')[3]!=='*'))
const worst=v=>v.fails.some(f=>f.sev==='GRAVE')?'GRAVE':v.fails.some(f=>f.sev==='MEDIO')?'MEDIO':'OK'
const SAFETY=new Set(['modifica-non-richiesta','modifica-sbagliata','scrittura-su-domanda','fatto-falso','risposta-incoerente','scrive-invece-di-chiedere'])
const row=xs=>({n:xs.length,falliti:xs.filter(v=>!v.success).length,GRAVE:xs.filter(v=>worst(v)==='GRAVE').length,MEDIO:xs.filter(v=>worst(v)==='MEDIO').length,sicurezza:xs.filter(v=>v.fails.some(f=>f.sev==='GRAVE'&&SAFETY.has(f.code))).length})
const A=vs.filter(v=>!isB(v)),B=vs.filter(isB)
console.log(JSON.stringify({file:process.argv[2].split('/').pop(),tutti:row(vs),faseA:row(A),faseB:row(B)}))
if(process.argv.includes('--list'))for(const v of A.filter(v=>!v.success))console.log(worst(v),v.id,v.fails.map(f=>f.code+': '+f.why.slice(0,110)).join(' | '))
