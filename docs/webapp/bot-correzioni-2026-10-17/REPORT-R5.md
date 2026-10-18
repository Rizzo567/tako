# REPORT R5 — misura della fase R (agente R2, 18/10/2026 notte)

Worktree `Tako-bot-fix`, branch `codex/bot-fix-1017`. Banco vero (f42cd39) portato con cherry-pick (solo test/fixture/doc). Un solo cervello rispettato: nessun percorso deterministico che decide è stato aggiunto; ne è stato **tolto** uno (ripristino automatico su «scusa/intendevo», nota 64). Testi fissi: solo AI Act e «non disponibile».

## Batterie (oracolo = tetto dell'architettura, non gpt-oss)
| Batteria | Conv. | Oracolo ok | GRAVI | GRAVI sicurezza | MEDI | Groq giù: GRAVI sicurezza | Avversario: GRAVI sicurezza |
|---|---|---|---|---|---|---|---|
| Y | 558 | 530 (95,0%) | 0 (era 5) | 0 | 28 (5,0%, era 45) | 0 | 0 |
| banco E | 318 | 313 (98,4%) | 0 (era 7) | 0 | 5 (1,6%) | 0 | — |
| V | 143 | 129 (90,2%) | 0 (era 4) | 0 (era 2) | 14 (9,8%) | 0 | — |
| banco vero | 92 | 80 (87,0%) | 0 (era 7) | 0 (era 3) | 12 (13%) | 0 | — |
| X | 508 | verde (0 GRAVI) | 0 | 0 | ≤2% | 0 | 0 |
| fix-a / fix-b | 809 / 452 | verdi | 0 | 0 | ≤2% | 0 | 0 |

Round1–6* col cervello spento: verdi (nella suite). Suite vitest: 14 rossi = gli stessi di 6004b81 (12 + twilio-menu-ai-flow + twilio-menu-hold). Test nuovo: conferma libera decisa dal modello (`tests/owner-brain-r.test.ts`, 13 frasi d'accordo passano, 11 contraddizioni no).

MEDI oltre il 2% (Y, V, banco vero): quasi tutti limiti dell'oracolo a regole (ordinali dopo una scelta, rinomine in due turni, «50 cent» con «togli», correzioni lunghe dei vocali), più i casi della decisione «piatto già esistente → domanda» (domanda attesa, MEDIO dove l'attesa vecchia voleva il prezzo). Non inseguiti oltre: l'oracolo non è gpt-oss (nota 65).

## Modello vero gpt-oss-120b (banco vero, chiavi di test, 252.773 token)
| Misura | Valore |
|---|---|
| Conversazioni misurate davvero | 41/92 (26 semplici, 10 domande, 5 multiple) |
| Successo sulle misurate | 38/41 (92,7%) |
| Semplici | **26/26 (100%)** (criterio gate ≥ 97%) |
| GRAVI / GRAVI sicurezza | 0 / 0 |
| Domande ogni 10 messaggi | 2,9 |
| JSON non validi | 0 su 68 chiamate (mai il ripiego 20b) |
| Latenza della chiamata | p50 0,94 s · p95 1,32 s |
| Token | 3.632 per chiamata, 4.843 per conversazione |

Fallimenti del modello vero (3, tutti MEDI, tutti nella stessa famiglia): bv-multiple-002/003/004, elenchi di 4 prezzi. Causa: oltre 3 modifiche il server mette il riepilogo in attesa dell'OK; il modello risponde «Confermi i nuovi prezzi?» e poi tratta le correzioni del titolare («per la pasta fai 15, lascia l'acqua, mantieni le altre») come richieste nuove e chiede «a quale piatto». Tipo: **errore del modello + scheda** (il blocco IN SOSPESO dice cosa c'è, ma la scheda non spiega che una correzione di un riepilogo va unita a quello). Non corretto: senza quota non si può ri-misurare; è il primo punto del giro di scheda al gate Developer. Nessun caso di validatore troppo stretto né di attesa sbagliata tra le 41 misurate.

## Decisioni prese in attesa di conferma di Manuel (nota 62)
«aumenta tutti di un euro» si applica subito con riepilogo numerato; piatto esistente chiesto come nuovo → «C'è già X a 12 €: lo aggiorno o ne creo un altro?», nessuna scrittura; nome nuovo letterale («Piatto test QA»).

## GRAVI rimasti
Nessuno in oracolo, Groq giù o avversario su nessuna batteria. Nessuno col modello vero sulle 41 misurate.

## Cosa serve dal gate Developer
1. Chiave Developer (o quota): ~400k token per le 51 conversazioni del banco vero non misurate, ~250k per banco E (60 conv.) + 5 Y/7 E ex-GRAVI.
2. Primo giro di scheda: correzioni di un riepilogo in sospeso (multiple-002/003/004), «da domani» (oggi solo l'oracolo chiede), poi ri-misura dei soli casi cambiati.
3. Conferma di Manuel sulle 3 attese della nota 62.
