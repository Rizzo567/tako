// PLACEHOLDER pairing appliance↔cloud (device-code + proof-of-possession, SEC-003).
// Fase 2a monta solo lo scheletro: la logica reale (genera codice, conferma owner,
// claim appliance con pubkey, heartbeat credentials_version) è FASE 2b.
import type { FastifyInstance } from 'fastify'

export async function cloudPairRoutes(fastify: FastifyInstance) {
  // Endpoint informativo: dichiara che il pairing non è ancora attivo.
  fastify.get('/status', async () => ({
    data: { enabled: false, phase: '2b', message: 'Pairing non ancora implementato (Fase 2b).' },
  }))

  // TODO Fase 2b:
  //  - POST /api/pair/code        (owner autenticato → genera pairing code, TTL 10min)
  //  - POST /api/pair/claim       (appliance → invia code + pubkey, attende approvazione)
  //  - POST /api/pair/approve     (owner conferma il device)
  //  - POST /api/pair/heartbeat   (appliance proof-of-possession + sync credentials_version)
}
