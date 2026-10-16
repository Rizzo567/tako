// Runs the generator on the private live snapshot. Extra args are forwarded (e.g. --dry-run, --max-hours=8, --models=...).
import {readFile} from 'node:fs/promises';import {parseEnv} from 'node:util';import {spawn} from 'node:child_process';import {dir} from './common.mjs';
const env={...parseEnv(await readFile('apps/server/.env','utf8'))};try{Object.assign(env,Object.fromEntries(Object.entries(parseEnv(await readFile('.env.web','utf8'))).filter(([,v])=>v)))}catch{}
if(!env.GROQ_API_KEY&&!process.argv.includes('--dry-run'))throw Error('Translation provider is not configured');
const child=spawn('pnpm',['--filter','@tako/server','exec','tsx','../../scripts/menusmart-migration/translate.ts',dir+'/current.json',dir+'/translated.json',...process.argv.slice(2)],{env:{...process.env,GROQ_API_KEY:env.GROQ_API_KEY},stdio:'inherit'});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));child.on('exit',code=>{process.exitCode=code??1});
