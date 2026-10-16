// Prova a secco sugli snapshot privati: node scripts/menu-structure/dry-run.mjs [dir]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {homedir} from 'node:os'
import {plans} from './plan.mjs';import {restructure,summary} from './restructure.mjs'
const dir=process.argv[2]||homedir()+'/.config/tako-webapp/live-translations-20261014'
const links=JSON.parse(await readFile('docs/webapp/customer-links/links.json','utf8'))
let failed=0;const lines=[]
for(const r of links){const snap=JSON.parse(await readFile(`${dir}/${r.id}-before.json`,'utf8'));const plan=plans[r.name];if(!plan){lines.push(`\n## ${r.name}\nNESSUN PIANO`);failed++;continue}
 const out=restructure(snap.data,plan);if(out.errors.length)failed++
 lines.push(`\n## ${r.name}`,'Prima:',...summary(snap.data).map(s=>'  '+s),'Dopo:',...summary(out.workspace).map(s=>'  '+s))
 if(out.removed.length)lines.push('Piatti eliminati:',...out.removed.map(x=>`  - ${x.item}${x.hidden?' (nascosto)':''} — ${x.section}: ${x.reason}`))
 if(out.notes.length)lines.push('Note:',...out.notes.map(n=>'  · '+n))
 if(out.errors.length)lines.push('ERRORI:',...out.errors.map(e=>'  ✗ '+e))}
await writeFile(process.env.OUT||'/dev/stdout',lines.join('\n')+'\n');console.error(JSON.stringify({restaurants:links.length,failed}))
