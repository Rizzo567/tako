#!/usr/bin/env node
// Genera un CODICE PRO (Ed25519) per sbloccare Nano Banana Pro su un ristorante.
// SOLO Manuel: firma il restaurantId con la chiave PRIVATA segreta (fuori dal repo:
// ~/Documents/brain/tako-pro-private-key.txt). Il codice va incollato dal ristoratore in
// Impostazioni → Funzionalità → "Codice Pro". Vale SOLO per quel restaurantId.
//
// Uso:  node scripts/tako-pro-code.mjs <restaurantId>
import { readFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

const rid = process.argv[2]
if (!rid) { console.error('Uso: node scripts/tako-pro-code.mjs <restaurantId>'); process.exit(1) }

const keyPath = process.env.TAKO_PRO_PRIVATE_KEY ?? join(homedir(), 'Documents', 'brain', 'tako-pro-private-key.txt')
let privB64
try { privB64 = readFileSync(keyPath, 'utf8').trim() }
catch { console.error('Chiave privata non trovata:', keyPath); process.exit(1) }

const key = createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' })
const code = sign(null, Buffer.from(rid, 'utf8'), key).toString('base64')
console.log('restaurantId:', rid)
console.log('CODICE PRO :', code)
