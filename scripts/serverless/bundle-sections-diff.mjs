// Confronto per sezioni (moduli esbuild «// path») tra due bundle edge: quello online salvato e quello locale.
// Serve a vedere PRIMA del deploy cosa sparirebbe dall'edge (moduli presenti online e assenti in locale).
//   node scripts/serverless/bundle-sections-diff.mjs <online-index.ts> [locale=release/serverless/candidate/index.ts]
// «Cambiata» = cambia l'insieme dei letterali stringa della sezione (testi, SQL, chiavi): la sola rinumerazione non conta.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const [onlineFile,localFile='release/serverless/candidate/index.ts']=process.argv.slice(2)
if(!onlineFile)throw new Error('uso: bundle-sections-diff.mjs <online-index.ts> [locale]')
function sections(file){
 const map=new Map();let name='(prologo)',buf=[]
 for(const line of fs.readFileSync(file,'utf8').split('\n')){
  const m=/^\/\/ ((?:apps|packages|scripts|node_modules)\/\S+)$/.exec(line)
  if(m){map.set(name,(map.get(name)??'')+buf.join('\n'));name=m[1];buf=[]}else buf.push(line)
 }
 map.set(name,(map.get(name)??'')+buf.join('\n'))
 return map
}
// Firma di una sezione = insieme dei letterali stringa senza spazi (immune a rinumerazione e formattazione di esbuild).
const norm=s=>createHash('sha256').update([...new Set((s.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)??[]).map(x=>x.replace(/\s+/g,'')))].sort().join('\u0000')).digest('hex').slice(0,12)
const a=sections(onlineFile),b=sections(localFile)
const onlyOnline=[...a.keys()].filter(k=>!b.has(k)),onlyLocal=[...b.keys()].filter(k=>!a.has(k))
const changed=[...a.keys()].filter(k=>b.has(k)&&norm(a.get(k))!==norm(b.get(k)))
const isApp=k=>k.startsWith('apps/')||k.startsWith('packages/')||k.startsWith('scripts/')
console.log(JSON.stringify({online:onlineFile,local:localFile,sections:{online:a.size,local:b.size},
 onlyOnline:onlyOnline.filter(isApp),onlyOnlineDeps:onlyOnline.filter(k=>!isApp(k)).length,
 onlyLocal:onlyLocal.filter(isApp),onlyLocalDeps:onlyLocal.filter(k=>!isApp(k)).length,
 changedApp:changed.filter(isApp)},null,1))
