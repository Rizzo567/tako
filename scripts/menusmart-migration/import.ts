import { createHash, randomBytes } from 'node:crypto'
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { workspaceSchema, type Workspace } from '../../apps/server/src/lib/menu-workspace-contract.js'
import { foodCatalogs } from '../../apps/server/src/lib/menu-workspace-catalogs.js'
import { LANGUAGES, stableId, type Row } from './convert.js'
export const ADMIN_OWNER_ID = '737fad5f-6615-4860-8393-65e23547a8c4'

export const contentHash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
function canonical(v:unknown):unknown {return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v as object).sort().map(k=>[k,canonical((v as Row)[k])])):v}

export function completeness(w: Workspace) {
  const missing: Row[] = [];
  for(const lang of LANGUAGES) {
    if(!w.languages.includes(lang)) {
      missing.push({ language: lang, field: 'language-disabled' });
      continue
    } if(lang === w.defaultLanguage) continue; for(const menu of w.menus) for(const entity of [menu, ...menu.sections.flatMap(s => [s, ...s.items])]) {
      if(!entity.translations[lang]?.name?.trim()) missing.push({ language: lang, id: entity.id, field: 'name' });
      if(entity.description?.trim() && !entity.translations[lang]?.description?.trim()) missing.push({ language: lang, id: entity.id, field: 'description' })
    } for(const key of ['allergens', ...foodCatalogs.allergens.map(a => a.id), ...foodCatalogs.traits.map(a => a.id), ...foodCatalogs.additives.map(a => a.id)]) if(!w.foodTranslations[lang]?.[key]?.trim()) missing.push({ language: lang, field: key })
  } return missing
}
export function planImport(entries: Row[], existing: Row[]) {
  const seen = new Set<string>();
  return entries.map(e => {
    if(seen.has(e.restaurantId)) throw Error('Duplicate tenant in input');
    seen.add(e.restaurantId);
    const w = workspaceSchema.parse(e.workspace), hash = contentHash({ sourceId: e.sourceId, workspace: w });
    const collision = existing.find(r => r.id === e.restaurantId || r.slug === e.slug);
    if(collision && (collision.id !== e.restaurantId || collision.settings?.menusmartImport?.sourceId !== e.sourceId || collision.settings?.menusmartImport?.inputHash !== hash)) throw Error(`Target collision: ${e.slug}`);
    return { ...e, workspace: w, inputHash: hash, missingTranslations: completeness(w), action: collision?.settings?.menusmartImport?.status === 'complete' ? 'skip' : collision?.settings?.menusmartImport?.status === 'draft' ? 'draft' : collision ? 'resume' : 'create' }
  })
}
export function mergeTranslations(base:Workspace,translated:Workspace){
 const result=structuredClone(base),all=(w:Workspace)=>w.menus.flatMap(m=>[m,...m.sections.flatMap(c=>[c,...c.items])]);
 const incoming=new Map(all(translated).map(e=>[e.id,e]));
 if(incoming.size!==all(result).length)throw Error('Translation ID set mismatch');
 for(const e of all(result)){const match=incoming.get(e.id);if(!match)throw Error('Translation source ID missing');e.translations=structuredClone(match.translations)}
 result.foodTranslations=structuredClone(translated.foodTranslations);return workspaceSchema.parse(result)
}
export async function validateAssets(manifest: Row[]) {
  for(const a of manifest) {
    if(a.status !== 'available') continue; const path = a.preprocessedFile ?? a.file;
    if(!path) throw Error('Asset path missing');
    const expected = a.preprocessedSha256 ?? a.sha256;
    if(!expected || createHash('sha256').update(await readFile(path)).digest('hex') !== expected) throw Error('Asset hash mismatch')
  } return manifest
}
export async function remapAssets(w: Workspace, manifest: Row[], tenant: string, save: (tenant: string, bytes: Buffer) => Promise<{ url: string } | { error: string }>) {
  const next = structuredClone(w), urls = new Set([next.design.logoUrl, next.design.coverUrl, next.design.backgroundImageUrl, next.pdf.backgroundImageUrl, ...next.pdfPresets.map(p => p.config.backgroundImageUrl), ...next.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => i.imageUrl)))].filter((x): x is string => !!x)), mapping: Record<string, string> = {};
  for(const url of urls) {
    const asset = manifest.find(a => a.sourceUrl === url && a.status === 'available');
    if(!asset) throw Error('Referenced asset unavailable');
    const stored = await save(tenant, await readFile(asset.preprocessedFile ?? asset.file));
    if('error' in stored) throw Error(`Asset upload rejected for tenant ${tenant}, file ${asset.preprocessedFile ?? asset.file}: ${stored.error}`);
    mapping[url] = stored.url
  } for(const key of ['logoUrl', 'coverUrl', 'backgroundImageUrl'] as const) if(next.design[key]) next.design[key] = mapping[next.design[key]!]!;
  if(next.pdf.backgroundImageUrl) next.pdf.backgroundImageUrl = mapping[next.pdf.backgroundImageUrl]!;
  for(const p of next.pdfPresets) if(p.config.backgroundImageUrl) p.config.backgroundImageUrl = mapping[p.config.backgroundImageUrl]!;
  for(const m of next.menus) for(const s of m.sections) for(const i of s.items) if(i.imageUrl) i.imageUrl = mapping[i.imageUrl]!;
  return { workspace: workspaceSchema.parse(next), mapping }
}
export async function main(args = process.argv.slice(2)) {

  const get = (name: string) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1]
  };
  const execute = args.includes('--execute');
  if(args.includes('--draft') && args.includes('--publish')) throw Error('Draft and publication are mutually exclusive');
  if(execute === args.includes('--plan')) throw Error('Choose exactly --plan or --execute');
  const input = get('--input'), assetPath = get('--assets'), privateDir = get('--output');
  if(!input || !assetPath || !privateDir) throw Error('Required --input converted.json --assets manifest.json --output private-folder');

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if(resolve(privateDir).startsWith(root + '/') || resolve(privateDir) === root) throw Error('Private output must remain outside repository');
  const { loadLocalEnvironment } = await import('../start-webapp.mjs');
  Object.assign(process.env, await loadLocalEnvironment(root));
  const target = new URL(process.env.DATABASE_URL!);
  if(execute && (get('--expected-host') !== target.hostname || get('--expected-user') !== decodeURIComponent(target.username))) throw Error('Explicit expected target host/user mismatch');

  const payload = JSON.parse(await readFile(resolve(input), 'utf8'));
  const assets = await validateAssets(JSON.parse(await readFile(resolve(assetPath), 'utf8')));
  const require = createRequire(resolve(root, 'apps/server/package.json'));
  const { sql, eq } = require('drizzle-orm');
  const bcrypt = require('bcryptjs');
  const { db, restaurants, users } = await import('../../packages/db/src/index.js');
  const existing = await db.select().from(restaurants);
  const admin = await db.select().from(users).where(eq(users.id, ADMIN_OWNER_ID));
  if(admin.length !== 1 || admin[0].role !== 'owner') throw Error('Verified administrator owner not found');
  const plan = planImport(payload.restaurants, existing);
  for(const entry of plan) {
    for(const url of [entry.workspace.design.logoUrl, entry.workspace.design.coverUrl, entry.workspace.design.backgroundImageUrl, entry.workspace.pdf.backgroundImageUrl, ...entry.workspace.pdfPresets.map((p: Row) => p.config.backgroundImageUrl), ...entry.workspace.menus.flatMap((m: Row) => m.sections.flatMap((c: Row) => c.items.map((i: Row) => i.imageUrl)))].filter(Boolean)) if(!assets.some((a: Row) => a.sourceUrl === url && a.status === 'available')) throw Error('Input has referenced unavailable asset');
  }
  const publish = args.includes('--publish');
  if(publish && plan.some(p => p.action !== 'skip' && p.missingTranslations.length)) throw Error('Publication requires complete twelve-language translations');

  console.log(JSON.stringify({ mode: execute ? 'execute' : 'plan', tenants: plan.length, create: plan.filter(p => p.action === 'create').length, resume: plan.filter(p => p.action === 'resume').length, skip: plan.filter(p => p.action === 'skip').length, incomplete: plan.filter(p => p.missingTranslations.length).length, orderingEnabled: false }));
  if(!execute) return;

  await mkdir(resolve(privateDir), { recursive: true, mode: 0o700 });
  await chmod(resolve(privateDir), 0o700);
  const { saveImageBuffer } = await import('../../apps/server/src/lib/image-store.js');
  const { mutateWorkspace } = await import('../../apps/server/src/lib/menu-workspace-store.js');

  for(const entry of plan) {
    if(entry.action === 'skip'||entry.action==='draft') continue; const ownerId = stableId(entry.restaurantId + ':temporary-owner'), email = `menusmart-${entry.restaurantId}@admin.tako.invalid`;
    let password: string;

    const credentialPath = resolve(privateDir, entry.restaurantId + '-credentials.json');
    try {
      const old = JSON.parse(await readFile(credentialPath, 'utf8'));
      if(old.ownerId !== ownerId || old.restaurantId !== entry.restaurantId) throw Error('Credential identity mismatch');
      password = old.password
    } catch(e) {
      if((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      password = randomBytes(32).toString('base64url');
      await writeFile(credentialPath, JSON.stringify({ restaurantId: entry.restaurantId, ownerId, email, password, temporary: true }), { mode: 0o600, flag: 'wx' })
    }
    const prepared = await remapAssets(entry.workspace, assets, entry.restaurantId, saveImageBuffer);
    const importSettings = { sourceId: entry.sourceId, inputHash: entry.inputHash, status: 'importing' };
    const passwordHash = await bcrypt.hash(password, 12);
    let shouldPublish = publish;

    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${entry.restaurantId}))`);
      const match = await tx.select().from(restaurants).where(eq(restaurants.id, entry.restaurantId));
      if(!match.length) {
        await tx.insert(restaurants).values({ id: entry.restaurantId, name: entry.name, slug: entry.slug, logoUrl: prepared.workspace.design.logoUrl, coverUrl: prepared.workspace.design.coverUrl, primaryColor: prepared.workspace.design.primary, settings: { languages: LANGUAGES, defaultLanguage: 'it', customerOrderingEnabled: false, menusmartImport: importSettings } as any });
        await tx.insert(users).values({ id: ownerId, restaurantId: entry.restaurantId, name: 'Accesso amministrativo ' + entry.name, email, passwordHash, role: 'owner' });
        await tx.execute(sql`INSERT INTO web_location_memberships(user_id,restaurant_id,role) VALUES(${ADMIN_OWNER_ID},${entry.restaurantId},'owner')`);
        await tx.execute(sql`INSERT INTO menu_workspaces(restaurant_id,draft,published,revision,published_revision) VALUES(${entry.restaurantId},${JSON.stringify(prepared.workspace)}::jsonb,NULL,1,NULL)`);
        await tx.execute(sql`INSERT INTO menu_workspace_versions(id,restaurant_id,revision,label,snapshot,created_by) VALUES(${stableId(entry.restaurantId + ':import-v1')},${entry.restaurantId},1,'Import MenuSmart',${JSON.stringify(prepared.workspace)}::jsonb,${ADMIN_OWNER_ID})`)
      } else {
        const marker = (match[0].settings as any)?.menusmartImport;
        if(marker?.inputHash !== entry.inputHash || marker?.status !== 'importing') throw Error('Concurrent import or target change');
        const state = await tx.execute(sql`SELECT revision,draft,published FROM menu_workspaces WHERE restaurant_id=${entry.restaurantId} FOR UPDATE`);
        if(contentHash(state[0]?.draft) !== contentHash(prepared.workspace)) throw Error('Resume refused: target draft was modified');
        if(Number(state[0]?.revision) === 2 && publish && contentHash(state[0]?.published) === contentHash(prepared.workspace)) shouldPublish = false;
        else if(Number(state[0]?.revision) !== 1) throw Error('Resume refused: target revision was modified')
      }
    });

    if(shouldPublish) await mutateWorkspace(entry.restaurantId, ADMIN_OWNER_ID, 1, prepared.workspace, true, 'Pubblicazione import MenuSmart');
    await writeFile(resolve(privateDir, entry.restaurantId + '-result.json'), JSON.stringify({ sourceId: entry.sourceId, restaurantId: entry.restaurantId, inputHash: entry.inputHash, published: publish, assetMapping: prepared.mapping, orderingEnabled: false, missingTranslations: entry.missingTranslations }, null, 2), { mode: 0o600 });
    await db.execute(sql`UPDATE restaurants SET settings=jsonb_set(settings,'{menusmartImport,status}',${JSON.stringify(publish?'complete':'draft')}::jsonb),updated_at=now() WHERE id=${entry.restaurantId}`);
    console.log(JSON.stringify({ restaurantId: entry.restaurantId, result: publish ? 'published' : 'draft', orderingEnabled: false }));


  }

}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then(() => process.exit(0)).catch(error => {
  console.error(error.message);
  process.exit(1)
})
