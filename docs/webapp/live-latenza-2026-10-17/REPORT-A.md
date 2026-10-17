# Latenza live · perimetro A (edge operativa + bot) · REPORT (17/10/2026)

Branch `codex/live-latenza-edge`. Online: **edge operativa v107** (`5f57d25d…`), prima v105 (`eb25599b…`). takomenu-web, takomenu-public, read-edge e SQL **non toccati**.

## Numeri (QA, p50 su 5 giri per tipo, dal Mac verso takoitalia.com)
| Tratto | v105 (prima) | v106 | **v107** |
|---|---|---|---|
| Dashboard: clic «Conferma» → commit (POST /publish) — prezzo / nome / nuovo / eliminato / categoria / esaurito | 2,46 / 2,11 / 2,33 / 2,08 / 2,09 / 2,17 s | 1,54 / 1,51 / 1,66 / 1,71 / 1,56 / 2,10 s | **1,58 / 1,50 / 1,18 / 1,18 / 1,38 / 1,20 s** |
| Dashboard: clic «Pubblica» → commit (salva + riepilogo + pubblica, senza tempo umano) | 4,45–4,91 s | 3,54–4,14 s | **2,66–3,23 s** |
| Salvataggio (PUT) | 1,85–2,25 s | 1,46–1,82 s | **1,09–1,41 s** |
| WhatsApp deterministico webhook → commit — prezzo / esaurito / nascondi | 3,39 / 2,76 / 2,71 s | 2,14 / 2,12 / 2,02 s | **1,72 / 1,75 / 2,09 s** |
| WhatsApp via IA (in locale, 2 giri, 2.311 token): Groq / turno dopo Groq | — | — | 0,70–0,74 s / sull'edge come il turno deterministico (~0,8 s); stimato ~2,5–3 s webhook → commit |

Dentro l'edge (Server-Timing): pubblicazione `app` 550 → 360 ms; costo fisso della piattaforma per richiesta 1,7–1,9 s → 1,0–1,3 s.

## Cosa è cambiato
1. **Pubblicazione a delta in una sola istruzione SQL** (`menu-workspace-store.ts`): 14–19 istruzioni → 6, scrive solo le righe cambiate. Stesso risultato del percorso vecchio **verificato per hash** su 16 scenari (anche menu da 345 piatti / 601 traduzioni), ognuno in una transazione annullata sul QA: tabelle del menu, workspace, `published_revision`, storico, blocco PROVA, conflitto. Traduzioni copiate dal documento come prima, nessuna ritraduzione.
2. **sharp fuori dal pacchetto Edge** (stub: sull'Edge non si carica comunque) e **magick-wasm come file a parte** (JS fissato per sha256; i due wasm da 31 MB non più nel pacchetto, il wasm si scarica da jsDelivr con verifica come prima). Pacchetto 133 → 69 MB: ~0,6 s in meno su **ogni** richiesta all'edge operativa. Upload immagine provato sul QA dopo il deploy (201, ricodificata), poi cancellata.
3. PUT/publish senza lettura preventiva del workspace; bot: impostazioni del locale lette una volta per turno. Il commit del bot avviene già prima della risposta Twilio; via IA nessuna chiamata IA dopo il commit.

Deploy: bundle = online + solo il delta, diff per sezione (v106: `menu-workspace-store`, `routes/menu-workspace`, `routes/twilio-menu`, stub sharp, altri moduli solo nomi rinominati da esbuild; v107 = v106 + sola sezione `image-entry` + file `magick-wasm-0.0.44.js`). check-active passato prima di ogni deploy. Funzioni sonda della diagnosi cancellate.

Verifiche: QA ripristinato per hash dopo ogni giro. Batterie avversarie (4) e suite completa: fallimenti **identici alla base c5693fa**; con l'orologio dei test a mezzogiorno 0 GRAVI, 0 MEDI (alle 3 di notte la base stessa dà 15 GRAVI sulle date «solo oggi/stasera»). tsc server verde.

## Rollback
- A v106: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v106-latenza-a.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`
- A v105 (com'era stamattina): `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v105-owner-activatedat.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`
- Copia di v107: `~/.config/tako-webapp/rollback-edge-20261017/`. Prima: `node ~/.config/tako-webapp/rollback-edge-20261016/check-active.mjs 107 5f57d25d94bf35c2e8dd5cbec45178ff1850f654fa1232e74a5e1a74a449dee6`.

## Obiettivo ≤ 0,8 s non raggiunto: causa misurata (exit dopo 2 giri)
Su Supabase quasi ogni richiesta trova un worker nuovo (anche una funzione vuota: 14 worker diversi su 15 richieste). L'edge operativa paga ancora per richiesta ~0,5–0,7 s di avvio (Fastify, ~136 rotte, 1,1 MB di codice) + `boot` 150 ms + autenticazione ~200 ms (sessione, locale, contatore rate limit; ogni query con parametri costa 2 giri col DB con `prepare:false`, senza pipeline). La read-edge, piccola e senza Fastify, risponde in ~0,45 s con la stessa sessione. Sotto 0,8 s serve una **funzione di scrittura snella** per PUT/publish (e webhook del bot) sul modello della read-edge: cambio di architettura (nuova funzione + instradamento nel Worker takomenu-web), da decidere.

## Cosa resta
1. Decisione sulla funzione di scrittura snella. In dashboard resta anche il riepilogo (`/publish/diff`, read-edge, ~0,5 s): il PUT potrebbe restituirlo (serve deploy staff).
2. **Merge del ramo prima di altri deploy dell'edge operativa**: un deploy da un ramo senza questo delta (o senza il nuovo `deploy-projection.mjs`, che copia `magick-wasm-0.0.44.js`) riporta i tempi di prima.
3. Bug preesistente: ricaricare nella galleria un'immagine identica a una cancellata risponde 503 «Salvataggio immagine temporaneamente non disponibile» (anche su v106; non toccato).
4. QA condiviso col perimetro B, che scriveva in parallelo: misure nelle finestre ferme, ripristino per hash.
5. Groq: ~7,7k token in tutto (3,1k da un comando di prova finito per sbaglio sull'IA, 4,6k per la misura via IA), sotto il tetto di 15k.
