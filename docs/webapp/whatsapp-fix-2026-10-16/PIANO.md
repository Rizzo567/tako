# Fix bot WhatsApp Takomenu — 16/10 (dai collaudi Codex notte 15/10 + mattina 16/10)

Fonti: `~/Downloads/Takomenu - Report collaudo WhatsApp - 2026-10-16.txt` (notte), `~/Downloads/Takomenu - Report test WhatsApp - 2026-10-16.md` (mattina), evidenze in `docs/webapp/whatsapp-night-qa-2026-10-15/` e `docs/webapp/whatsapp-morning-qa-2026-10-16/`.

## Goal (condizione di stop testabile)
Le 8 frasi del collaudo mattina + le 7 della notte, rigiocate su una bozza QA nuova, danno questo stato finale:
- **B1 «mantieni»** — una clausola «mantieni/lascia/non cambiare X» non crea MAI righe nuove: si risolve su un piatto esistente (anche in altro menu) oppure si ignora. Frase di riproduzione: «Nel menu Pranzo, categoria Primi, aggiungi Gnocchi al pesto a 11 euro. Mantieni Burger classico a 12 euro e Pasta al pomodoro a 10 euro. Non pubblicare.» → 5 piatti, nessuna categoria «Menu»/«Menu Pranzo».
- **B2 cambio prezzo** — «cambia Burger da 12 a 13», «il prezzo corretto è 13, aggiorna il piatto esistente», «porta il Burger a 13» aggiornano il piatto esistente (stesso ID) se è univoco; nessun dubbio «trovo due prezzi». Se omonimi in più menu → una domanda semplice («Quale Burger: Pranzo o Cena?»).
- **B3a richiesta multipla** — «Aggiungi Risotto ai funghi a quattordici euro; cambia Burger da dodici a tredici; non cambiare Pasta» applica entrambe le modifiche. Ogni job fallito scrive una causa non sensibile (parse / merge / provider / quota) in `tako_whatsapp_errors`; se la causa è il provider/quota il messaggio all'utente lo dice in modo semplice e non perde la richiesta.
- **B3b dubbi vecchi** — un dubbio risolto da una rettifica o superato da un messaggio nuovo si chiude; i dubbi non bloccano le risposte successive; «mostra il riepilogo» risponde col riepilogo menu/piatti/prezzi.
- **B3c copy** — nessuna risposta contiene «Fonte N», «VERIFICATO FONTE», nomi tecnici; dopo una modifica il bot conferma in una riga cosa è cambiato prima della domanda successiva.

## Verifier
1. Test Vitest nuovi che riproducono letteralmente le frasi dei report (B1, B2, B3a, B3b, B3c), rossi prima del fix, verdi dopo. Suite completa `vitest run` forzata (no cache) + typecheck + build.
2. E2E simulato firmato (numero QA +390000000099, nuova bozza QA) sull'edge deployata: le 8 frasi della mattina in sequenza, snapshot DB in sola lettura prima/dopo, stato finale atteso: Pranzo/Primi Pasta 10, Risotto 14, Gnocchi 11; Pranzo/Dolci Tiramisu 6; Cena/Panini Burger 13 (stesso ID); 5 piatti; stile nero/arancio/bianco/Poppins; riepilogo restituito.
3. Victoria e i 21 locali clienti: revisione/hash invariati (baseline in `docs/webapp/whatsapp-morning-qa-2026-10-16/baseline.json`).
4. Verifica avversaria finale indipendente (agente diverso da chi ha implementato).

## Exit di fallimento
- Max 3 giri implementa→verifica. Se dopo 3 giri un bug resta rosso: stop, report con causa e proposta.
- Quota Groq esaurita che impedisce l'E2E reale: non comprare piani, non cambiare provider; fare i test con modello mockato, segnalare il blocco.
- Mai scrivere nei 21 locali clienti né in Victoria. Mai pubblicare la bozza QA.
- Prima del deploy edge: salvare il sorgente attuale (v72) in `~/.config/tako-webapp/rollback-edge-20261016/`.

## Perimetro
`apps/server/src/lib/onboarding-*.ts`, `twilio-menu-*.ts`, `routes/twilio-menu.ts` e i loro test. Un solo implementatore (i file si toccano tra loro), verificatore separato in sola lettura.
