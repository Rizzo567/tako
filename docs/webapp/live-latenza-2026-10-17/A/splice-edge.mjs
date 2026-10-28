// Bundle edge operativa = bundle ONLINE + solo il delta di questo ramo, verificato sezione per sezione.
// Uso: node …/splice-edge.mjs <bundle-online.ts> <bundle-ramo.ts> <uscita.ts>
// 1) il build del ramo usa una cartella temporanea diversa per image-entry: il nome si riporta a quello online;
// 2) stampa le sezioni (moduli) diverse, nuove o sparite rispetto all'online; 3) scrive l'uscita.
import fs from 'node:fs'
const [online,branch,out]=process.argv.slice(2)
const split=t=>{const secs=[];let cur={name:'__prelude',lines:[]};for(const l of t.split('\n')){const m=/^\/\/ ([^\s]+\.(?:ts|mjs|js|mts|json))$/.exec(l);if(m){secs.push(cur);cur={name:m[1],lines:[l]}}else cur.lines.push(l)}secs.push(cur);return secs.map(s=>({name:s.name,text:s.lines.join('\n')}))}
const a=fs.readFileSync(online,'utf8');let b=fs.readFileSync(branch,'utf8')
const tmp=t=>(t.match(/tako-candidate-build-[A-Za-z0-9]+/)||[])[0]
const ta=tmp(a),tb=tmp(b);if(ta&&tb&&ta!==tb)b=b.split(tb).join(ta)
const A=split(a),B=split(b),am=new Map(A.map(s=>[s.name,s.text])),bm=new Map(B.map(s=>[s.name,s.text]))
const report={online:A.length,branch:B.length,changed:[],added:[],removed:[]}
for(const s of B){if(!am.has(s.name))report.added.push(s.name);else if(am.get(s.name)!==s.text)report.changed.push(s.name)}
for(const s of A)if(!bm.has(s.name))report.removed.push(s.name)
const common=B.filter(s=>am.has(s.name)).map(s=>s.name),orderA=A.filter(s=>bm.has(s.name)).map(s=>s.name)
report.sameOrder=common.join('|')===orderA.join('|')
fs.writeFileSync(out,b);console.log(JSON.stringify(report,null,1))
