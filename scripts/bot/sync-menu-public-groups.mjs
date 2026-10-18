// R10 (18/10/2026): copia GENERATA (mai a mano) della logica dei gruppi pubblici del menu digitale (apps/web/src/lib/menu-category-pages.ts)
// lato server, per il cervello del bot: i nomi che il titolare vede nel menu («Altre proposte», «Secondi e panini»…).
// Il file web è puro (nessun import). Parità verificata da tests/menu-public-groups-parity.test.ts.  Uso: node scripts/bot/sync-menu-public-groups.mjs
import {readFileSync,writeFileSync} from 'node:fs'
const root=new URL('../../',import.meta.url),src='apps/web/src/lib/menu-category-pages.ts',dst='apps/server/src/lib/menu-public-groups.ts'
export const HEADER=`// FILE GENERATO da scripts/bot/sync-menu-public-groups.mjs: copia identica di ${src}. NON modificare a mano.\n`
export const expected=()=>HEADER+readFileSync(new URL(src,root),'utf8')
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop()))writeFileSync(new URL(dst,root),expected())
