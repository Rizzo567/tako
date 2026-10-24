import fs from 'node:fs';import {homedir} from 'node:os'
import {q} from '../../bot-haiku-2026-10-21/qa-read.mjs'
const saved=JSON.parse(fs.readFileSync(homedir()+'/.config/tako-webapp/qa-workspace-before-sost-1024.json','utf8'))
const [w]=await q(`SELECT revision,published,draft,published_revision FROM menu_workspaces WHERE restaurant_id='26050ecd-2e55-4057-a4c5-bff2b449cd47'`)
const k=x=>JSON.stringify(x.menus.map(m=>[m.id,m.name,m.active,m.pricing,(m.formulas||[]).map(f=>[f.name,f.price]),m.sections.map(s=>[s.id,s.name,s.items.map(i=>[i.id,i.name,i.price,!!i.hidden,i.available])])]))
console.log('rev',w.revision,'pub',w.published_revision,'published==salvato',k(w.published)===k(saved),'draft==salvato',k(w.draft)===k(saved))
