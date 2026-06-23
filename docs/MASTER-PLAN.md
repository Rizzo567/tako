# Tako — Master Plan: "Scarica, apri, opera"

> Documento di architettura del **risultato finale** di Tako e del piano per arrivarci.
> Deciso il 2026-06-23. Vedi anche `~/Documents/brain/decisioni/2026-06-23-tako-deploy-locale-cross-platform.md`.

---

## 1. Visione del risultato finale

Un ristoratore deve poter:

1. **Scaricare** un installer (`Tako-Setup.exe` su Windows, `.dmg` su Mac, `.AppImage/.deb` su Linux).
2. **Installare e aprire** l'app (doppio click). Nessun terminale, nessuna configurazione manuale.
3. Al **primo avvio**: un wizard di onboarding obbligatorio guida la creazione di ristorante, account owner, sale/tavoli, menu, QR, team — una pagina per step, con tutorial inline.
4. Vedere subito un **pannello di controllo** con: stato "Tako attivo", l'indirizzo a cui i dispositivi si collegano (`http://tako.local`), e un **QR grande** per agganciare i tablet dello staff.
5. Da qualsiasi **tablet/telefono** sulla stessa rete: aprire il browser → `tako.local` → login → operativo. I clienti scansionano il QR del tavolo → menu → ordinano.
6. **Chiudere l'app** = sistema spento. **Riaprirla** = operativo in <2s. I dati persistono (Postgres embedded su file).

**Modello di ciclo di vita = come AIKE**: l'app desktop *è* il server. Apri → opera, chiudi → giù. **Nessun daemon/servizio di boot.** Il device host (cassa) tiene l'app aperta durante il servizio.

### Principi non negoziabili
- **Local-first / offline**: il cuore funziona senza internet. Dati in casa.
- **Zero-config**: DB e rete si configurano da soli.
- **Cross-platform**: Windows + Mac + Linux dallo stesso codice.
- **Client sottili**: staff e clienti usano un browser/PWA; un solo host serve tutti.

---

## 2. Architettura finale

```
┌─────────────────────────────────────────────────────────┐
│  App desktop Tauri 2  (Windows / Mac / Linux)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Rust shell: al setup() spawna il server come child │  │
│  │  e lo killa alla chiusura della finestra           │  │
│  └───────────────────────────────────────────────────┘  │
│        │ spawn (node + risorse bundle)                   │
│        ▼                                                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ UN processo Fastify (porta 3001, host 0.0.0.0)     │  │
│  │  • /api/*        REST                              │  │
│  │  • /socket.io    realtime                          │  │
│  │  • /uploads/*    immagini/QR                        │  │
│  │  • /staff, /     dashboard staff (statica)         │  │
│  │  • Postgres embedded (avvio automatico)            │  │
│  │  • mDNS → tako.local                                │  │
│  └───────────────────────────────────────────────────┘  │
│        │ webview                                          │
│        ▼  carica http://localhost:3001/staff             │
└─────────────────────────────────────────────────────────┘
        ▲ LAN (tako.local)
        ├── Tablet cameriere  → browser → /staff
        ├── Schermo cucina KDS → browser → /staff (vista cuoco)
        └── Telefono cliente  → QR tavolo → menu cliente
```

### Stack
- **Shell**: Tauri 2 (`apps/app`, Rust). Spawna il server, mostra la dashboard in webview, tray, installer per-OS.
- **Server**: Fastify 5 + Socket.io (`apps/server`) — UN processo che serve API + realtime + dashboard statica + uploads.
- **DB**: PostgreSQL **embedded** (`embedded-postgres`, già dipendenza in `packages/db`) — binari portabili per-OS, avviato come child del server. Drizzle ORM, nessun cambio di dialetto.
- **Dashboard staff**: SPA statica in `apps/dashboard/public/staff` (React + Babel). In produzione **precompilata** (niente Babel-in-browser) e servita dal Fastify.
- **PWA cliente**: `apps/web` (Next.js). Per ora processo separato; consolidamento in F-web.
- **Rete**: mDNS (`tako.local`) per auto-discovery, nessun IP da digitare.

### Perché embedded-postgres e non PGlite
`packages/db` dipende già da `embedded-postgres` e ha `pg-portable.mjs`. embedded-postgres avvia il **vero** Postgres (binari portabili) come processo figlio → zero rischio di incompatibilità dialetto/feature (RLS, numeric, indici già usati nelle migrazioni). Migliore di PGlite per questo schema. Decisione aggiornata di conseguenza.

---

## 3. Stato di partenza (2026-06-23)

| Componente | Stato | Note |
|-----------|-------|------|
| `apps/server` Fastify | ✅ funziona | API + Socket.io + `/uploads`. Bind `0.0.0.0`. Assume Postgres già su. |
| `packages/db` | 🟡 parziale | Drizzle + postgres-js. `embedded-postgres` presente ma **non** agganciato all'avvio (`pg-portable.mjs` standalone). |
| `apps/dashboard` Next | 🟡 ridondante | Shell Next solo per i rewrite; la UI vera è `public/staff` statica Babel-in-browser. |
| `apps/web` Next | ✅ funziona | PWA cliente. Rotta dinamica `r/[id]/t/[token]` → non esportabile statica senza refactor. |
| `apps/app` Expo+Tauri | 🟡 scheletro | Webview → `:3000/staff`. **Non** spawna il server. Rust minimale. |
| Onboarding wizard | 🟡 dati pronti | `SETUP` steps wired ai dati reali; manca il flusso obbligatorio primo-avvio. |
| Service worker | 🔴 bug | Fallback navigate serve `/dashboard` vuoto → schermo bianco a server giù. |

---

## 4. Piano a fasi

### F0 — Consolidamento server (backbone) ✅ questa sessione
- Fastify serve la **dashboard staff statica** a `/staff` + redirect `/`. Stesso-origine → niente più rewrite Next → la dashboard non dipende più dal processo Next `:3000`.
- Fix del **service worker** (no white-screen fallback).

### F1 — DB embedded automatico ✅ questa sessione
- `packages/db` espone `startEmbeddedDb()` (avvia embedded-postgres, data dir per-OS, migrazioni Drizzle idempotenti).
- Il server, con `EMBEDDED_DB=1`, avvia il DB **prima** di servire. "Apri → DB pronto".

### F2 — Shell Tauri spawna il server ✅ questa sessione (scaffold + compile)
- Rust `setup()`: spawna il server come child (node + risorse bundle), porta dinamica, kill alla chiusura.
- Window → `http://localhost:<porta>/staff`. Script `tauri dev`/`build`.

### F3 — Zero-config rete + onboarding
- mDNS publisher nel server → `tako.local`.
- Wizard onboarding obbligatorio al primo avvio (riusa `SETUP`), tutorial per pagina, schermata "collega dispositivi" con QR.

### F4 — Packaging & distribuzione
- `tauri build` → installer Windows/Mac/Linux. Bundle di node + server + binari Postgres come risorse Tauri. Firma/notarizzazione dove serve.
- Updater controllato.

### F-web — Consolidamento PWA cliente
- Refactor rotta dinamica cliente per servirla dal Fastify (statica o seconda risorsa), oppure secondo child Tauri. Toglie il processo Next `:3002`.

### F5 — Hybrid cloud (opzionale, dopo)
- Sync backup + accesso remoto owner + multi-sede. Offline resta il default; il cloud è additivo.

---

## 5. Decisioni bloccate (autonome)
- DB embedded = **embedded-postgres** (non PGlite).
- Packaging = **Tauri 2**, ciclo di vita ad app (no daemon).
- Produzione = **un solo processo Fastify** serve API + realtime + dashboard statica.
- Dashboard staff in prod = **precompilata** (no Babel runtime).
- Customer PWA consolidata in una fase dedicata (blocco: rotta dinamica Next).
