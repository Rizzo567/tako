import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';import vm from 'node:vm'
const ctx={module:{exports:{}}};vm.runInNewContext(transformSync(readFileSync('apps/web/src/lib/menu-category-pages.ts','utf8'),{loader:'ts',format:'cjs'}).code,ctx);const {macroCategoryGroups}=ctx.module.exports
// Regola COLAZIONE: segnala anche le sezioni da colazione fuori dal menu "Colazione" (sola lettura).
const {isBreakfastMenuName,isBreakfastSection}=await import('./breakfast.mjs')
const links=JSON.parse(readFileSync('docs/webapp/customer-links/links.json','utf8'))
for(const r of links){const d=await (await fetch(`https://takoitalia.com/api/customer/restaurant/${r.id}/menu`)).json()
 for(const m of d.menus){const x=await (await fetch(`https://takoitalia.com/api/customer/restaurant/${r.id}/menu?menuId=${m.id}`)).json()
  if(!isBreakfastMenuName(m.name))for(const s of x.data.sections)if(isBreakfastSection(s))console.log(`${r.slug.padEnd(22)} ${m.name.padEnd(7)} COLAZIONE FUORI POSTO   ← ${s.name}`)
  for(const g of macroCategoryGroups(x.data.sections)){const names=[g.section.sourceName,...g.children.filter(c=>!c.parentSectionId||!x.data.sections.find(s=>s.id===c.parentSectionId)).map(c=>c.sourceName||c.name)];if(process.argv[2]==='all'||['Altre proposte','Proposte e formule','Informazioni ed eventi'].includes(g.section.name))console.log(`${r.slug.padEnd(22)} ${m.name.padEnd(7)} ${g.section.name.padEnd(24)} ← ${names.join(' | ')}`)}}}
