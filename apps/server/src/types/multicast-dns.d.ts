// Tipi minimi per multicast-dns (il pacchetto non ne fornisce). Copre solo ciò
// che usiamo: query handler, respond, destroy.
declare module 'multicast-dns' {
  interface Question {
    name?: string
    type?: string
  }
  interface Query {
    questions?: Question[]
  }
  interface Answer {
    name: string
    type: string
    ttl?: number
    data: string
  }
  interface ResponsePacket {
    answers: Answer[]
  }
  interface MulticastDNS {
    on(event: 'query', handler: (query: Query) => void): void
    on(event: 'error', handler: (err: Error) => void): void
    respond(packet: ResponsePacket): void
    destroy(): void
  }
  export default function mdns(opts?: unknown): MulticastDNS
}
