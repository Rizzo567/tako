// Surgical booking delta: input MUST be freshly downloaded active operational source.
// Never deploys, changes secrets or rebuilds unrelated backend modules.
import fs from 'node:fs/promises';
import {transform} from 'esbuild';
import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/reservations/patch-online-bundle.mjs active-index.ts candidate-index.ts');
const original=await fs.readFile(input,'utf8');
const marker='// apps/server/src/routes/customer.ts\n';
if(original.split(marker).length!==2||original.includes('TakomenuReservationTables20261020'))throw Error('Unexpected/already patched live graph');
const start=original.indexOf(marker),next=original.indexOf('\n// ',start+marker.length);
if(next<0)throw Error('Customer section boundary unavailable');
const section=original.slice(start,next);
for(const declaration of ['eq as eq21, and as and15','import { z as z25 }','function customerRoutes(fastify)','restaurantTimezone2(restaurantId)'])if(!section.includes(declaration))throw Error('Live symbols changed: '+declaration);
if(!original.includes('ne, sql as sql23'))throw Error('Live ne helper changed');
let helper=await fs.readFile('apps/server/src/lib/reservation-tables.ts','utf8');
helper=helper.replace(/^import .*\n/gm,'').replace(/^export /gm,'');
const compiled=(await transform(helper,{loader:'ts',target:'es2022'})).code;
const helperBlock=`var TakomenuReservationTables20261020 = (() => { const and = and15, eq = eq21;\n${compiled}\nreturn {publicReservationRooms,selectedReservationTableError};\n})();\n`;
let source=await fs.readFile('apps/server/src/routes/customer.ts','utf8');
const endpointStart=source.indexOf("  fastify.get('/restaurant/:restaurantId/reservation-availability'");
const endpointEnd=source.indexOf('  // PRENOTAZIONE self-service',endpointStart);
if(endpointStart<0||endpointEnd<0)throw Error('Availability source missing');
let endpoint=source.slice(endpointStart,endpointEnd).replace(/\bz\./g,'z25.').replace(/\beq\(/g,'eq21(').replace(/\brestaurantTimezone\(/g,'restaurantTimezone2(').replace(/\bpublicReservationRooms\(/g,'TakomenuReservationTables20261020.publicReservationRooms(');
endpoint=(await transform(endpoint,{loader:'ts',target:'es2022'})).code;
let patched=section;
const once=(a,b)=>{if(patched.split(a).length!==2)throw Error('Booking patch precondition failed: '+a.slice(0,90));patched=patched.replace(a,b)};
const postStart=patched.indexOf('  fastify.post("/restaurant/:restaurantId/reservation",');
const postEnd=patched.indexOf('  fastify.get("/restaurant/:restaurantId/menu",',postStart);
if(postStart<0||postEnd<0)throw Error('Public booking boundaries changed');
const beforePost=patched.slice(0,postStart),afterPost=patched.slice(postEnd);
let post=patched.slice(postStart,postEnd);
patched=post;
once('    const schema = z25.object({','    if (!z25.string().uuid().safeParse(restaurantId).success) return reply.code(400).send({error:{code:"VALIDATION",message:"Ristorante non valido."}});\n    const schema = z25.object({\n      tableId: z25.string().uuid().optional(),');
once('const { customerName, customerPhone, customerEmail, reminderConsent, partySize, date, time, notes } = parsed.data;','const { tableId, customerName, customerPhone, customerEmail, reminderConsent, partySize, date, time, notes } = parsed.data;');
once('      await lockReservationCapacity(tx, restaurantId);','      await lockReservationCapacity(tx, restaurantId);\n      if (tableId) { const tableError = await TakomenuReservationTables20261020.selectedReservationTableError(tx,restaurantId,tableId,startsAt,partySize); if(tableError) return {error:tableError}; }');
once('const error = await checkReservationCapacity(tx, {\n        restaurantId,','const error = await checkReservationCapacity(tx, {\n        restaurantId,\n        tableId,');
once('        tableId: null,','        tableId: tableId ?? null,');
patched=beforePost+endpoint+'\n'+patched+afterPost;
// Append helper inside this existing module boundary; all other modules preserved byte-for-byte.
const result=original.slice(0,start)+patched+'\n'+helperBlock+original.slice(next);
const split=text=>new Map([...text.matchAll(/^\/\/ ([^\n]+)\n/gm)].map((m,i,all)=>[m[1],text.slice(m.index,all[i+1]?.index??text.length)]));
const oldSections=split(original),newSections=split(result),changed=[];
for(const [name,body] of oldSections)if(body!==newSections.get(name)){if(name!=='apps/server/src/routes/customer.ts')throw Error('Unrelated module changed: '+name);changed.push(name)}
await transform(result,{loader:'ts',target:'es2022'});
await fs.writeFile(output,result,{mode:0o600});
console.log(JSON.stringify({baseSha256:createHash('sha256').update(original).digest('hex'),candidateSha256:createHash('sha256').update(result).digest('hex'),changed,preservedModules:oldSections.size-changed.length,deployed:false}));
