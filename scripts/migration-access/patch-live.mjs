import fs from 'node:fs/promises';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const require=createRequire('/Users/manuel/Projects/Tako/Tako/package.json'),{transform}=require('esbuild');
const privateDir=process.env.MIGRATION_PRIVATE_DIR||'/Users/manuel/.config/tako-webapp/migration-access-20261028';
let s=await fs.readFile(privateDir+'/supabase/functions/tako-operational-candidate/index.ts','utf8');
const mapping=JSON.parse(await fs.readFile('/Users/manuel/Documents/brain/output/takomenu-migration-2026-10-27/qr-mapping-candidates.json','utf8'));
const allowed=mapping.filter(x=>x.name!=='Demo').map(x=>x.targetRestaurantId);allowed.push('26050ecd-2e55-4057-a4c5-bff2b449cd47');
const core=(await transform(await fs.readFile(new URL('../../apps/server/src/lib/migration-access/core.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'})).code.replace(/export\s*\{[\s\S]*?\};\s*$/,'');
function once(a,b){const n=s.split(a).length-1;if(n!==1)throw Error('Unsafe patch anchor '+a.slice(0,90)+' count '+n);s=s.replace(a,b)}
const factory=`\n${core}\nlet __takoMigrationAccess;\nfunction migrationAccess(){return __takoMigrationAccess??=createMigrationAccess({db,sql:sql25,bcrypt:bcrypt3,randomPassword:simplePassword,isAgencyUser,requireAuth,cookieName:SESSION_COOKIE,cookieOptions:authCookieOptions,sessionMaxAge:STAFF_SESSION_MAX_AGE,nanoid,allowedTenants:${JSON.stringify(allowed)}})}\n`;
s=factory+s;
once('email: text2("email").notNull().unique(),','email: text2("email").notNull().unique(),\n      username: text2("username"),\n      mustChangePassword: boolean2("must_change_password").default(false).notNull(),\n      temporaryPasswordExpiresAt: timestamp2("temporary_password_expires_at",{withTimezone:true}),');
once('if (!session) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });','if (!session) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });\n  if(session.user.mustChangePassword && !passwordChangeAllowed(req.url,req.method)) return reply.code(403).send({error:{code:"PASSWORD_CHANGE_REQUIRED",message:"Scegli una nuova password prima di continuare."}});');
once('role: scope.role, agency: isAgencyUser(session.user.id) };','role: scope.role, agency: isAgencyUser(session.user.id), username:session.user.username, mustChangePassword:session.user.mustChangePassword };');
once('async function authRoutes(fastify) {','async function authRoutes(fastify) {\n  await migrationAccess().register(fastify);');
once('loginSchema = z12.object({\n      email: z12.string().trim().email().transform((value) => value.toLowerCase()),','loginSchema = z12.object({\n      email: z12.string().trim().min(3).max(254).transform((value) => value.toLowerCase()),');
once('sql25`lower(${users.email}) = ${body2.data.email}`, eq5(users.active, true)','sql25`(lower(${users.email}) = ${body2.data.email} OR lower(${users.username}) = ${body2.data.email})`, eq5(users.active, true)');
once('if (durableLogin) await settle("success");','if(user.mustChangePassword && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt.getTime()<=Date.now())) { if(durableLogin)await settle("failure");else {recordFailedLogin(key5);recordFailedLogin(ipKey)};return reply.code(403).send({error:{code:"TEMP_PASSWORD_EXPIRED",message:"La password provvisoria è scaduta. Contatta Tako."}});}\n      if (durableLogin) await settle("success");');
once('role: user.role, agency: isAgencyUser(user.id) }, restaurant','role: user.role, agency: isAgencyUser(user.id),username:user.username,mustChangePassword:user.mustChangePassword }, restaurant');
once('scope.tenant = ctx.tenant;\n      if (ctx.pending)',`scope.tenant = ctx.tenant;
      const migration = await migrationAccess().turn(tx,ctx,body2,media);
      if(migration){if(migration.say)return answer(migration.say);await answer(sent);return {kind:"migration",say:"",ctx,secret:[migration.secret],deliver:migration.userId};}
      if (ctx.pending)`);
once('restaurant: req.user.role === "menu_editor" ? { id: restaurant.id, name: restaurant.name } : restaurant','restaurant: req.user.mustChangePassword || req.user.role === "menu_editor" ? { id: restaurant.id, name: restaurant.name } : restaurant');
await fs.writeFile(privateDir+'/candidate-index.ts',s,{mode:0o600});
const base=await fs.readFile(privateDir+'/supabase/functions/tako-operational-candidate/index.ts');
await fs.writeFile(privateDir+'/patch-manifest.json',JSON.stringify({at:new Date().toISOString(),baseSourceSha256:createHash('sha256').update(base).digest('hex'),candidateSourceSha256:createHash('sha256').update(s).digest('hex'),allowedTenants:allowed.length,linesAdded:core.split('\n').length}),{mode:0o600});
console.log(JSON.stringify({candidatePrepared:true,bytes:s.length,allowedTenants:allowed.length}));
