# Fix bot WhatsApp Takomenu — 16/10

Edge `tako-operational-candidate` v72 → **v74** (v73 = ridistribuzione identica di v72 per diagnosticare un 500 del bundler Supabase).
Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v72-source.ts release/serverless/candidate/index.ts` + `node scripts/translations/deploy-projection.mjs`.

| Bug | Causa | Fix |
|---|---|---|
| B1 «mantieni» duplica | il modello estrae la clausola come riga da importare (menu della frase prima, categoria «Menu»); il merge la creava | intento letto dal testo (`onboarding-planner.ts:123`); righe «mantieni» mai create/cambiate (`onboarding-menu-merge.ts:23`) |
| B2 cambio prezzo = conflitto | «da 12 a 13» → due importi, riga scartata; «il prezzo corretto è 13» riconosciuto solo col verbo prima | «da X a Y» = cambio a Y (`onboarding-planner.ts:117`); aggiorna stesso ID; omonimi → «Pranzo o Cena?» |
| B3a richiesta multipla fallisce | Groq manda `"section":""`/`null`, schema rigido scartava tutto il messaggio (2/3 prove reali); non era la quota | normalizzazione vuoti + scarto righe malformate singole; causa in `tako_whatsapp_errors` (`onboarding-failure.ts`); retry automatico su 429 (×2) |
| B3b dubbi vecchi bloccano | dubbi legati ai messaggi vecchi per sempre; riepilogo passava dall'AI | dubbi superati si chiudono; riepilogo deterministico senza AI |
| B3c copy tecnico | «Fonte N»/VERIFICATO FONTE nella copy | domanda semplice; riga «Fatto: …» dopo ogni modifica |

## Verifiche
- `tests/onboarding-whatsapp-fix-1016.test.ts`: 17 test sulle frasi dei report (15/16 rossi sul pre-fix ricostruito). Suite onboarding/twilio/whatsapp 338/338, cloud 57/57, typecheck+build ok. Suite root: 5 fallimenti preesistenti identici sul pre-fix (menu-workspace, PDF, parity).
- E2E firmato su v74, Groq reale, QA +390000000099: 8/8 frasi mattina PASS (5 piatti, Burger 13 stesso ID, stile, riepilogo, 0 errori); set B2 12→13→14→15 PASS. Bozze QA annullate. Risultati: `e2e-result-*.json`.
- Victoria rev 25/25 hash invariato; 25 locali invariati.

## Aperto
- Retry su 429 e log errori parse verificati solo con mock.
- Omonimi in due menu + risposta «Cena» solo nei test.
- Avviso WhatsApp a Manuel sui fallimenti onboarding: registrato ma non inviato (da decidere).
- Dubbi PDF/sito su piatti mai toccati bloccano ancora l'approvazione, senza più comando VERIFICATO.
- Non coperti: audio, foto/PDF, telefono reale, anteprima live, 7 frasi notte in sequenza dal vivo. Nessun commit.

---

# Giro 2 — edge **v75** (rollback v74 in `~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v74-source.ts`)

Verifica avversaria su v74 (`verify/adversarial.test.ts`, 48 test, 13 rossi + E2E 13 frasi) → 7 bug corretti:

| Bug | Fix |
|---|---|
| 1 cambio perso in silenzio (prezzi in lettere, modello omette la riga) | guardrail copertura clausole: ogni clausola con prezzo applicata o chiesta («Non ho capito questa parte…»); «Nessuna modifica» se nulla cambia |
| 2 negazione blocca cambio nella stessa frase | intento per clausola (`onboarding-clauses.ts`), «tranne X» = cambio, intento «set» (metti/costa/va a) |
| 3 duplicati con sinonimi di «mantieni» | guardrail strutturale nel merge: piatto già in altro menu senza menu esplicito non si ricrea |
| 4 verbo nel nome («Alza la Pasta») | pulizia nomi (`onboarding-dish-name.ts`) |
| 5 dubbi spuri eterni | match fuzzy senza verbi, scadenza dopo 3 messaggi (solo dubbi chat) |
| 6 «metti X a N» chiedeva il menu | «metti» = set |
| 7 «aggiungi X da 8 a 9» → «non trovo» | chiede il prezzo |

Verifiche: avversari 48/48, suite 357/357, cloud 57/57, typecheck/build ok. E2E v75: mattina 8/8, verificatore 13/13; 429 Groq gestito dal vivo con retry. `menu-workspace-pdf.ts` modificato da un'altra sessione NON incluso nel bundle (modulo come v74).

Nota: Victoria rev 25→27, Tako·Verifica web, La Plaza, DA ORI salvati/pubblicati da dashboard (account «man…») tra 08:18 e 08:53 UTC — non dal bot.

---

# Giro 3 + fix nome — edge **v82** (stato finale 16/10 13:30)

Versioni: v72 → v74 → v75 → v77 → v81 → **v82** (v73 = ridistribuzione v72; v76 e v80 di altre sessioni: PDF/published-menu e campagna lead).
v82 = v80 della campagna lead + 3 sezioni onboarding (chat/clauses/menu-merge). Controllo base esplicito: `check-active.mjs`. Rollback in `~/.config/tako-webapp/rollback-edge-20261016/` (`candidate-index-v80-leads-campaign.ts`, `candidate-index-namefix-on-v77.ts`).

- Giro 3: guardrail conservativi (scrivono un valore solo se inequivocabile, altrimenti domanda); delta relativi; elimina applicato, sposta/rinomina spiegati; fonti chat compattate (niente blocco dopo 12 messaggi); «Cena» risponde alla domanda aperta; coperto/unità/decimali gestiti.
- Fix nome: nome/titolare/email già impostati cambiano solo se la frase ne parla («Metti il Risotto a 15» rinominava il locale, bug presente da v72).
- Test: 780/780 onboarding/WhatsApp, verify 48/48, verify2 55/55, cloud 57/57, invariante su ~214 frasi.
- E2E: mattina 8/8 su v77; verificatori 13 + 21 frasi su v77; nome e varianti su v81 (codice onboarding identico a v82). Su v82 quota Groq esaurita: regressione mattina DA RIFARE. Nessun dato sbagliato, nessun messaggio senza risposta.
- Controlli v82 in sola lettura: lead 401/404 come da loro prova; nota menu Osterietta presente.

Aperto: regressione su v82 al reset quota; Groq free è il limite reale; 7 test `twilio-owner-link` rossi per la sostituzione del numero fatta da un'altra sessione; avviso a Manuel sui fallimenti dell'onboarding non attivo; nessun commit (ramo `codex/claude-whatsapp-fix-1016` dopo le 14:30).
