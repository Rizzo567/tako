import type { FastifyInstance } from 'fastify'
import { db, restaurants, menuItemTranslations, menuItems } from '@tako/db'
import { eq, and } from 'drizzle-orm'

/**
 * Endpoint PUBBLICI per il menu multilingua lato cliente (PWA).
 *
 * Progettati per NON toccare `customer.ts` (di un altro agente): la PWA riceve il
 * menu come sempre da `GET /api/customer/restaurant/:id/menu`, poi fa un fetch
 * AGGIUNTIVO delle traduzioni e le applica lato client per `itemId`.
 *
 * Registrati con prefix `/api/customer` → URL finali:
 *   GET /api/customer/menu-languages?restaurantId=...
 *   GET /api/customer/menu-translations?restaurantId=...&lang=...
 *
 * Nessuna autenticazione (come il menu pubblico); espongono solo name/description
 * tradotti, nessun dato interno.
 */
export async function menuI18nRoutes(fastify: FastifyInstance) {
  // Lingue disponibili per il ristorante (per costruire il selettore lato cliente).
  fastify.get('/menu-languages', async (req, reply) => {
    const { restaurantId } = req.query as { restaurantId?: string }
    if (!restaurantId) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'restaurantId required' } })

    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    if (!r) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })

    const s = (r.settings as any) ?? {}
    // Normalizzo a minuscolo: le chiavi lingua devono combaciare con quelle scritte
    // dallo staff (menu.ts normalizza anch'esso a minuscolo).
    const languages: string[] = Array.isArray(s.languages) && s.languages.length
      ? s.languages.map((l: string) => String(l).toLowerCase())
      : ['it']
    const defaultLanguage = String(s.defaultLanguage ?? languages[0] ?? 'it').toLowerCase()
    return { data: { languages, defaultLanguage } }
  })

  // Traduzioni di tutti i piatti del ristorante per una lingua.
  fastify.get('/menu-translations', async (req, reply) => {
    const { restaurantId, lang } = req.query as { restaurantId?: string; lang?: string }
    if (!restaurantId || !lang) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'restaurantId and lang required' } })
    const langNorm = String(lang).toLowerCase()

    // Solo traduzioni di piatti DISPONIBILI: come il menu pubblico (customer.ts filtra
    // available=true), non esporre nomi/descrizioni tradotti di piatti esauriti/bozza.
    const rows = await db
      .select({ itemId: menuItemTranslations.itemId, name: menuItemTranslations.name, description: menuItemTranslations.description })
      .from(menuItemTranslations)
      .innerJoin(menuItems, eq(menuItems.id, menuItemTranslations.itemId))
      .where(and(
        eq(menuItemTranslations.restaurantId, restaurantId),
        eq(menuItemTranslations.lang, langNorm),
        eq(menuItems.available, true),
      ))

    return { data: rows }
  })
}
