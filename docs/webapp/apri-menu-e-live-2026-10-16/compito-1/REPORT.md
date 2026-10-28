# Compito 1 — «Apri menu» apre il menu vero · REPORT (16/10/2026)

## Cosa è cambiato
- Dashboard agenzia → card del locale → **Apri menu** ora apre, nella stessa scheda, la **pagina pubblica vera** (`https://takoitalia.com/<slug>`, es. `/l-osterietta-1`; `/r/<id>/menu` per i locali senza slug pubblico). Non cambia più il locale attivo e non apre l'editor nel riquadro.
- Sulla pagina del menu, **solo per chi arriva dalla dashboard agenzia con sessione valida**, compare in basso a sinistra un pulsante bianco discreto **«‹ Torna all'editor»**. Riporta a `/staff/` nella vista Locali (o «Da fare») con la stessa ricerca, lo stesso filtro, lo stesso punto di scorrimento e il focus sulla card da cui si era partiti.
- Il pulsante appare solo se il server conferma l'account agenzia (`/api/agency/me` con il cookie staff HttpOnly). Il segnale locale (sessionStorage della scheda) serve solo a non fare richieste per i clienti: nessun parametro URL conta.
- Per l'editor di un locale: selettore «Locale attivo» nella sidebar (come prima).

## Cosa vede Manuel
Clic su «Apri menu» → si apre il menu come lo vede il cliente; in basso a sinistra «Torna all'editor»; clic → torna alla lista Locali dove era. Clienti e ristoratori vedono il menu identico a prima.

## Verifier (`verify-compito-1.mjs`, headless, desktop 1280×900 e mobile 500×900)
Live dopo il deploy: **28/28 PASS** (`evidence/live-result.json`, screenshot in `evidence/`). Stesso esito 28/28 sui bundle locali prima del deploy (`--local`).
1. **Admin**: Apri menu → `/l-osterietta-1` giusto; pulsante visibile (1 sola chiamata `/api/agency/me` = 200); non copre header, lingue, striscia menu, né in cima, né a metà pagina, né il piè di pagina; nessun errore in console; clic → `/staff/`, ricerca «L'Os» e scroll 595 px ripristinati, focus sulla card.
2. **Anonimo** sullo stesso URL, anche con `?staff=1&from=staff&editor=1&agency=1&return=/staff/`: nessun pulsante, **zero richieste** a `/api/agency/me`, modulo non scaricato, nessun errore. Con indizio falsificato a mano nel browser: il server risponde 401 → nessun pulsante.
3. **Ristoratore** (owner del locale QA): nessun pulsante, sia senza indizio (zero richieste) sia con indizio (server: `agency:false`).
Sessioni proprie create con `scripts/translations/common.mjs`, logout a fine run; nessuna scrittura su locali (Apri menu non scrive più nulla).

## Test e controlli
- `node --test tests/staff/agency-menu-switch.test.mjs`: 3/3 (aggiornato al nuovo comportamento).
- `node --test tests/staff/*.test.mjs tests/web/*.test.mjs`: 181/201; i 20 rossi sono su file non toccati (renderer, PDF/workspace, navigazione 03-shell-nav, live-sync): nessuno riguarda i file del Compito 1 (non verificato se fossero rossi già prima).
- `tsc --noEmit` di `apps/web-static`: verde.

## Diff del bundle rispetto all'online (richiesto prima del deploy)
- Prima delle modifiche: build dal working tree = online, hash identici (`index-CkLiOQ3Y.js`, `DigitalMenu-ppU56phB.js`, staff `app.054cab741e01.js`). Dopo quella build sono cambiati solo i 4 file del Compito 1 (controllo mtime subito prima del deploy).
- Menu pubblico: build non minificata baseline vs nuova → unica differenza di codice in `index` (modulo `staff-return-hint` + 8 righe di avvio) e nuovo chunk `staff-return-*.js`; gli altri chunk differiscono solo nella riga `import {…} from "./index-…"` (lettere degli alias). CSS identico.
- Staff: unica sorgente cambiata `src/20-agency-dashboard.js` (open, ripristino, ref).

## Versioni deployate e rollback
| Worker | Prima | Ora |
|---|---|---|
| takomenu-public | 97ed683e-5942-43ff-8390-eab7420c80d5 | **c026f2e0-12e2-4821-abf9-971d8c20a237** |
| takomenu-web | d55502c9-7229-4ce8-b9ad-bd34bdcaf0a3 | **540cf111-9c03-4e14-b1c0-bb839c07a87f** |

Rollback (dal repo): `wrangler rollback 97ed683e-5942-43ff-8390-eab7420c80d5 --config deploy/cloudflare/wrangler-public.jsonc` e `wrangler rollback d55502c9-7229-4ce8-b9ad-bd34bdcaf0a3 --config deploy/cloudflare/wrangler.jsonc`. Note e bundle precedenti in `~/.config/tako-webapp/rollback-compito1-20261016/`. Nessuna edge e nessun dato toccati.

## File toccati
- `apps/dashboard/public/staff/src/20-agency-dashboard.js`
- `apps/web-static/src/main.tsx` (2 righe), nuovi `apps/web-static/src/staff-return-hint.ts`, `apps/web-static/src/staff-return.ts`
- `tests/staff/agency-menu-switch.test.mjs`
- questa cartella (UNKNOWNS, implementation-notes, verifier, evidence)

## Cosa resta aperto
- Safari/iPhone reale non verificato (solo Chrome headless).
- Se Manuel vuole anche un accesso diretto «Modifica» sulla card agenzia (oggi l'editor passa dal selettore «Locale attivo»): da decidere, non aggiunto.
- Aprendo il menu in una nuova scheda (cmd-clic) il pulsante non compare: scelta voluta (l'indizio vale solo nella scheda).
- Nessun commit (vietato): i file sono nel working tree.
