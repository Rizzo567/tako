import {readFile} from 'node:fs/promises';import {parseEnv} from 'node:util';import {spawn} from 'node:child_process';
const env={...parseEnv(await readFile('apps/server/.env','utf8')),...parseEnv(await readFile('.env.web','utf8'))};
const dir='/Users/manuel/.config/tako-webapp/san-galdino-import';
const c=spawn('pnpm',['--filter','@tako/server','exec','tsx','../../scripts/menusmart-migration/translate-san-galdino.ts',dir+'/prepared.json',dir+'/translated.json'],{env:{...process.env,...env},stdio:'inherit'});c.on('exit',code=>process.exitCode=code??1);
