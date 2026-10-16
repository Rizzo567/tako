import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {convertSource} from './menusmart-migration/convert.js';
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js';
async function main(){
const dir='/Users/manuel/.config/tako-webapp/san-galdino-import';
const source=JSON.parse(await readFile(dir+'/source.json','utf8'));
const payload=convertSource(source);const r=payload.restaurants[0];
if(r.workspace.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).length!==62)throw Error('Source count mismatch');
await writeFile(dir+'/converted.json',JSON.stringify(payload),{mode:0o600});
console.log(JSON.stringify({converted:62,sourceId:r.sourceId}));

}
main().catch(e=>{console.error(e.message);process.exitCode=1});
