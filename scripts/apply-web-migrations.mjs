#!/usr/bin/env node
import postgres from 'postgres';
import {parseEnv} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {prepareWebSchema} from './prepare-web-schema.mjs';
const env=parseEnv(await readFile(resolve('.env.web'),'utf8'));
const url=new URL(env.DATABASE_URL);
if(url.username!=='postgres.tcfccmvpycivxuxkoqpw'||!url.hostname.endsWith('.pooler.supabase.com')||!env.DATABASE_CA_CERT_PATH)throw new Error('Unexpected managed target');
url.searchParams.delete('sslmode');
const client=postgres(url.toString(),{max:1,onnotice:()=>{},ssl:{ca:readFileSync(env.DATABASE_CA_CERT_PATH,'utf8'),rejectUnauthorized:true}});
try{
 const prepared=prepareWebSchema();
 const history=await client`SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
 for(let index=0;index<history.length;index++)if(history[index].hash!==prepared.migrations[index]?.hash)throw new Error('Existing migration hash mismatch');
 const pending=prepared.migrations.slice(history.length);
 console.log(JSON.stringify({pending:pending.map(row=>row.tag),existing:history.length}));
 if(process.argv[2]!=='--execute')process.exitCode=0;
 else if(pending.length){
  const directory=resolve('/Users/manuel/.config/tako-webapp/backup',`before-parity-${Date.now()}`);await mkdir(directory,{recursive:true,mode:0o700});
  const snapshot=await client.begin('isolation level repeatable read read only',async tx=>{const tables=await tx`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;const rows={};for(const {tablename} of tables)rows[tablename]=await tx`SELECT * FROM ${tx('public.'+tablename)}`;return rows;});
  await writeFile(resolve(directory,'data.json'),JSON.stringify(snapshot),{mode:0o600});await writeFile(resolve(directory,'migration-history.json'),JSON.stringify(history),{mode:0o600});
  await client.begin(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(hashtext('tako-web-operational-migrate'))`;
   const current=await tx`SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at`;
   if(JSON.stringify(current.map(row=>row.hash))!==JSON.stringify(history.map(row=>row.hash)))throw new Error('Migration history changed');
   for(const migration of pending){for(const statement of migration.executedSql.split('--> statement-breakpoint'))if(statement.trim())await tx.unsafe(statement);await tx`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(${migration.hash},${migration.when})`;}
  });
  console.log(JSON.stringify({applied:pending.map(row=>row.tag),backup:directory}));
 }
}finally{await client.end();}
