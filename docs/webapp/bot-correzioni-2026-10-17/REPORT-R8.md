# REPORT R8 — bug dal vivo «Non ho cambiato nulla» / «Aggiunti…» senza scrittura (agente R5, 18/10/2026)

**Esito: corretto e online su v114** (ezbr `b13522643a9dde217f3174a698699d3fbdb7eb37743da7597dfe67db33f961c0`). Cervello sempre e solo sul QA. Dettagli e deviazioni: implementation-notes.md note 78–85.

## Diagnosi dei 3 messaggi (QA 26050ecd, 18/10 10:55–10:58 UTC)
Fonti: `tako_owner_brain_turns`, `tako_whatsapp_messages`, `tako_whatsapp_proposals`, `menu_workspace_versions` (sola lettura). Il piano JSON non è salvato nel DB: riprodotto col route vero, menu QA vero e cronologia vera, gpt-oss-120b (chiavi di test).

| ora | messaggio | piano del modello | validatore / route | risposta |
|---|---|---|---|---|
| 12:55 | sposta la parmigiana sotto al tiramisu | domanda | domanda con candidati | riepilogo «la parmigiana (15 €), tiramisù (15 €)»: **giusto**, entrambi a 15 € nel QA |
| 12:56 | sposta la parmigiana… crea la nuova sezione "primi" | create_section + move | passa | scritto (rev 1820) + fatti riletti: ok |
| 12:57 | ora in primi aggiungi pesto, ragu, carbonara, riso giallo; paste a 10, riso a 8 | 1) create_section primi + 4 create_item | **piatto_doppio**: «pasta al ragu» = «pasta al ragù» già nel menu (nascosta, 20 €); il motivo diceva «usa le sue azioni» | — |
| | | 2) set_price ragù 10 + 3 create_item, bozza «Ho aggiornato…» | 4 modifiche → riepilogo da confermare; bozza senza domanda → `needsText` = 2º fallimento → `ask`; bozza tolta (dice fatto) | **«Non ho cambiato nulla.»** (nessuna scrittura) |
| 12:58 | stesso, «nella sezione primi» | 1) 4 create_item | piatto_doppio | — |
| | | 2) bozza «Aggiunti i nuovi piatti…» | 2º fallimento → `ask`; il filtro dei «fatti» non conosceva il participio da solo → la bozza passa come **domanda** (`brain_ask.question`) | **fatto falso**, nessuna scrittura (rev ferma a 1820) |

## Fix (vincoli; il server non decide al posto del modello)
1. **Mai «fatto» senza scrittura**: participi da soli («aggiunti, creata, spostati, inserito…») fuori da una domanda = affermazione di modifica → senza scrittura la bozza cade. Scartate anche le bozze coi codici interni («p5 o p6»).
2. **Piatto già nel menu chiesto come nuovo**: il validatore passa i piatti esistenti come candidati e chiede al modello la domanda «C'è già X a N €: lo aggiorno o ne creo un altro?» (decisione nota 62), le altre parti restano.
3. **Mai il solo «Non ho cambiato nulla.»** su una richiesta capita: una proposta da confermare dopo l'auto-correzione si mostra coi fatti «Non ancora pubblicato, da confermare con OK:»; senza domanda utilizzabile si aggiungono «Non salvato: …» e i piatti in questione.
4. **«a 10, 10 e 8»**: letto anche come elenco (prima solo 10,10 → creazioni rifiutate).
Test: `tests/owner-brain-r8.test.ts` (6 verdi, piani VERI di gpt-oss rigiocati).

## Numeri (oracolo = tetto, 0 token)
| batteria | esito |
|---|---|
| **R8 nuova** (160 conv., menu QA vero) | oracolo 160/160, 0 GRAVI, 0 MEDI; off 0 / avversario 0 GRAVI di sicurezza |
| fix-a, fix-b, X | verdi, tabelle identiche |
| Y / Z | 530/0/28 · 392/0/16, identiche a REPORT-R (test oracolo rossi come prima per soglia MEDI) |
| banco E, banco vero, V | identici |
| suite vitest | 14 rossi noti; round1–6* verdi |

## Deploy v114
check-active 113 `6ed2c371…` passato → build `f5dcb406…` (1.442.068 byte) → diff per sezioni: solo `owner-brain-r`, `twilio-menu-ai` (g9Prices, anche nel percorso dei clienti: round1–6* verdi), `routes/twilio-menu` → `deploy-projection.mjs` PASS. Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v113-bot-r.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`. Menu pubblico QA 200.

## Prova live (solo TwiML, chiave del bot)
| # | messaggio | risposta | scrittura |
|---|---|---|---|
| 1 | sposta la parmigiana… crea la nuova sezione "primi" | chiede quale parmigiana (c'è anche «Inserisce il piatto la parmigiana»; cronologia azzerata dalla prova) | no |
| 2 | ora in primi aggiungi… paste a 10, riso a 8 | «C'è già "pasta al ragù" a 20 €: lo aggiorno a 10 € o ne creo un altro?» | no |
| 3 | «nella sezione primi» | **non inviato**: 14.326 token dopo 2 turni, il 3º avrebbe superato il tetto 20k | — |

Twilio verso il numero 0→0 · QA ripristinato per hash (`229cc4f6b288291b` draft/published, pubblico `f6dec7315fd88a32`, stato di riferimento = QA attuale con Primi/la parmigiana) · proposta e memorie ripristinate · `tako_whatsapp_errors` 56→56.

## Aperti
- 12:58 non rifatto dal vivo (tetto token); coperto dal test coi piani veri.
- Col contesto reale di Manuel la risposta al ragù resta una domanda: se vuole sempre «crea un altro», va deciso (nota 62).
- Token: 36.537 chiavi di test (ora esaurite per oggi) + 14.326 chiave del bot.
