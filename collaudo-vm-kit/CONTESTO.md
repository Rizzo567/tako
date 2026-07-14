# Contesto prodotto — Tako

## Cos'è

**Gestionale completo per ristoranti, local-first**: l'app dell'owner (Tauri) gestisce
menu, sale/tavoli, ordini, conti, inventario, statistiche. I clienti al tavolo
inquadrano un QR e ordinano dal telefono con una **PWA** (14 lingue, pulsanti azione).
Tutto il core gira **in locale nel ristorante** (resiliente a internet instabile):
l'app avvia da sola un **server Node embedded (:4317)** e un **Postgres embedded**.
Modello di business: vendita ai ristoratori; il Mac è la piattaforma matura (v0.1.0,
kit USB pronto), Windows è "Windows-proof" a livello di codice (9 fix + CI verde)
ma **mai collaudato su un Windows vero. Sei qui per questo.**

## Architettura (monorepo pnpm + turbo)

```
tako/
├── apps/app/         ← desktop Tauri (owner). src-tauri/src/lib.rs = bootstrap:
│                        avvia node embedded + Postgres, single-instance lock,
│                        healStaleLock (tasklist), teardown taskkill ad albero,
│                        TAKO_HOME = app_local_data_dir, porta server 4317
├── apps/server/      ← API Fastify + Socket.IO, logica ordini/menu/inventario,
│                        assistente AI owner (41 azioni), WhatsApp copilot (Baileys),
│                        PWA servita da qui; dev :3001, embedded :4317
├── apps/web/         ← PWA cliente (Next) — buildata dentro il bundle desktop
├── apps/dashboard/   ← dashboard cloud (fuori scope collaudo VM)
├── packages/db/      ← schema Drizzle + migrazioni Postgres
├── scripts/          ← build-server-bundle.mjs (node+pg+web nel bundle Tauri),
│                        make-latest-json.mjs (feed updater), pg-portable.mjs (test)
└── infra/updates-worker ← Worker CF updates.takoitalia.com (NON toccare)
```

Auto-update: tauri-plugin-updater → `https://updates.takoitalia.com/latest.json`
(Worker gratuito che proxa la GitHub Release del repo privato, asset firmati
minisign). Installer Windows: NSIS (`Tako_X.Y.Z_x64-setup.exe`), NON firmato
Authenticode → SmartScreen avviserà: atteso.

## Stato Windows (2026-07-15)

- **Fatto a livello codice**: 9 bug Windows-only fixati su main (path, spawn,
  taskkill albero al posto di kill POSIX, healStaleLock via tasklist, node.exe,
  initdb forzato UTF8 — su Windows ereditava WIN1252 e rompeva il cluster,
  fallback pg_ctl per il token admin). CI `windows-test.yml`: 72/72 su
  windows-latest = verifier permanente.
- **Release v0.1.0**: prima release baseline in CI (mac arm64 + win x64), updater
  end-to-end MAI provato su Windows reale.
- **Mancano**: firma Authenticode (rimandata), collaudo runtime fisico = TU.

## Limiti della VM (UTM, Win11 ARM, x64 emulato)

- Lento: il primo avvio (initdb + migrazioni) può metterci MINUTI. Pazienza prima
  di dichiarare un timeout.
- Niente stampanti → skip test stampa.
- Niente mic → skip dettatura vocale.
- WhatsApp/foto AI/assistente cloud richiedono credenziali → SKIP-CREDENZIALI.
- La PWA cliente si testa da Edge nella stessa VM (stesso host del server) e, se la
  rete UTM lo consente, dal telefono di Manuel sullo stesso URL.

## Coordinamento

Il Mac di Manuel ha l'altra istanza Claude (release, review, integrazione fix).
Canale: branch `collaudo-vm-tako` pushato — il Mac lo legge da GitHub. Le release
le pubblica solo il Mac.
