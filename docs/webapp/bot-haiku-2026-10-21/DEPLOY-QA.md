# DEPLOY-QA — motore Haiku sul locale QA (PIANO §8), procedura copiabile

Scritta dal sottoagente E il 21/10/2026 ~01:20, **nulla di questo file è stato eseguito** (solo letture GET e prove locali).
Progetto Supabase `tcfccmvpycivxuxkoqpw`, funzione `tako-operational-candidate`. QA = `26050ecd-2e55-4057-a4c5-bff2b449cd47`.
**MAI** Victoria `528e263c-634e-4695-9632-6c5cc6a3302f` né altri clienti. Chiavi e token: mai a schermo (solo lettura da file).
Tutti i comandi partono da `cd /Users/manuel/Projects/Tako/Tako-bot-anthropic` (il symlink `.env.web` c'è già: serve a `deploy-projection.mjs`).

```bash
cd /Users/manuel/Projects/Tako/Tako-bot-anthropic
RB=~/.config/tako-webapp/rollback-edge-20261021; mkdir -p -m 700 $RB
```

---

## 0. GATE BLOCCANTE — l'edge online NON è v119 (verificato 01:10)

Online c'è **v127** (`ezbr 49b3a73929f3b1dd5ad44e01bbd896f384ee77a6c55ef0c19ca35b3d8c4f97f5`, 20/10 17:37), non v119.
Dopo v119 sono stati deployati: v121 email activation, v125 email automation (`codex/manuel-email-activation` 5c136e1),
v126 prenotazioni, v127 sale/tavoli (sorgente = `~/.config/tako-webapp/room-fix-20261020/room-index.ts`, sha `1f126285…`,
poi committato come `codex/dashboard-header-logo` 24ad33f alle 17:55). **Nessuno dei due è in `codex/bot-anthropic-1019`.**

Un deploy dal ramo così com'è **toglierebbe dall'edge** (misurato con `bundle-sections-diff.mjs` sul build di stanotte):
- email: l'entry online legge `WEB_EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_LOGO_URL`, `EMAIL_OUTBOX_KEY`
  (i secret `TAKO_CANDIDATE_EMAIL_*`/`RESEND_API_KEY`/`WEB_EMAIL_ENABLED` esistono online); `web-accounts.ts` con modelli email;
- prenotazioni sale/tavoli (`customer.ts` «Tavolo non disponibile», `tables.ts`, `stats.ts`), `PATCH` in `web-runtime.ts`.

Prova di merge (worktree temporanea, poi rimossa): `5c136e1` conflitto in `apps/server/src/routes/web-accounts.ts` (da risolvere a mano,
la versione email cambia lock e modelli); `24ad33f` conflitti solo in `apps/dashboard/public/staff/src/03-shell-nav.js` e `docs/TEAM_CONTEXT.md`
(fuori bundle edge). Anche col merge restano sezioni diverse da v127 da rivedere una per una (durable-rate-counter, remote-image-store,
site-brand, onboarding-ocr, dish-image-ai, edge-pdf-runtime-assets, web-mail, agency-leads, stats, customer).

**Regola:** si fa il deploy solo se, dopo il merge e il build (passo c1), questo comando non mostra sezioni non-bot cambiate senza spiegazione:
```bash
node scripts/serverless/bundle-sections-diff.mjs ~/.config/tako-webapp/room-fix-20261020/room-index.ts
# atteso: onlyOnline=[]; onlyLocal ⊇ owner-brain-anthropic.ts; changedApp ⊆ moduli bot (owner-brain-*, twilio-menu*, onboarding-planner,
#         menu-full-extract, routes/twilio-menu.ts) + scripts/serverless/fetch-bridge.mjs (= entry con i 2 env nuovi)
```
Se non è così → **niente deploy stanotte** (exit E6 preventivo): REPORT con questo paragrafo, decide Manuel.

---

## a. Secret nuovi (solo i due nomi nuovi; gli esistenti non si toccano)

```bash
node scripts/serverless/secret-names.mjs > $RB/secret-names-before.txt     # nome + impronta, mai valori
grep -c . $RB/secret-names-before.txt                                       # 37 alle 01:20
set -a; . ~/.config/tako-webapp/supabase-management.env; set +a             # esporta SUPABASE_ACCESS_TOKEN senza stamparlo
F=$(mktemp $RB/secrets.XXXXXX); chmod 600 "$F"
{ printf 'TAKO_CANDIDATE_ANTHROPIC_API_KEY=%s\n' "$(tr -d ' \r\n' < ~/.config/tako-webapp/anthropic-key.txt)"
  printf 'TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT=groq\n'; } > "$F"           # printf è builtin: la chiave non finisce negli argomenti
pnpm dlx supabase secrets set --env-file "$F" --project-ref tcfccmvpycivxuxkoqpw >/dev/null 2>&1; echo "secrets exit=$?"
rm -P "$F"
```
Verifica:
```bash
node scripts/serverless/secret-names.mjs > $RB/secret-names-after.txt
diff $RB/secret-names-before.txt $RB/secret-names-after.txt
# atteso: SOLO due righe «>» TAKO_CANDIDATE_ANTHROPIC_API_KEY e TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT; nessuna «<».
```
Note: i secret si leggono solo all'avvio della funzione → hanno effetto con il deploy del passo c (il bundle v127 online ignora i due nomi).
Default server `groq` = Victoria e tutti gli altri restano su Groq; solo il QA passa a Haiku col passo d.

## b. Copia di rollback del bundle online

```bash
node scripts/serverless/check-active.mjs 127 49b3a73929f3b1dd5ad44e01bbd896f384ee77a6c55ef0c19ca35b3d8c4f97f5   # deve dire ok:true
cp ~/.config/tako-webapp/room-fix-20261020/room-index.ts $RB/candidate-index-v127.ts
cp ~/.config/tako-webapp/room-fix-20261020/magick-wasm-0.0.44.js $RB/magick-wasm-0.0.44.js
shasum -a 256 $RB/candidate-index-v127.ts        # atteso 1f126285a2399a79c95d94821f2067add8eb0efda3edd0457ad2c80100e9f7c7
```
Se check-active non passa (qualcuno ha deployato dopo le 01:10) → fermarsi: la copia non corrisponde più all'online.

## c. Build → deploy → check-active

```bash
taskpolicy -b node scripts/serverless/build-operational-candidate.mjs          # {"build":"PASS",...,"deployed":false}
taskpolicy -b node scripts/serverless/verify-candidate-lazy-boot.mjs | head -c 200   # "passed":true
grep -c "'ANTHROPIC_API_KEY', *'TAKO_BOT_ENGINE_DEFAULT'\|\"ANTHROPIC_API_KEY\", \"TAKO_BOT_ENGINE_DEFAULT\"" release/serverless/candidate/index.ts   # ≥1
node scripts/serverless/bundle-sections-diff.mjs ~/.config/tako-webapp/room-fix-20261020/room-index.ts   # GATE 0
node scripts/serverless/check-active.mjs --local > $RB/pre-deploy.json; cat $RB/pre-deploy.json   # version 127 + sha locale
cp release/serverless/candidate/index.ts $RB/candidate-index-v128-haiku.ts
node scripts/translations/deploy-projection.mjs                                # {"projectionDeploy":"PASS"}; log in ~/.config/tako-webapp/translation-projection-deploy.log
node scripts/serverless/wait-edge-ready.mjs                                    # {"ready":true,...}: aspetta che la versione nuova risponda (v140: ~70 s dopo il deploy). Prima di questo NIENTE prove dal vivo.
node scripts/serverless/check-active.mjs --local                               # annota version (atteso 128) ed ezbr nuovi
node scripts/serverless/check-active.mjs 128 <ezbr-appena-letto>               # ok:true
```
Se `projectionDeploy` ≠ PASS o la versione non sale → rollback (g1) subito, niente secondo tentativo (E6).

## d. `botEngine='haiku'` solo sul QA

Metodo: Management API `POST /database/query` (stesso dei live R, `docs/webapp/bot-cervello-2026-10-17/live-N/q.mjs`), via runner:
```bash
node scripts/serverless/qa-deploy-sql.mjs engine-on --dry-run     # rivedi l'SQL (sezione [1] di bot-engine.sql)
node scripts/serverless/qa-deploy-sql.mjs engine-on               # RAISE (e nessuna modifica) se ≠ 1 riga o botEngine su altri locali
node scripts/serverless/qa-deploy-sql.mjs engine-status
# atteso: una sola riga, id 26050ecd…, bot_engine "haiku", bot_brain "true"
```

## e. Numero di Manuel → SOLO QA (autorizzato: RISPOSTE-MANUEL.md punto 5)

Il numero (`whatsapp:+39…0927`) si legge da `~/.config/tako-webapp/owner-service-qa-backup.json` (`link.phone`): non sta nel repo e
non viene stampato. Era su Victoria dal 14/10 (actor agenzia `adf1b8e2…`), scollegato il 19/10 quando su Victoria è entrato Gio.
Il collegamento usa il titolare attivo del QA come `actor_id` (come il mittente di prova in `live-R10/verify-live-r10b.mjs`).
`tako_whatsapp_links` ha un indice unico per locale: l'eventuale numero già collegato al QA (es. fittizio di prova) viene salvato
in `$RB/qa-links-before.json` e tolto; il rollback lo rimette.
```bash
node scripts/serverless/qa-deploy-sql.mjs link-status    # sola lettura: righe del numero e del QA (mascherate)
#   se il numero risulta su un altro locale → STOP (la sezione [2] comunque alza RAISE senza modificare nulla)
node scripts/serverless/qa-deploy-sql.mjs link --dry-run
node scripts/serverless/qa-deploy-sql.mjs link
# atteso link-check: on_qa=1, on_victoria=0, total=1, victoria_links=1 (il numero di Gio, invariato)
```
Nota: PIANO §8 «Mai: modifiche a `tako_whatsapp_links`» è superato, solo per questa riga sul QA, da RISPOSTE-MANUEL punto 5.
Da qui gli avvisi del bot (`reportFailure`) arrivano anche al telefono di Manuel se il numero d'avviso coincide: è voluto.

## f. Prova sincrona `TakoSyncTest` sul QA (12 richieste = i 10 casi del §8.4)

Webhook firmato con `TakoSyncTest=1`: sul QA tutte le risposte (anche del cervello) tornano solo nel TwiML, nessun invio REST,
nessun avviso. Mittente = numero di Manuel (deve essere già collegato, passo e). Piatti presi dal menu del QA (sola lettura).
```bash
node scripts/serverless/qa-sync-test.mjs --dry-run        # elenco messaggi + atteso
node scripts/serverless/qa-sync-test.mjs --gap-ms=3000     # ~1 min; costo stimato < 0,03 $ (12 turni Haiku)
```
Messaggi: prezzo (A+1 €), «B è finito», «aggiungi Piatto test QA a 9 euro», «quanto costa A?», «elimina Piatto test QA» + «sì», «annulla»,
4 prezzi in un messaggio + «ok», «cosa c'è nella categoria <sottomenu>?», vocale simulato da testo, «Ciao, cosa sai fare?».
Risultato in `$RB/sync-test-*.json` (p50/p95, flag automatici: vuota, «non disponibile», «categori», emoji, HTTP).
Il giudizio GRAVE (scrittura sbagliata, «fatto» senza scrittura, elimina senza sì, prezzo non detto) è del coordinatore riga per riga.
Il menu del QA viene modificato (è il locale di prova): `qaBefore/qaAfter` nel risultato. I prezzi tornano quasi tutti al valore
iniziale col passo 4-prezzi; per un ripristino per hash usare la logica `restoreMenu` di `live-R10/verify-live-r10b.mjs`.
Controllo extra (sola lettura) che nessun messaggio REST sia partito: `node scripts/whatsapp/errors.mjs` per gli errori; Twilio console.

Se una riga è GRAVE → rollback (g), REPORT.

## g. Rollback completo (in quest'ordine)

```bash
# g1 — bundle: torna al codice di v127 (diventa una versione nuova, es. 129)
node scripts/serverless/check-active.mjs 128 <ezbr-del-passo-c>       # deve passare: stai togliendo proprio il tuo deploy
cp $RB/candidate-index-v127.ts release/serverless/candidate/index.ts
cp $RB/magick-wasm-0.0.44.js release/serverless/candidate/magick-wasm-0.0.44.js
node scripts/translations/deploy-projection.mjs                        # PASS
node scripts/serverless/check-active.mjs --local --compare-file=$RB/candidate-index-v127.ts   # compare.result "uguale", version salita
# g2 — interruttore
node scripts/serverless/qa-deploy-sql.mjs engine-off                   # with_bot_engine = 0
# g3 — numero di Manuel: via dal QA, rimessi i collegamenti QA salvati
node scripts/serverless/qa-deploy-sql.mjs link-rollback                # on_qa=0, on_victoria=0, victoria_links=1
# g4 — secret: non serve toglierli (il codice v127 non li legge). Se richiesto:
#   set -a; . ~/.config/tako-webapp/supabase-management.env; set +a
#   pnpm dlx supabase secrets unset TAKO_CANDIDATE_ANTHROPIC_API_KEY TAKO_CANDIDATE_TAKO_BOT_ENGINE_DEFAULT --project-ref tcfccmvpycivxuxkoqpw
```
Rollback del solo motore (bundle nuovo resta): basta g2 → il QA torna al default del server (`groq`).

---

## File usati (tutti in `scripts/serverless/`)
| File | Cosa fa | Scrive? |
|---|---|---|
| `check-active.mjs` | versione+ezbr della funzione online (GET); `--local` sha del bundle locale; `--compare-file` | no |
| `secret-names.mjs` | inventario nomi secret + impronta (GET) | no |
| `bundle-sections-diff.mjs` | moduli che cambiano/spariscono rispetto al bundle online salvato | no (locale) |
| `bot-engine.sql` | [1] accensione con guardia 1 riga, [2] verifica, [3] rollback | sì (QA) |
| `qa-manuel-link.sql` | [1] stato, [2] collega (guardie), [3] verifica, [4] rollback | sì (QA) |
| `qa-deploy-sql.mjs` | esegue le sezioni via Management API, backup collegamenti QA, `--dry-run` | sì (QA) |
| `qa-sync-test.mjs` | prova sincrona TakoSyncTest, risultati in `$RB` | sì (menu QA) |

Prove locali fatte (01:10–01:20): SQL di `bot-engine.sql` e `qa-manuel-link.sql` eseguito su un Postgres usa e getta con schema
ridotto (accensione, idempotenza, RAISE se botEngine su altro locale, collegamento, idempotenza, rollback, RAISE se il numero è su un
altro locale) → tutto come atteso. `check-active.mjs` e `secret-names.mjs` provati in sola lettura (v127, 37 secret).
