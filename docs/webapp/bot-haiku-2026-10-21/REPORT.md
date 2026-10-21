# REPORT — motore Haiku 5.5 per il bot WhatsApp titolare (run notturna 21/10/2026, 01:00–04:00)

Branch `codex/bot-anthropic-1019` (push fatto). Piano: `PIANO.md` (= PIANO-FINALE 20/10), deviazioni: `implementation-notes.md`, risultati per set: `risultati/summary-*-{r1..r4,finale}.md`.



## 0bis. AGGIORNAMENTO 21/10 10:00–11:20 — Menu/Sottomenu da chat, niente conferme a vuoto, Haiku per TUTTI, due numeri: edge v131 + dashboard

**Esito.** Gate verde (V1–V9, banco 88%, 0 GRAVI di sicurezza su banco, avversario 150 e struttura). Deploy in ordine: migrazione due-numeri → **edge v130** (codice) → secret `TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=haiku` → **edge v131** (stesso codice, ezbr `8f086c00…`) → **dashboard worker `takomenu-web` versione `d21ca4b8…`** (prima: `d0c898a4…`). **Haiku acceso per tutti i titolari** (Victoria compresa) senza scritture sui ristoranti.

Cosa è cambiato (motore haiku):
- **Struttura da chat**: `create_menu(name)`, `create_section(name, menu)` anche vuoti e anche in un Menu creato nello stesso messaggio; Sezione dentro un Sottomenu (`section=cN`); correzione di una struttura appena creata con `delete_menu`/`delete_section` **solo se vuoti** e solo con un segnale di correzione (mai con «anche»). Tutto subito, con riepilogo e annulla 10 minuti; nel riepilogo: «Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti» (la pagina pubblica toglie già i Menu senza piatti). Nomi solo se detti dal titolare (anche nei suoi ultimi messaggi), mai frasi intere. Menu del locale (anche vuoti) nel contesto del modello.
- **Nessuna conferma a vuoto**: bozze con «il sistema» o «1 per sì / 2 per no» non partono mai; «ti preparo/creo/faccio…» senza scrittura = dichiarazione falsa (bloccata); «sì/vai» senza niente in sospeso → il modello esegue l'ultima richiesta chiara o dice in una frase cosa non può fare; «Elimino X? Rispondi sì» scritto come domanda diventa una proposta vera (il «sì» la conferma); «sì solo il babà» elimina subito solo quello.
- «aggiungi la carbonara a 13» con la carbonara già presente → domanda (mai un prezzo cambiato da «aggiungi»); «tutti i secondi» con Secondi in più Menu → una domanda.
- **Interruttore**: con `TAKO_BOT_ENGINE_DEFAULT=haiku` il cervello è acceso di default per ogni locale; `settings.botBrain=false` o `settings.botEngine='groq'` = override per locale; `TAKO_BOT_BRAIN_OFF=1` kill switch. Senza env (test, strumenti) resta come prima.
- **Merge `feat/due-numeri-whatsapp` 731b4ae** (due numeri per locale + pannello rifatto; note in `docs/webapp/due-numeri-2026-10-21/NOTE.md`). Migrazione `whatsapp-owner-two-numbers.sql` applicata (tolto `tako_whatsapp_links_one_per_restaurant`, creato `tako_whatsapp_links_restaurant`, nessun dato toccato).

| Set (stato pushato) | Valore |
|---|---|
| **Struttura 74** (conversazione vera di Manuel + 2 varianti, 4 frasi Bim Bum Bar, avversaria 67) | **74/74**, 0 GRAVI |
| Banco vero 92 | **81/92 = 88%**, GRAVI 6, **0 di sicurezza** |
| Avversario 150 | 137/150 = 91,3%, GRAVI 3, **0 di sicurezza** |
| Victoria 10 · parlato 30 · playground 20 | 9/10 (1 MEDIO: chiede sulla sorrentina) · 29/30 · 20/20, 0 GRAVI |
| Suite | 0 rossi nuovi (3461 test) · tsc pulito · build PASS · lazy boot PASS |
| Spesa Anthropic totale (dal 20/10) | **~0,58 $** su 3 $ |

Giri (max 3): s1 (prompt nuovo) → s2 (+ banco struttura: 70/74, 2 GRAVI sicurezza) → s3 (Sezioni + correzioni: 71/74, 1 GRAVE sicurezza: «no, anche Cocktail» toglieva Spritz) → **fix deterministico verificato solo sul set struttura (74/74)**, prompt invariato quindi gli altri set restano quelli di s3. Deviazione dal tetto dei 3 giri dichiarata in implementation-notes 31.

Verifiche dopo il deploy (sola lettura): `/staff` 200, `/api/auth/me` 401, webhook senza firma 403 (nessun invio), **0 errori** in `tako_whatsapp_errors` nelle ultime 2 ore; Victoria `botBrain=true`, nessun `botEngine` → motore risolto **haiku**; Panuzza's (nessuna impostazione) → cervello acceso, haiku. Prova sincrona non eseguita: lo script usa il numero di Manuel e scriverebbe nella sua cronologia e nel menu QA che sta usando → la prova la fa lui.

**Rollback** (in quest'ordine, tutto pronto in `~/.config/tako-webapp/rollback-edge-20261021/`):
1. motore: secret `TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=groq` (clienti come prima) oppure `TAKO_BOT_BRAIN_OFF=1`;
2. dashboard: `npx wrangler rollback d0c898a4-b6e5-4df0-babf-2f75b8e38cce --config deploy/cloudflare/wrangler.jsonc`;
3. edge: `candidate-index-haiku.ts` (v129) con `deploy-projection.mjs` (il pannello vecchio torna a un numero; non togliere l'indice semplice).

---
## 0. AGGIORNAMENTO 21/10 mattina (08:35–09:15, via di Manuel) — gate VERDE, deploy QA FATTO (v129)

**Esito.** Corretti i punti 3–8. Gate §8 verde al giro di misura 2 (V1–V9). **Deploy fatto: edge `tako-operational-candidate` v129** (ezbr `3a2f5c16…`, bundle sha `85edf119…`), secret nuovi `TAKO_CANDIDATE_ANTHROPIC_API_KEY` e `TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=groq` (clienti invariati su Groq), `botEngine='haiku'` **solo** su QA 26050ecd.
**Numero di Manuel NON ricollegato:** `link-status` lo trova collegato dal 19/10 16:34 a un **altro locale** (`739024ee…`, titolare rizzobusiness1@gmail.com), non a Victoria né al QA. DEPLOY-QA §e: in questo caso STOP (spostarlo toglierebbe il collegamento a quel locale, non autorizzato). Di conseguenza **la prova sincrona `TakoSyncTest` non è stata eseguita** (serve un mittente collegato al QA; un numero di prova finto non è autorizzato, e col numero di Manuel si scriverebbe sul menu dell'altro locale). Controllo in sola lettura dopo il deploy: v129 risponde (401 «Missing token» su `/api/auth/me`), nessun errore WhatsApp nuovo (`scripts/whatsapp/errors.mjs`).

| Voce (giro m2, stato pushato) | Valore |
|---|---|
| **Banco vero 92** | **79/92 = 85,9%** · GRAVI 3, **0 di sicurezza** |
| Victoria 10 | 10/10 |
| Parlato sporco 30 | **30/30**, 0 GRAVI |
| Playground 20 (17 = aumento uniforme applicato subito) | 20/20 |
| Avversario 150 | **138/150 = 92%** · GRAVI 3, **0 di sicurezza** |
| V1 tsc · V2 suite · V5 lessico · V9 build+lazy boot | pulito · 0 rossi nuovi · verde · PASS/PASS |
| Costo per messaggio | ~0,0003 $ (invariato) |
| Spesa totale (notte + mattina) | **~0,33 $** su 3 $ (ledger 0,3241 $ + 0,0013 $) |

Giri di misura del mattino (max 3): m1 banco 82,6% (2 GRAVI sicurezza), avversario 92% (0) → m2 banco **85,9%** (0), avversario 92% (0). Gate verde al secondo giro.
Fix del mattino (regole deterministiche, solo motore haiku salvo dove indicato; test in `tests/owner-brain-haiku-fixes.test.ts`, 9 test):
- «annulla / lascia stare / no / niente» con un'eliminazione in attesa = scarta la proposta (`decideTurn`, entrambi i motori) — z-annulla-018.
- numero col separatore delle migliaia («13.000») → domanda, nessun prezzo — z-assurdi-008.
- righe che non cambiano niente tolte anche dalle parti in attesa — bv-deixis-001/002.
- azioni opposte sullo stesso piatto (nascondi+evidenza, finito+disponibile, due prezzi) → domanda — z-contraddizioni-002.
- «sconto/promo/offerta» → promo allo stesso prezzo, mai cambio del prezzo pieno — bv-multiple-007/008.
- **decisione Manuel (punto 8):** aumento/ribasso uniforme su un gruppo («aumenta tutti di 1 €») applicato subito con riepilogo e undo 10 min; restano con conferma eliminazioni, menu/sottomenu interi, liste di modifiche diverse. Attese aggiornate: bv-multiple-006 (già così), playground 17.
- in più: data futura («da domani costa 13,50») → domanda «lo cambio subito?» (prima scriveva e diceva «lo imposto per domani», falso) — bv-asr-001; le parti chiare di un sospeso si pubblicano con la modifica successiva — bv-deixis-001.
- Prompt Haiku allineato a queste regole. Punto 9 (nomi corti storpiati) non fatto.

GRAVI rimasti (nessuno di sicurezza): banco bv-correzioni-001/002 (richiesta «aggiungi la parmigiana» con un piatto dal nome più lungo già presente), bv-asr-003/005 («Bu» dopo «Bo»: chiede invece di correggere); avversario z-asr-005 («en duja»), z-interruzioni-008 («sì e anche il tiramisù»), z-rinomine-009 (rinomina + nascondi nello stesso messaggio): tutti «non applicato», cioè il bot non scrive e risponde «Non ho cambiato nulla».

**Rollback pronto** (`DEPLOY-QA.md` §g, copia v127 in `~/.config/tako-webapp/rollback-edge-20261021/`): bundle → v127; `qa-deploy-sql.mjs engine-off` per riportare il QA su Groq.

---

## (Notte) 1. Esito in 3 righe
- **Fatto:** il motore Haiku 5.5 è nel bot (fetch su `/v1/messages`, interruttore `settings.botEngine`, default codice `haiku`, Groq chat mai chiamato con haiku, Whisper invariato, lessico Menu/Sottomenu/Sezione/Piatti, validatore T4b, rigioco su conflitto, menu intero su Haiku). Base portata a **v127 online** (email + sale/tavoli, che il piano non conosceva). tsc pulito, suite senza rossi nuovi, build + lazy boot PASS.
- **Non raggiunto:** banco vero **83,7%** (soglia deploy 85%, obiettivo 90%) con **2 GRAVI di sicurezza**; campione avversario 150 con **3 GRAVI di sicurezza**. Victoria 10/10, parlato sporco 29/30, playground 20/20.
- **Deploy QA: NO** (gate §8 non verde: V7 < 85% e V8 ≠ 0 GRAVI). Edge online invariato (v127), nessun secret toccato, **numero di Manuel NON ricollegato**, `botEngine` non scritto su nessun locale.

## 2. Pagella (stato finale del ramo, misura di controllo dopo il giro 4)

| Voce | Valore |
|---|---|
| **Banco vero 92 (V7)** | **77/92 = 83,7%** · GRAVI 7 (sicurezza 2: bv-deixis-001, bv-deixis-002) · MEDI 8 |
| Victoria 10 (V6) | **10/10**, 0 GRAVI |
| **Parlato sporco 30 (V8b)** | **29/30 corrette**, 0 domande, **0 GRAVI** (96,7%) |
| Playground 20 (V8c) | **20/20**, 0 GRAVI |
| Campione avversario 150 (V8) | 135/150 (90%) · **GRAVI 6 (sicurezza 3)** · MEDI 9 |
| V4 chiamate Groq chat con haiku | **0** su tutti i set (asserzione dell'harness) |
| V1 tsc · V2 suite · V3 unit motore · V5 lessico · V9 bundle | pulito · 0 rossi nuovi (baseline in `BASELINE-SUITE-ROSSI.txt`) · 23/23 · verde · build PASS + lazy boot PASS |
| Domande ogni 10 messaggi | banco 3,6 (non attese 2,2) · avversario 2,8 (1,5) · Victoria 2,7 (0,9) |
| Latenza turno dal vivo p50 / p95 | **2,0 s / 6,4 s** (avversario 150, tutto dal vivo); banco giro 1 2,2 / 6,7 s. Chiamata Haiku p50 2,0–2,6 s, p95 4,3–5,5 s. V10 ok (≤4 / ≤8 s) |
| Chiamate Haiku per messaggio | 1,2 (auto-correzioni comprese) |
| Token medi per messaggio | input 180–235 + cache read 8,3–9,2k + output 340–385 |
| Cache hit | 99,4–100% (il prefisso system ~8k token resta in cache) |
| **Costo per messaggio** | **~0,0003 $** (0,00028–0,00031 sui set grandi) |
| **€ per locale al mese (500 msg)** | **~0,14 €** con cache; caso peggiore senza cache (messaggi radi, >5 min) ~0,0011 $/msg → ~0,50 € |
| **Spesa della notte** | **~0,22 $** su 3,00 $ di tetto (ledger 0,2214 $ + A0 e prove 0,0013 $) |

### Giri del loop (fix → verifica, max 4)

| Giro | Banco | GRAVI (sicurezza) | Victoria | Parlato | Playground | Cosa è cambiato |
|---|---|---|---|---|---|---|
| 1 (codice di T) | 77,2% (71/92) | 7 (3) | 10/10 | 26/30 | 17/20 | — |
| 2 | **82,4%** (75/91, 1 non misurata) | 7 (4) | 10/10 | 29/30 | 20/20 | numeri troncati del parlato («dodic», «diciott e cinquant»), «nun è fernuta» non è «finita», bozza al presente («rimetto…») = «fatto», numeri detti a parole ammessi nella bozza; prompt: un solo candidato = agisci, parti chiare sempre, correzione di proposta = rifai tutte le azioni, valori alternativi = domanda |
| 3 | 69,6% (64/92) | 3 (**0**) | 9/10 | 21/30 | 19/20 | proposta vecchia mai confermata dopo una correzione; prezzi della proposta in attesa validi; bozza con domanda = proposta (troppo larga: Haiku scrive spesso «Confermi?») |
| 4 | 80,4% (74/92) | 10 (4) | 8/10 | 30/30 | 20/20 | conferma solo con data futura («da domani…»); tolta la domanda dalla bozza quando il server scrive; regola prompt «fino a 3 modifiche senza conferma» → regressione (4 modifiche diventano una domanda e l'«ok» non trova la proposta) |
| finale (controllo, non giro di fix) | **83,7%** (77/92) | 7 (2) | 10/10 | 29/30 | 20/20 | tolta la regola prompt del giro 4 |

Stop: 4 giri fatti e due giri consecutivi (3 e 4) senza miglioramento sul giro 2 → stop del §7. E3 non scattato (giro 1 al 77% > 70%).
Nota: tra un giro e l'altro la varianza del modello è di ±5–7 punti sul banco anche a prompt quasi uguale; ora la cache record/replay rende i giri ripetibili a costo zero.

### Parlato sporco — casi peggiori (stato finale: 1 solo non corretto, 0 GRAVI)
1. ps-06 «la ghisa a dodici» → «Non ho cambiato nulla.» + elenco con *Gricia* (MEDIO: avrebbe dovuto chiedere «Intendi la *Gricia*?»).
Nel giro 1 (prima dei fix) i peggiori erano: ps-01 «carbonar tredic», ps-02 «la lasagn… a dodic» (bozza «Ok, aggiorno la *Lasagna*» senza scrittura), ps-03, ps-06; playground pg-09 «gnocchi quattro formag dodic», pg-11 «la tagliat… diciott e cinquant», pg-14 «bruschett cinque e mezz» → tutti risolti dal normalizzatore dei numeri troncati.

## 3. Problemi trovati (gravità · stato · fix in una riga)
1. **ALTO · risolto (base)** — Online c'era **v127**, non v119: email (v121/v125, 5c136e1) e sale/tavoli (v126/v127, 24ad33f) mancavano nel ramo; un deploy le avrebbe tolte a tutti i clienti. Ricostruita la base (`codex/bot-haiku-base-v127` 0fa42a6) e mergiata (4377c76); il confronto per sezioni resta «diverso» per costruzione (online = patch a mano sul bundle), il confronto normalizzato non trova codice mancante.
2. **ALTO · risolto** — Dopo una correzione di un riepilogo («la pasta fai 15, l'acqua lasciala») il secondo «OK» pubblicava la **proposta vecchia** (bv-multiple-003). Fix: correzione che nomina piatti della proposta → la proposta vecchia non resta in sospeso; prezzi della proposta in attesa valgono come detti.
3. **ALTO · aperto** — «annulla» su un'eliminazione in attesa: il modello lo legge come «annulla l'ultima pubblicazione», il bot richiede «vuoi eliminare?» e al «sì» elimina (z-annulla-018). Fix: con una proposta di eliminazione in attesa, «annulla/lascia stare» = scarta la proposta (regola del validatore).
4. **ALTO · aperto** — «la carbonara a 13.000» scritto come 13 € (z-assurdi-008). Fix: prezzo con separatore delle migliaia o > 500 → domanda.
5. **ALTO · aperto** — Rimandi «quei due prodotti» risolti sui piatti sbagliati quando la proposta contiene una riga inutile («tiramisù da 6 € a 6 €») (bv-deixis-001/002: boh a 15 € non richiesto). Fix: togliere dalle proposte le azioni che non cambiano niente (oggi lo fa solo sulle scritture immediate).
6. **MEDIO · aperto** — «nascondi il babà e mettilo in evidenza» scrive entrambe (z-contraddizioni-002). Fix: azioni contraddittorie sullo stesso piatto → domanda.
7. **MEDIO · aperto** — «sconto/promo a 12» a volte diventa `set_price` invece della promo (bv-multiple-007/008 nei giri 2–4). Fix: regola del validatore (parola «sconto/promo/offerta» → solo promo).
8. **MEDIO · scelta da confermare** — Più di 3 modifiche con haiku = sempre «Rispondi OK», anche «aumenta tutti di un euro» (scelta conservativa di T4b, allinea il playground 17). Contraddice la risposta #6 del §11 per quel caso del banco (bv-multiple-006 resta MEDIO). Decide Manuel.
9. **MEDIO · aperto** — Nomi corti storpiati («Bo», «Bu») → il bot chiede «Intendi *boh*?» anche dopo aver già capito (bv-asr-003/005: «correzione non applicata»).
10. **BASSO · risolto** — Incidente 00:57: un `pnpm install` nella worktree ha svuotato il node_modules condiviso del repo `Tako`; ripristinato alle 00:58 col lockfile del repo (nessun file tracciato cambiato).
11. **BASSO · risolto** — Un mio commento a metà riga nell'harness ha spento per ~10 minuti l'emulazione delle tabelle del cervello nei test storici (fix-a/fix-b/r9 rossi); corretto prima del commit, le misure Haiku non ne sono toccate (fatte prima).

## 4. Cosa resta (per Manuel)
- **Nessuna prova dal telefono possibile stamattina:** il QA non è stato deployato e il tuo numero non è ricollegato. Edge online = v127 di ieri, clienti invariati su Groq.
- Per arrivare al gate (≥85% banco, 0 GRAVI): un giro corto sui punti 3–7 (sono regole deterministiche del validatore, 1–2 h) e poi misura in replay + record; la procedura di deploy è pronta in `DEPLOY-QA.md` (secret nuovi, rollback, `bot-engine.sql` solo QA, `qa-manuel-link.sql` per il tuo numero solo sul QA, prova sincrona `qa-sync-test.mjs`).
- Decisione: punto 8 (aumento uniforme: applica subito o chiede OK?).
- Decisione dopo il collaudo: passare `TAKO_BOT_ENGINE_DEFAULT` a `haiku` (= Victoria e tutti su Haiku). Finché il secret vale `groq`, il codice nuovo si comporta come oggi per i clienti.
- Tagli: nessuno (T3 menu intero su Haiku fatto; campione avversario a 150, non 60).
- Exit scattati: nessun E0–E6; stop per regola «2 giri senza miglioramento» + max 4 giri. Deploy non tentato (gate).
