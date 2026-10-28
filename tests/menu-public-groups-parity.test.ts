// R10: la copia server dei gruppi pubblici del menu (nomi «Altre proposte», «Secondi e panini»…) è identica al file web.
import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {expected} from '../scripts/bot/sync-menu-public-groups.mjs'
describe('menu-public-groups',()=>{it('copia generata identica a apps/web/src/lib/menu-category-pages.ts',()=>{
 expect(readFileSync(new URL('../apps/server/src/lib/menu-public-groups.ts',import.meta.url),'utf8')).toBe(expected())})})
