// Giudice della batteria 24/10: node controlla.mjs <casi.json> <fixture.json> <uscita-runner.json> [--quiet]
// GRAVE = menu finale diverso dal voluto (modifica sbagliata/persa/fuori dal Menu) o piatto con nome spazzatura;
// MEDIO = domanda inutile (turno noAsk), testo vietato, conferma a vuoto dopo una domanda, risposta vuota o > 30 s.
import {readFileSync} from 'node:fs'
const [casesF,fixF,outF]=process.argv.slice(2),quiet=process.argv.includes('--quiet')
const cases=JSON.parse(readFileSync(casesF,'utf8')),fx=JSON.parse(readFileSync(fixF,'utf8')),out=JSON.parse(readFileSync(outF,'utf8'))
const label=w=>{const o={};for(const m of w.menus){for(const s of m.sections)o[m.name+'›'+s.name]=s.items.filter(i=>!i.hidden).map(i=>i.name+(i.available===false?' (finito)':'')+(Number(i.price)?' '+i.price:''));for(const f of m.formulas??[])o[m.name+'›opzione '+f.name]=[String(f.price)]}return o}
const plain=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9()]+/g,' ').replace(/\b(?:i|il|la|le|lo|gli|l)\b/g,' ').replace(/\s+/g,' ').trim()
const norm=l=>(l??[]).map(plain).sort().join(' | ')
const F0=label(fx)
const JUNK=/^(?:della|del|delle|dei|allora|ehm|nn|si|ok|anche|pure|metti|togli|nei|nel|questa|questo|e|capisco|nn capisco|grazie)\b/i
const isQ=r=>/\?\s*(?:$|\n)|Rispondi \*?s[iì]|rispondi col numero|Va bene\?/i.test(r)
const VUOTO=/Non c.è niente da confermare|Non ho modifiche in (?:attesa|sospeso)|Non c.è niente in sospeso|^Non ho cambiato nulla/
let res=[],tot={ok:0,grave:0,medio:0}
for(const c of cases){const r=out.find(x=>x.id===c.id);if(!r){continue}
 const fails=[]
 if(r.error){fails.push(['GRAVE','errore del giro: '+r.error.slice(0,120)])}
 else{
  const want=(f)=>{const w={...F0};for(const [k,v] of Object.entries(f))w[k]=v;return w}
  const finals=[c.expect.final,...(c.expect.alt??[])].map(want)
  const got=r.final,keys=new Set([...Object.keys(F0),...Object.keys(got)])
  const match=fw=>[...keys].every(k=>fw[k]===null||norm(fw[k])===norm(got[k])) // null = quel sottomenu può cambiare (attesa libera)
  if(!finals.some(match)){const fw=finals[0];const d=[...keys].filter(k=>fw[k]!==null&&norm(fw[k])!==norm(got[k])).map(k=>k+': voluto ['+(fw[k]??[]).join(', ')+'] ottenuto ['+(got[k]??[]).join(', ')+']');fails.push(['GRAVE','menu finale: '+d.join(' ; ')])}
  for(const k of keys){const before=new Set((F0[k]??[]).map(plain));for(const n of got[k]??[])if(!before.has(plain(n))&&JUNK.test(plain(n).replace(/ \(finito\)$/,'')))fails.push(['GRAVE','piatto spazzatura «'+n+'» in '+k])}
  r.turns.forEach((t,i)=>{const rep=t.reply||''
   if(!rep.trim())fails.push(['MEDIO','turno '+i+': risposta vuota'])
   if((c.expect.noAsk??[]).includes(i)&&isQ(rep))fails.push(['MEDIO','turno '+i+': domanda inutile «'+rep.slice(0,110).replace(/\n/g,' / ')+'»'])
   for(const f of c.expect.forbid??[])if(rep.includes(f))fails.push(['MEDIO','turno '+i+': testo vietato «'+f+'» in «'+rep.slice(0,100).replace(/\n/g,' / ')+'»'])
   if(i>0&&isQ(r.turns[i-1].reply||'')&&/^(?:s[iì]|ok|esatto|si si|1)\b/i.test(String(t.said||'').trim())&&VUOTO.test(rep))fails.push(['MEDIO','turno '+i+': sì a una domanda → conferma a vuoto «'+rep.slice(0,90)+'»'])
   if(t.ms>30000)fails.push(['MEDIO','turno '+i+': '+t.ms+' ms'])})}
 const sev=fails.some(f=>f[0]==='GRAVE')?'GRAVE':fails.length?'MEDIO':'ok'
 tot[sev==='ok'?'ok':sev.toLowerCase()]++
 res.push({id:c.id,sev,fails,turns:r.turns?.map(t=>({said:t.said,reply:t.reply,diff:t.diff}))})}
const n=res.length
if(!quiet)for(const x of res.filter(x=>x.sev!=='ok')){console.log('\n['+x.sev+'] '+x.id);for(const f of x.fails)console.log('   - '+f[0]+' '+f[1]);for(const t of x.turns??[])console.log('     > '+JSON.stringify(t.said)+'\n       '+String(t.reply).replace(/\n/g,' / ').slice(0,220)+(t.diff?.length?'\n       Δ '+t.diff.join(' ; ').slice(0,300):''))}
console.log('\nTOTALE '+n+' casi: ok '+tot.ok+' ('+(n?Math.round(tot.ok*1000/n)/10:0)+'%), GRAVI '+tot.grave+', MEDI '+tot.medio)
