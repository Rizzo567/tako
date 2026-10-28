# 28/10/2026 — Manuel — il bot invia il PDF del menu in chat

## Obiettivo
Il titolare scrive in chat «mandami il menu giorno» (per esempio dopo averlo cambiato) e Tako risponde allegando il PDF A4 di quel Menu, pronto da stampare. Decisione di Manuel: PDF, non immagine (Brain: `decisioni/2026-10-28-takomenu-bot-invia-pdf-menu.md`).

## Cosa fa
- «mandami il menu giorno», «inviami il menu del giorno», «stampami il menu giorno», «mi serve il menu cena in pdf» → messaggio «Ecco il PDF da stampare: *Menu Giorno*…» con il PDF allegato.
- «mandami il pdf» / «il menu da stampare» senza nome, con più Menu → chiede quale (elenco). Con un solo Menu lo manda.
- «mandami il menu» da solo resta il link del menu digitale, come prima.
- Non scatta su modifiche, domande sul contenuto, lamentele, link/QR, frasi con nomi di piatti, «ti mando il menu…», «voglio/vorrei…» senza «pdf», né se un Menu si chiama solo «Menu».
- Il PDF parte in un secondo messaggio dopo il testo: se Twilio non riesce a scaricarlo, il testo arriva comunque. Locale spento/in prova/rimosso → risposta a parole, nessun allegato.
- Il PDF nasce dal menu **pubblicato** quando Twilio lo scarica: stessa grafica del pulsante Stampa (cartaceo se il Menu ha il modello, altrimenti PDF del menu), orari ignorati. Il PDF fisso caricato a mano non viene usato.

## Come
- `pdfIntent` in `apps/server/src/lib/twilio-menu-nlu.ts`; `pdfTurn` in `routes/twilio-menu.ts`, prima di `linkTurn`.
- Allegato: marcatore `\u0004` + URL in coda al testo (`withMedia`/`splitMedia`/`withoutMedia` in `twilio-menu-command.ts`). `twiml()` scrive `<Body>` + `<Media>`; `sendWhatsApp` manda `MediaUrl` (risposte tardive via REST). La memoria del turno salva il testo senza URL.
- Link: `GET /api/public/whatsapp-pdf/<nome>.pdf?k=<token>` in `publicMenuPdfRoutes`. Token HMAC (JWT_SECRET, scope proprio), locale + Menu, scade dopo 6 ore; nessun dato salvato. 404 se token falso/scaduto o locale spento/in prova/rimosso. Token in query perché Fastify limita i parametri di percorso a 100 caratteri.

## Verifiche
- `tsc` server: pulito.
- Revisione indipendente: trovati falsi positivi gravi (dettatura del menu con «voglio…», «ti mando il menu», «cartaceo», Menu chiamato «Menu») e allegato che poteva far perdere il testo. Corretti; le 55 frasi della revisione sono nei test.
- Vitest completo: 3961 test, 279 rossi identici alla base f4628c0a (nessun nuovo rosso). Nuovi: `tests/whatsapp-menu-pdf.test.ts` (15) e `tests/whatsapp-menu-pdf-e2e.test.ts` (5: webhook firmato → TwiML con Media → download → PDF vero col testo giusto; segue l'ultima modifica pubblicata; link manomesso/scaduto/locale spento → 404).
- `build-operational-candidate` PASS, `verify-candidate-lazy-boot` PASS (Deno locale, nessun deploy).
- Nota: la suite completa riscrive `docs/webapp/bot-correzioni-2026-10-17/batterie/*`; ripristinati.

## Limiti noti
- Vocali: «mandami il menu giorno» detto a voce non manda il PDF (come già per i link).
- Lingua: sempre la lingua predefinita del menu.
- La route rigenera il PDF a ogni download (limite 30/min per IP); nessuna cache.

## Deploy
Nessuno. Il ramo parte da `fix/bot-sostituzioni-1024` (non ancora online). Online c'è la v188 = v187 + delta credenziali migrazione del 27/10, che questo ramo **non** contiene. Per pubblicare: partire dal bundle online (v188), integrare questo delta (e i fix sostituzioni se approvati), poi prova dal vivo sul QA con numero di prova: «mandami il menu …» → controllare che WhatsApp mostri il PDF e che si apra. Il token di gestione Supabase locale oggi risponde 401.

## Prossimo passo
Autorizzazione al deploy e prova reale sul QA (Twilio deve scaricare l'allegato da takoitalia.com).
