import type { FastifyRequest, FastifyReply } from 'fastify'
import { db, sessions, users } from '@tako/db'
import { eq, and, gt } from 'drizzle-orm'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } })

  const [session] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!session) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })

  req.user = { id: session.user.id, restaurantId: session.user.restaurantId!, name: session.user.name, email: session.user.email, role: session.user.role }
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply)
    if (!req.user || !roles.includes(req.user.role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { id: string; restaurantId: string; name: string; email: string; role: string }
  }
}
