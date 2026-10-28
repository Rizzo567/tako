# Takomenu impeccabile — sintesi della ricerca (17/10/2026)

Fonti e dettagli: 01-memoria-apprendimento.md · 02-dialetti-asr.md · 03-bot-whatsapp-ux.md · 04-prodotto-menu.md.
Cifre segnate «non verificate» nei singoli file restano da confermare prima di usarle nella vendita.

## Scelte consigliate, in ordine di impatto

### A. Bot WhatsApp (il differenziatore: nessun concorrente trovato lo fa)
1. **Scheda per ristoratore compatta (2–3k token) sempre nel prompt**, più scheda generale fissa in testa. Niente vault/RAG/grafo, niente Mem0/Zep: a questa scala il contesto intero vale quanto il retrieval ed è più veloce. Ordine del prompt: scheda generale → scheda ristoratore → messaggio, per sfruttare il caching Groq (−50% input su gpt-oss-120b, cache 2 h).
2. **Apprendimento automatico solo da segnali certi** (risposta a un chiarimento, correzione, conferma di riepilogo), dopo la risposta. Voce candidata → attiva dopo 2 conferme o 3 usi coerenti (soglie da tarare); un soprannome può puntare solo a un piatto esistente; scrive solo il server, con log append-only; «dimentica X».
3. **Una chiamata AI: capire + bozza di risposta in JSON strict**; i fatti (cosa è cambiato, prezzi) li scrive il server dopo aver riletto il DB. Paracadute al parser deterministico se il JSON fallisce (~10% segnalato su forum Groq).
4. **Undo vero**: «annulla» subito dopo una modifica pubblicata la ripristina.
5. **Pulsanti/liste interattivi WhatsApp** per i chiarimenti (max 3 pulsanti, 10 righe).
6. **Velocità percepita**: «sta scrivendo» subito; messaggio «Ci sono…» solo oltre 4–5 s.
7. **Obbligo AI Act (art. 50, dal 02/08/2026)**: il primo messaggio dichiara che è un assistente automatico. Bot vincolato al menu (policy Meta 2026 sui chatbot generalisti).

### B. Vocali e dialetti
8. **Il collo di bottiglia è la trascrizione, non il modello.** Passare a Whisper i nomi dei piatti del locale (max ~224 token).
9. **Niente rilevatore di dialetto né vocabolario per regione** (riconoscimento da testo ~0,69 F1, peggio su frasi brevi). Un solo glossario di cucina/servizio di 100–200 voci, scritto a mano, sempre nel prompt.
10. **Test di mezza giornata su 50–100 vocali veri** prima di costruire altro; metrica = comandi eseguiti giusti. Se Whisper su Groq non basta, provare ElevenLabs Scribe / AssemblyAI (5–8× il costo).

### C. Prodotto menu
11. **Allergeni**: il QR da solo non basta (fonti ASL/secondarie; sanzioni 3.000–24.000 €). PDF automatico con allergeni per piatto + pulsante «stampa menu»; campo coperto ben visibile. Parere ASL/legale prima di scrivere «a norma».
12. **Affidabilità**: ultimo menu valido in cache sul telefono e PDF di riserva se la pagina non carica; obiettivi Google LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
13. **SEO**: JSON-LD `hasMenu`/`MenuItem` sulla pagina menu.
14. **Vendita**: non promettere aumenti di scontrino in percentuale (dati solo dai fornitori); misurare sui locali in prova. Prezzi concorrenti: Qodeup 269 €/anno + IVA, Gustify 14,90 €/mese, altri 39–99 €/mese.

## Costi e prerequisiti
- Groq gpt-oss-120b: 0,15 $/M input, 0,60 $/M output; Whisper turbo 0,04 $/ora. Il piano free non regge la scheda per tutti i locali: serve il Developer (tetto giornaliero da verificare in console).
- WhatsApp: risposte ai messaggi del ristoratore gratis; costano solo i messaggi avviati da noi fuori dalle 24 h.
- Privacy: informativa + DPA prima di salvare messaggi; proposta: audio cancellato subito, testi max 90 giorni (o solo le parole imparate).

## Piano proposto
1. Subito (piccoli, alto impatto): nomi piatti nel prompt di Whisper · riga «assistente automatico» · undo vero.
2. Test vocali veri (mezza giornata).
3. Prototipo scheda ristoratore + scheda generale sul QA, confronto con il bot attuale su 50 messaggi veri (tempi e comprensione).
4. Se migliora: apprendimento automatico, pulsanti interattivi, Developer Groq.
5. In parallelo lato menu: PDF allergeni/stampa, menu di riserva offline, JSON-LD.
