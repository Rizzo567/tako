# REPORT-R · fase R «un solo cervello» · 17–18/10/2026

Branch `codex/bot-fix-1017` → fast-forward su main e codex/release-1016 il 18/10. Online: edge `tako-operational-candidate` **v113** (ezbr `6ed2c371…`, rollback v112 in `~/.config/tako-webapp/rollback-edge-20261017/`). Cervello (`settings.botBrain`) acceso **solo sul QA** 26050ecd; i 21 clienti e Victoria sono a cervello spento sul percorso HEAD (decisione 18/10: ricevono anche le correzioni A/B). Dettagli per tappa: REPORT-R5.md, REPORT-R6.md, REPORT-R7-2.md, avversaria-z/REPORT-Z.md; deviazioni in implementation-notes.md (note 49–77).

## Cosa è cambiato
- Col cervello acceso **ogni messaggio va al modello** (gpt-oss-120b su Groq, ripiego 20b); il codice deterministico è solo **validatore dei fatti** (prezzo/nome presenti nel testo o nel menu, plausibilità del prezzo, percentuali, direzione del verbo per clausola, «anzi», parti perse) e lettore del DB per i fatti appesi alla risposta.
- Testi fissi ammessi: riga «assistente automatico» al primo messaggio; «Sono momentaneamente non disponibile, riprova tra un minuto» se Groq non risponde. Nessuna riserva a regole.
- Strumenti del modello: `confirm_pending` (la conferma la decide il modello: «va bene così», «ok vai» valgono), `undo_last`, elimina solo dopo «sì», annulla solo l'ultima pubblicazione, mai il piatto del giorno.
- Piano respinto dal validatore → torna al modello una volta (auto-correzione) → poi domanda, mai scrittura.

## Misure (oracolo = modello ideale; 0 token Groq)
| batteria | ok | GRAVI | GRAVI sicurezza | MEDI |
|---|---|---|---|---|
| fix-a | 809/809 | 0 | 0 | ≤2% |
| fix-b | 452/452 | 0 | 0 | ≤2% |
| X (508) | verde | 0 | 0 | ≤2% |
| Y (558) | 530 | 0 | 0 | 28 (5,0%) |
| banco E (318) | 313 | 0 | 0 | 5 (1,6%) |
| V (143) | 129 | 0 | 0 | 14 (9,8%) |
| banco vero (92) | 80 | 0 | 0 | 12 (13%) |
| Z (408, nuova) | 392 | 0 | 0 | 16 (3,9%) |

Groq spento e modello avversario: **0 GRAVI di sicurezza** ovunque. Round1–6* a cervello spento: 1679/1679. Suite vitest: gli stessi 14 rossi noti di 6004b81.

## Modello vero (gpt-oss-120b, chiavi di test, 252.773 token)
Banco vero, 41/92 conversazioni misurate: **38 ok (92,7%)**, comandi semplici **26/26**, 0 GRAVI, 0 JSON invalidi su 68 chiamate, 2,9 domande ogni 10 messaggi, p50 0,94 s per chiamata, ~3,6k token per chiamata. I 3 mancati: correzioni a un riepilogo di 4 prezzi in attesa di ok, presi come richieste nuove (scheda da ritoccare).

## Prova live sul QA (v113, solo TwiML, 0 messaggi al numero di Manuel)
Elimina → chiede → «sì» cancella; «+10%» e «tre dici» → domanda, nessuna scrittura; riga AI Act solo al primo messaggio; p50 4,2 s; QA ripristinato per hash; `tako_whatsapp_errors` 56 → 56. **Non verificati** dal vivo: «va bene così», «annulla» dopo pubblicazione, secondo vocale (rifiuti Groq).

## Rischi aperti
1. **Limite Groq al minuto (free, 8k token/min)**: due messaggi del titolare in meno di ~1 minuto col cervello acceso → «non disponibile». Si risolve col piano Developer. Da verificare prima di accendere i clienti.
2. **Banco completo col modello vero non fatto** (servono ~650k token): 51 conversazioni del banco vero + campione E/Y → gate Developer (R7.1).
3. MEDI residui su Y/V/banco vero/Z: per lo più limiti dell'oracolo, correzioni a riepiloghi in attesa, trascrizioni dialettali; «alza, anzi abbassala» ora chiede invece di agire.
4. Divergenze live non di sicurezza: vocale «togli bo» letto come elimina (chiede, non scrive); una risposta ripete una domanda ancora aperta.
5. Da fare fuori piano: ruotare le chiavi Groq di test e la password `takomenu_runtime`; privacy; ripristino Victoria.

## Accensione clienti
Solo col via esplicito di Manuel, dopo R7.1 col Developer (banco completo ≥ 90%, 0 GRAVI, limite al minuto verificato).
