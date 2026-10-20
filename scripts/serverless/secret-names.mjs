// Inventario dei secret delle Edge Function (sola lettura, GET Management API): una riga «nome impronta» per secret.
// L'impronta è sha256(nome+valore restituito dall'API) troncata a 12: confronta prima/dopo senza mai mostrare valori.
//   node scripts/serverless/secret-names.mjs > before.txt   …   node scripts/serverless/secret-names.mjs > after.txt
//   diff before.txt after.txt   → devono comparire SOLO le righe dei secret nuovi
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const tok=fs.readFileSync(process.env.HOME+'/.config/tako-webapp/supabase-management.env','utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)?.[1]
if(!tok)throw new Error('Management token unavailable')
const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/secrets',{headers:{authorization:'Bearer '+tok},signal:AbortSignal.timeout(20000)})
if(!r.ok)throw new Error('GET secrets '+r.status)
const list=await r.json()
for(const s of list.sort((a,b)=>String(a.name).localeCompare(String(b.name))))
 console.log(s.name+' '+createHash('sha256').update(String(s.name)+'\u0000'+String(s.value??'')).digest('hex').slice(0,12))
