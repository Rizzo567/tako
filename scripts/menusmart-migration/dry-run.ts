import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {convertSource,type Source} from './convert.js'
async function main(){
const [input,output]=process.argv.slice(2)
if(!input||!output)throw Error('Usage: dry-run.ts <private-source-folder> <new-private-output-folder>')
const source:Source={},hashes:Record<string,string>={}
for(const table of ['public_restaurants','menu_sections','categories','dishes','allergens','dish_allergens','dish_attributes','dish_attribute_assignments','lunch_menu_formulas','restaurant_languages']){
 const text=await readFile(join(resolve(input),table+'.json'),'utf8')
 hashes[table]=createHash('sha256').update(text).digest('hex')
 source[table]=JSON.parse(text)
}
const converted=convertSource(source)
await mkdir(resolve(output),{mode:0o700})
await writeFile(join(resolve(output),'converted.json'),JSON.stringify(converted,null,2),{mode:0o600,flag:'wx'})
await writeFile(join(resolve(output),'manifest.json'),JSON.stringify({version:1,sourceHashes:hashes,counts:converted.counts,warnings:converted.warnings,orderingEnabled:false},null,2),{mode:0o600,flag:'wx'})
console.log(JSON.stringify({status:'DRY_RUN_ONLY',counts:converted.counts,warnings:converted.warnings.length,dbWrites:0}))

}
main().catch(error=>{console.error(error.message);process.exitCode=1})
