/** F2 — API dashboard dei preset settimanali (prefisso /api/menu-workspace/day-presets) e tick del job
 * (prefisso /api/day-presets-cron). Logica in lib/menu-day-presets.ts. */
import { Buffer } from 'node:buffer' // il runtime Deno dell'edge non ha Buffer globale (16/10: tick 500 «Buffer is not defined»)
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { requireRole } from '../middleware/auth.js'
import { ensureWorkspace, WorkspaceConflict, WorkspaceOwnership, WorkspaceTrialLocked } from '../lib/menu-workspace-store.js'
import { activateDayPresets, createDayPreset, deleteDayPreset, DayPresetError, listDayPresets, listOwnerNotices, markOwnerNoticeRead, presetSectionsSchema, publishDayPreset, readDayPreset, runDayPresetAutopublish, setDayPresetAutoPublish, setDayPresetsEnabled, updateDayPreset } from '../lib/menu-day-presets.js'
import { processTranslationQueue } from '../lib/menu-text-translations.js'

const edit = requireRole('owner', 'manager', 'menu_editor')
const uuid = z.string().uuid()
const fail = (reply: FastifyReply, code: number, message: string) => reply.code(code).send({ error: { code: code === 409 ? 'CONFLICT' : code === 404 ? 'NOT_FOUND' : 'VALIDATION', message } })
async function guarded<T>(reply: FastifyReply, work: () => Promise<T>) {
 try { return await work() } catch (e) {
  if (e instanceof DayPresetError) return fail(reply, e.code === 'NOT_FOUND' ? 404 : e.code === 'CONFLICT' ? 409 : 400, e.message)
  if (e instanceof WorkspaceTrialLocked) return reply.code(403).send({ error: { code: 'TRIAL_MENU_PRIVATE', message: e.message } })
  if (e instanceof WorkspaceConflict) return fail(reply, 409, 'Il menu è cambiato: ricarica prima di pubblicare')
  if (e instanceof WorkspaceOwnership) return fail(reply, 404, 'Risorsa non trovata')
  if (e instanceof z.ZodError) return fail(reply, 400, 'Contenuto del preset non valido')
  throw e
 }
}
const idParam = (req: { params: unknown }) => uuid.safeParse((req.params as { id?: string }).id)

export async function menuDayPresetRoutes(fastify: FastifyInstance) {
 fastify.get('/', { preHandler: edit }, async req => { const tenant = req.user!.restaurantId; await ensureWorkspace(tenant); return { data: { ...await listDayPresets(tenant), notices: await listOwnerNotices(tenant) } } })
 fastify.get('/:id', { preHandler: edit }, async (req, reply) => { const id = idParam(req); if (!id.success) return fail(reply, 404, 'Preset non trovato'); const preset = await readDayPreset(req.user!.restaurantId, { presetId: id.data }); return preset ? { data: preset } : fail(reply, 404, 'Preset non trovato') })
 fastify.post('/activate', { preHandler: edit }, async (req, reply) => {
  const body = z.object({ menuId: uuid, source: z.enum(['empty', 'current', 'menu']).default('empty'), fromMenuId: uuid.optional() }).refine(b => b.source !== 'menu' || !!b.fromMenuId, 'fromMenuId richiesto').safeParse(req.body)
  if (!body.success) return fail(reply, 400, body.error.message)
  await ensureWorkspace(req.user!.restaurantId)
  return guarded(reply, async () => ({ data: await activateDayPresets(req.user!.restaurantId, body.data.menuId, body.data.source === 'menu' ? { kind: 'menu', fromMenuId: body.data.fromMenuId! } : { kind: body.data.source }, { actor: req.user!.id }) }))
 })
 fastify.put('/settings/:menuId', { preHandler: edit }, async (req, reply) => {
  const menuId = uuid.safeParse((req.params as { menuId?: string }).menuId), body = z.object({ enabled: z.boolean().optional(), autoPublish: z.boolean().optional() }).safeParse(req.body)
  if (!menuId.success || !body.success) return fail(reply, 400, 'Impostazioni non valide')
  return guarded(reply, async () => {
   const tenant = req.user!.restaurantId
   let settings
   if (body.data.enabled !== undefined) settings = await setDayPresetsEnabled(tenant, menuId.data, body.data.enabled)
   if (body.data.autoPublish !== undefined) settings = await setDayPresetAutoPublish(tenant, menuId.data, body.data.autoPublish)
   return { data: settings ?? null }
  })
 })
 fastify.post('/', { preHandler: edit }, async (req, reply) => {
  const body = z.object({ menuId: uuid, name: z.string().min(1).max(100), source: z.enum(['empty', 'current', 'preset']).default('empty'), fromPresetId: uuid.optional() }).refine(b => b.source !== 'preset' || !!b.fromPresetId, 'fromPresetId richiesto').safeParse(req.body)
  if (!body.success) return fail(reply, 400, body.error.message)
  await ensureWorkspace(req.user!.restaurantId)
  return guarded(reply, async () => reply.code(201).send({ data: await createDayPreset(req.user!.restaurantId, { menuId: body.data.menuId, name: body.data.name, source: body.data.source === 'preset' ? { kind: 'preset', fromPresetId: body.data.fromPresetId! } : { kind: body.data.source }, actor: req.user!.id }) }))
 })
 fastify.put('/:id', { preHandler: edit }, async (req, reply) => {
  const id = idParam(req), body = z.object({ expectedRevision: z.number().int().positive(), name: z.string().min(1).max(100).optional(), sections: presetSectionsSchema.optional() }).safeParse(req.body)
  if (!id.success) return fail(reply, 404, 'Preset non trovato')
  if (!body.success) return fail(reply, 400, body.error.message)
  return guarded(reply, async () => ({ data: await updateDayPreset(req.user!.restaurantId, id.data, body.data) }))
 })
 fastify.delete('/:id', { preHandler: edit }, async (req, reply) => { const id = idParam(req); if (!id.success) return fail(reply, 404, 'Preset non trovato'); return guarded(reply, async () => ({ data: await deleteDayPreset(req.user!.restaurantId, id.data) })) })
 fastify.post('/:id/publish', { preHandler: edit }, async (req, reply) => {
  const id = idParam(req), body = z.object({ expectedRevision: z.number().int().positive() }).safeParse(req.body)
  if (!id.success) return fail(reply, 404, 'Preset non trovato')
  if (!body.success) return fail(reply, 400, body.error.message)
  return guarded(reply, async () => ({ data: await publishDayPreset(req.user!.restaurantId, { presetId: id.data, mode: 'manual', expectedRevision: body.data.expectedRevision, actor: req.user!.id }) }))
 })
 fastify.post('/notices/:id/read', { preHandler: edit }, async (req, reply) => { const id = idParam(req); if (!id.success) return fail(reply, 404, 'Avviso non trovato'); return { data: await markOwnerNoticeRead(req.user!.restaurantId, id.data) } })
}

/** Confronto a tempo costante del segreto del cron (≥32 caratteri, altrimenti la rotta è spenta). */
export function cronSecretValid(received: unknown, secret = process.env.TAKO_PRESET_CRON_SECRET): boolean {
 if (typeof secret !== 'string' || secret.length < 32 || typeof received !== 'string') return false
 const a = Buffer.from(received), b = Buffer.from(secret)
 return a.length === b.length && timingSafeEqual(a, b)
}
/** Tick del job: lo chiama ogni 5 minuti il Worker deploy/cloudflare/preset-cron.mjs. Idempotente. */
export async function menuDayPresetCronRoutes(fastify: FastifyInstance) {
 fastify.post('/tick', { config: { rateLimit: { max: 30, timeWindow: 60000 } }, errorHandler: (e, req, reply) => {
  // Diagnosi senza log: solo con il segreto cron valido il corpo riporta l'errore (anche da hook e plugin della rotta).
  if (!cronSecretValid(req.headers['x-tako-cron-secret'])) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
  const err = e as { name?: unknown; message?: unknown; stack?: unknown; statusCode?: unknown }
  return reply.code(500).send({ error: { code: 'TICK_FAILED', status: err?.statusCode ?? null, name: String(err?.name ?? 'Error'), message: String(err?.message ?? e).slice(0, 300), stack: String(err?.stack ?? '').split('\n').slice(0, 6).join('\n').slice(0, 1200) } })
 } }, async (req, reply) => {
  if (!cronSecretValid(req.headers['x-tako-cron-secret'])) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
  // Dietro segreto valido: in caso di errore il corpo riporta nome, messaggio e prime righe dello stack (nessun dato).
  try {
   const autopublish = await runDayPresetAutopublish()
   // Le traduzioni non bloccano mai la pubblicazione: un errore qui non cambia l'esito del giro.
   const translations = await processTranslationQueue({ maxCalls: 4 }).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
   return { data: { autopublish, translations } }
  } catch (e) {
   const err = e as { name?: unknown; message?: unknown; stack?: unknown }
   return reply.code(500).send({ error: { code: 'TICK_FAILED', name: String(err?.name ?? 'Error'), message: String(err?.message ?? e).slice(0, 300), stack: String(err?.stack ?? '').split('\n').slice(0, 6).join('\n').slice(0, 1200) } })
  }
 })
}
