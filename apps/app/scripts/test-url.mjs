// Verifier di F7.2 eseguibile senza simulatore né emulatore.
//
// Copre `src/url.ts`, cioè la parte del guscio nativo dove un errore costerebbe di
// più: un indirizzo normalizzato male manda la WebView sull'origine sbagliata e la
// diagnosi arriverebbe solo dopo un giro completo di build native (F7.3/F7.4).
//
//   node --experimental-strip-types apps/app/scripts/test-url.mjs
//
// Node carica il .ts direttamente (solo annotazioni di tipo da rimuovere, nessun
// import): niente build step, nessuna dipendenza di test da installare.

import assert from 'node:assert/strict'
import { enrollFromDeepLink, normalizeBase, originOf, parseLearnedEndpoints } from '../src/url.ts'

let passed = 0
const t = (name, fn) => {
  try {
    fn()
    passed++
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`)
    process.exitCode = 1
  }
}

// ── normalizeBase ────────────────────────────────────────────────────────────
t('host nudo → http + porta dell’appliance', () => {
  assert.equal(normalizeBase('tako.local'), 'http://tako.local:4317')
})
t('emulatore Android: 10.0.2.2:4317 non è uno schema', () => {
  assert.equal(normalizeBase('10.0.2.2:4317'), 'http://10.0.2.2:4317')
})
t('simulatore iOS: localhost:4317', () => {
  assert.equal(normalizeBase('localhost:4317'), 'http://localhost:4317')
})
t('porta esplicita diversa rispettata', () => {
  assert.equal(normalizeBase('192.168.1.50:8080'), 'http://192.168.1.50:8080')
})
t('https del tunnel: nessuna porta aggiunta', () => {
  assert.equal(normalizeBase('https://x.box.takoitalia.com'), 'https://x.box.takoitalia.com')
})
t('slash finale e spazi rimossi', () => {
  assert.equal(normalizeBase('  http://tako.local:4317///  '), 'http://tako.local:4317')
})
t('vuoto/null → null', () => {
  assert.equal(normalizeBase(''), null)
  assert.equal(normalizeBase(null), null)
  assert.equal(normalizeBase('   '), null)
})
t('query e fragment non finiscono nella base', () => {
  assert.equal(normalizeBase('http://tako.local:4317/owner/#enroll=abc'), 'http://tako.local:4317/owner')
})

// ── originOf ─────────────────────────────────────────────────────────────────
t('origine = schema + host + porta', () => {
  assert.equal(originOf('http://tako.local:4317'), 'http://tako.local:4317')
  assert.equal(originOf('https://x.box.takoitalia.com/owner/'), 'https://x.box.takoitalia.com')
})

// ── enrollFromDeepLink ───────────────────────────────────────────────────────
t('codice nel fragment (la forma del QR)', () => {
  assert.equal(enrollFromDeepLink('tako://open#enroll=AbC123'), 'AbC123')
})
t('codice in query string (lettori QR che riscrivono l’URL)', () => {
  assert.equal(enrollFromDeepLink('tako://open?enroll=AbC123'), 'AbC123')
})
t('percent-encoding decodificato', () => {
  assert.equal(enrollFromDeepLink('tako://o#enroll=a%2Bb'), 'a+b')
})
t('deep link senza codice → null', () => {
  assert.equal(enrollFromDeepLink('tako://open'), null)
  assert.equal(enrollFromDeepLink(null), null)
})

// ── parseLearnedEndpoints ────────────────────────────────────────────────────
t('remoto imparato dalla PWA', () => {
  assert.deepEqual(parseLearnedEndpoints({ lan: 'http://tako.local:4317', remote: 'https://x.box.takoitalia.com' }), {
    lan: 'http://tako.local:4317',
    remote: 'https://x.box.takoitalia.com',
  })
})
t('remote null (tunnel spento) è un’informazione vera, non un errore', () => {
  assert.deepEqual(parseLearnedEndpoints({ lan: 'http://tako.local:4317', remote: null }), {
    lan: 'http://tako.local:4317',
    remote: null,
  })
})
t('payload spazzatura → null', () => {
  assert.equal(parseLearnedEndpoints(null), null)
  assert.equal(parseLearnedEndpoints('boh'), null)
  assert.equal(parseLearnedEndpoints({}), null)
})

if (process.exitCode) console.error(`\n${passed} controlli verdi, almeno uno rosso.`)
else console.log(`✓ ${passed} controlli verdi (src/url.ts)`)
