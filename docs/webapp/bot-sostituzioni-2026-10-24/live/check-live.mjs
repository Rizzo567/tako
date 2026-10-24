// node check-live.mjs <uscita live.mjs> <nome attesa in attese-luisa.json> — menu finale dal vivo = voluto (sottomenu attesi; tutto il resto come all'inizio)
import fs from 'node:fs'
const [outF,name]=process.argv.slice(2),o=JSON.parse(fs.readFileSync(outF,'utf8')),exp=JSON.parse(fs.readFileSync(new URL('./attese-luisa.json',import.meta.url),'utf8'))[name]
const plain=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9()]+/g,' ').replace(/\b(?:i|il|la|le|lo|gli|l)\b/g,' ').replace(/\s+/g,' ').trim()
const norm=l=>(l??[]).map(plain).sort().join(' | ')
const want={...o.start};for(const [k,v] of Object.entries(exp))want[k.replace('›',' › ')]=v
const keys=new Set([...Object.keys(want),...Object.keys(o.end)]),d=[...keys].filter(k=>norm(want[k])!==norm(o.end[k])).map(k=>k+': voluto ['+(want[k]??[]).join(', ')+'] ottenuto ['+(o.end[k]??[]).join(', ')+']')
const ms=o.steps.map(s=>s.ms),bad=o.steps.filter(s=>s.status!==200||s.ms>30000)
console.log(JSON.stringify({caso:name,differenze:d.length,dettaglio:d,messaggi:o.steps.length,maxMs:Math.max(...ms),p50:ms.sort((a,b)=>a-b)[Math.floor(ms.length/2)],fuoriTempoOErrori:bad.length},null,1))
