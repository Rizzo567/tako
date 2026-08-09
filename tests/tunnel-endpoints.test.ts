// F1.2 — Dual-endpoint LAN-first: hostname remoto pubblicato e servito.
//
// Copre i due lati del contratto:
//  (a) la VALIDAZIONE difensiva dell'hostname remoto (isValidRemoteHost), che è la stessa
//      funzione usata dall'heartbeat lato cloud prima di scrivere cloud_appliances.remote_host
//      e dall'appliance prima di pubblicarlo → un solo predicato, nessuna divergenza;
//  (b) la costruzione dei due endpoint (lanBaseUrl/remoteBaseUrl) e la loro esposizione su
//      GET /api/system/info, che è ciò che l'app owner legge per sapere dove parlare.
//
// La persistenza vera dell'heartbeat (valido → scritto, malformato → ignorato con il valore
// precedente intatto) è verificata contro la route e il DB reali nella suite del control-plane:
// apps/server/tests/cloud/pairing.test.ts (`pnpm --filter @tako/server test:cloud`), dove
// esiste già il Postgres effimero + le migrazioni cloud. Qui non è replicabile: il server
// locale su :3001 gira in TAKO_MODE=local e non monta /api/pair/*.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTestEnv, SERVER, type TestEnv } from './helpers'
import { isValidRemoteHost, remoteBaseUrl, lanBaseUrl } from '../apps/server/src/lib/network.js'

let env: TestEnv
let close: () => Promise<void>

beforeAll(async () => { ;({ env, close } = await seedTestEnv()) })
afterAll(async () => close())

const auth = () => ({ Authorization: `Bearer ${env.staffToken}` })

describe('isValidRemoteHost — validazione difensiva dell hostname remoto', () => {
  it('accetta FQDN pubblici ben formati', () => {
    for (const h of [
      'box.takoitalia.com',
      'osteria-da-mario.box.takoitalia.com',
      'continent-birmingham-personnel-wear.trycloudflare.com',
      'a1.co',
    ]) expect(isValidRemoteHost(h), h).toBe(true)
  })

  it('rifiuta i nomi mDNS *.local (sono l endpoint LAN, non quello remoto)', () => {
    expect(isValidRemoteHost('tako.local')).toBe(false)
    expect(isValidRemoteHost('TAKO.LOCAL')).toBe(false)
  })

  it('rifiuta IP nudi, host a label singola e TLD non alfabetici', () => {
    for (const h of ['192.168.1.50', '10.0.0.1', 'localhost', 'box', 'example.123']) {
      expect(isValidRemoteHost(h), h).toBe(false)
    }
  })

  it('rifiuta schema, porta, path, credenziali e spazi: qui si accetta SOLO l host', () => {
    for (const h of [
      'https://box.takoitalia.com',
      'box.takoitalia.com:8443',
      'box.takoitalia.com/staff',
      'user:pw@box.takoitalia.com',
      'box .takoitalia.com',
    ]) expect(isValidRemoteHost(h), h).toBe(false)
  })

  it('rifiuta label malformate e lunghezze fuori scala', () => {
    for (const h of ['', 'a.b', '-bad.example.com', 'bad-.example.com', 'a..example.com', `${'x'.repeat(250)}.com`]) {
      expect(isValidRemoteHost(h), h || '(vuoto)').toBe(false)
    }
  })
})

describe('remoteBaseUrl / lanBaseUrl — i due endpoint', () => {
  const saved = process.env['TAKO_TUNNEL_HOSTNAME']
  afterAll(() => {
    if (saved === undefined) delete process.env['TAKO_TUNNEL_HOSTNAME']
    else process.env['TAKO_TUNNEL_HOSTNAME'] = saved
  })

  it('senza tunnel configurato remoteBaseUrl è null (appliance LAN-only, degrado pulito)', () => {
    delete process.env['TAKO_TUNNEL_HOSTNAME']
    expect(remoteBaseUrl()).toBeNull()
  })

  it('con hostname valido produce sempre https://<host> (il TLS del tunnel è il punto)', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'Box.TakoItalia.com'
    expect(remoteBaseUrl()).toBe('https://box.takoitalia.com')
  })

  it('un hostname malformato equivale ad assente: mai un remoteUrl spazzatura', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'tako.local'
    expect(remoteBaseUrl()).toBeNull()
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'not a host'
    expect(remoteBaseUrl()).toBeNull()
  })

  it('lanBaseUrl usa il nome mDNS, stabile ai cambi di IP', () => {
    expect(lanBaseUrl()).toMatch(/^http:\/\/[a-z0-9-]+\.local:\d+$/)
  })
})

describe('GET /api/system/info — stato tunnel e due endpoint', () => {
  it('espone tunnel {state,hostname}, lanUrl e remoteUrl', async () => {
    const res = await fetch(`${SERVER}/api/system/info`, { headers: auth() })
    expect(res.status).toBe(200)
    const { data } = await res.json()

    expect(data.tunnel).toBeTruthy()
    expect(['up', 'down', 'disabled']).toContain(data.tunnel.state)
    expect(data.tunnel.hostname === null || typeof data.tunnel.hostname === 'string').toBe(true)

    expect(typeof data.lanUrl).toBe('string')
    expect(data.lanUrl).toMatch(/^http:\/\//)
    expect(data.urls.lan).toBe(data.lanUrl)
    expect(data.urls.remote).toBe(data.remoteUrl)
  })

  it('remoteUrl è coerente con lo stato del tunnel e sempre https', async () => {
    const res = await fetch(`${SERVER}/api/system/info`, { headers: auth() })
    const { data } = await res.json()
    if (data.tunnel.state === 'disabled') {
      // Tunnel spento per questo ristorante → app owner LAN-only, nessun endpoint remoto.
      expect(data.remoteUrl).toBeNull()
    }
    if (data.remoteUrl !== null) {
      expect(data.remoteUrl).toBe(`https://${data.tunnel.hostname}`)
      expect(isValidRemoteHost(data.tunnel.hostname)).toBe(true)
    }
  })

  it('non trapela mai il token del tunnel', async () => {
    const res = await fetch(`${SERVER}/api/system/info`, { headers: auth() })
    const { data } = await res.json()
    // Lo stato pubblico ha ESATTAMENTE due campi: nessuna scorciatoia che ci infili il token.
    expect(Object.keys(data.tunnel).sort()).toEqual(['hostname', 'state'])
    expect(JSON.stringify(data.tunnel).toLowerCase()).not.toContain('token')
  })
})
