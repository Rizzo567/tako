# Tako — Kit di vendita per il ristoratore

> **A cosa serve questo documento.** È il tuo copione operativo per entrare in un ristorante,
> parlare 20 minuti con chi comanda e uscire con un appuntamento o un pilota. Non è marketing:
> è quello che dici, nell'ordine in cui lo dici, con le risposte già pronte alle obiezioni e
> il confine netto tra ciò che puoi promettere e ciò che non devi promettere.
>
> Aggiornato: 2026-08-09 — su Tako **v0.1.6**.

---

## PARTE 0 — Stato della preparazione

Aggiornato **2026-08-09, sera**. Le prime tre voci sono già state fatte e verificate.

| # | Cosa | Stato |
|---|---|---|
| 1 | **Mac demo alla 0.1.6** (era fermo alla 0.1.0) | ✅ fatto — `/Applications/Tako.app` = 0.1.6, install da zip collaudato in 12 s |
| 2 | **Menu demo credibile** | ✅ fatto — 44 piatti, 10 sezioni, allergeni, 29 varianti, food cost su tutti, **5 lingue** (it/en/de/fr/es, 176 traduzioni) |
| 2b | **Storico di servizio** perché statistiche e copilota abbiano numeri veri | ✅ fatto — 21 giorni, 177 conti, €5.719 di incasso, curva con picchi ven/sab, 2 tavoli vivi in sala |
| 3 | **Giro completo collaudato** QR → menu → lingua → ordine → cucina → conto | ✅ fatto — **282 ms** end-to-end, variante addebitata giusta (Margherita Maxi 9,50 €) |
| — | **Foto dei piatti** | ⛔ non fatto — serve la chiave Gemini (`~/.tako/gemini-key.txt`) oppure foto tue: `node scripts/demo-foto.mjs <cartella>` |
| 4 | **Batteria carica + alimentatore + telefono con hotspot** | tocca a te |
| 5 | **Decidi il prezzo che dirai a voce** (vedi Parte 6) e non cambiarlo durante la giornata | tocca a te — prezzi diversi a locali della stessa via = credibilità a zero |
| 6 | **Cosa rispondere su fattura e P.IVA** (vedi Parte 9) | ✅ scritto qui sotto |

### I due comandi da lanciare domani, prima di uscire

Lo storico è generato **rispetto al giorno in cui lo lanci**: se non lo rifai, domani
"quanto ho incassato oggi?" risponde **zero** davanti al cliente. E i QR contengono
l'**IP corrente**: cambia rete o accendi l'hotspot → vanno rigenerati.

```sh
cd ~/Projects/Tako
# 1. storico aggiornato a oggi (idempotente, rilanciabile)
DATABASE_URL='postgresql://tako:tako@127.0.0.1:54317/takodb' node packages/db/seed-demo-storico.mjs 21
# 2. foglio QR con l'IP di ADESSO → ~/Desktop/Tako-QR-demo.html
DATABASE_URL='postgresql://tako:tako@127.0.0.1:54317/takodb' node scripts/qr-demo.mjs 6
```

> **Accedi alla dashboard con `demo@tako.local` / `demo12345`** (PIN `1234`). Account creato
> apposta: non dipendi dal ricordarti la password del tuo account.

### ⚠️ Il QR `tako.local` può costare 5 secondi

Misurato su questa rete: risolvere `tako.local` impiega **5,01 s fissi**, l'IP diretto **6 ms**.
Causa: il DNS di sistema (`192.168.1.1`) è su una sottorete diversa dal Mac (`192.168.168.133`)
e non risponde, quindi ogni lookup paga il timeout prima di cadere su mDNS. Il QR stampato dalla
dashboard usa `tako.local`. **Per la demo usa il foglio generato da `qr-demo.mjs`** (IP diretto),
oppure mostra il QR dallo schermo del Mac dopo aver verificato i tempi sulla rete del locale.

**Cosa metti in borsa:** Mac + alimentatore, cavo Ethernet USB-C→RJ45, telefono personale (fa il cliente),
un secondo telefono o tablet se ce l'hai (fa il cameriere), il foglio QR stampato, questo documento,
un blocco per gli appunti (scrivere a mano davanti al ristoratore fa credibilità, il telefono no).

---

## PARTE 1 — Cos'è Tako, detto in 30 secondi

**Versione che dici tu, a memoria, senza leggerla:**

> "Tako è il sistema che fa girare la sala e la cucina. Il cliente inquadra il QR del tavolo,
> ordina dal suo telefono senza scaricare niente, e l'ordine arriva dritto in cucina.
> Lo staff lavora da tablet: tavoli, conti, prenotazioni, magazzino.
> La differenza vera con gli altri: **gira su un Mac dentro il tuo locale**, non nel cloud.
> Quindi se salta internet tu continui a lavorare, e i dati dei tuoi clienti restano a casa tua.
> E ci parli normale, a voce o scrivendo: 'quanto ho incassato oggi', 'togli la carbonara' — e lui lo fa."

**Le tre parole che devono restargli in testa:** *ordini diretti in cucina*, *funziona senza internet*,
*i dati sono tuoi*.

**Come NON aprire:** non dire "sistema operativo per la ristorazione", non dire "AI-powered",
non dire "piattaforma". Dì cosa fa, con le parole del suo mestiere.

---

## PARTE 2 — I casi in cui Tako serve davvero (e quelli in cui no)

Questa parte serve a te per **qualificare in 60 secondi** se vale la pena continuare.

### Serve molto — vai a fondo

| Situazione del locale | Perché Tako morde |
|---|---|
| **Ordini presi a mano su blocchetto**, cucina che li riceve a voce o su foglietto | È il caso perfetto: elimina errori di trascrizione e i viaggi del cameriere. Effetto visibile dal primo turno. |
| **Molti turisti / clienti stranieri** (centro città, zone di passaggio, mare) | Menu in 14 lingue + assistente AI che risponde nella lingua del cliente. Nessun concorrente locale ce l'ha così. |
| **Internet che fa i capricci** (cantine, borghi, zone industriali, locali in seminterrato) | È il differenziatore numero uno. Un POS cloud lì è inutilizzabile, Tako no. |
| **Rush concentrati** (pizzeria del venerdì, aperitivo, brunch domenicale) | KDS con timer + ordini che arrivano dal telefono = smaltisci più coperti con lo stesso staff. |
| **Ristoratore che non sa quale piatto rende** | Menu engineering, food cost, incassi in tempo reale, top piatti. Gli dai un numero dove oggi ha una sensazione. |
| **Magazzino gestito a occhio**, ordini ai fornitori "a naso" | Giacenze, soglie, lista di riordino **già divisa per fornitore** con costo stimato, giorni-alla-rottura. |
| **Titolare che non è sempre in sala** (ha due attività, viaggia, ha un secondo lavoro) | Copilota su WhatsApp: chiede l'incasso, chiude un conto, mette un piatto fuori menu dal telefono, da dove sta. |
| **Locale che paga già 80-120 €/mese di POS cloud + sito + gestionale** | Confronto diretto sul costo, con in più l'offline. |
| **Poco personale di sala** rispetto ai coperti | L'ordinazione da telefono libera letteralmente una persona nel rush. |
| **Asporto rilevante** | Asporto gestito nello stesso sistema, con il cliente che segue lo stato dal telefono. |

### Serve poco — non insistere, saluta bene e lascia il contatto

- **Locale che ha appena firmato un contratto POS pluriennale** → torna alla scadenza, segnati la data.
- **Serve lo scontrino fiscale integrato** e non vuole tenere il registratore attuale → Tako non lo fa. Dillo subito.
- **Vuole il pagamento dal telefono del cliente** → Tako non lo fa. Dillo subito.
- **Nessuno nel locale userebbe un tablet** (staff molto anziano, titolare ostile alla tecnologia in blocco) → costo di supporto altissimo, margine negativo.
- **Locale che non può tenere un Mac acceso e collegato** (nessuno spazio, nessuna presa vicino al router, chiusure con stacco della corrente).
- **Catena con IT centralizzato** → decisione non è di chi hai davanti; chiedi chi decide e vai lì.

> Regola: **è meglio un no rapido che un sì tiepido**. Ogni installazione tiepida ti costa
> giornate di assistenza e ti toglie tempo per i clienti buoni.

---

## PARTE 3 — Sotto quali punti di vista aiuta (l'argomentazione, area per area)

Per ogni area: **la frase che dici**, e il **dato/beneficio** che la regge. Usa solo quelle che
c'entrano con il locale che hai davanti — non recitarle tutte, sembra un catalogo.

### 3.1 Tempo dello staff
> "Il cameriere smette di fare il postino. Prende l'ordine chi mangia, l'ordine va in cucina da solo,
> lui serve e sta in sala."

Cosa cambia: meno viaggi sala↔cucina, meno "com'era quello del tavolo 6?", meno ordini persi nel rush.
Con lo stesso organico servi più tavoli, oppure lo stesso numero con meno stress.

### 3.2 Errori e contestazioni
> "Il piatto che arriva sbagliato lo paghi tu due volte: gli ingredienti e il cliente incazzato."

Cosa cambia: l'ordine è scritto dal cliente o battuto una sola volta, arriva in cucina identico,
con timer per stazione. Zero trascrizioni intermedie.

### 3.3 Incasso e scontrino medio
> "Un cliente che legge il menu nella sua lingua, con la foto del piatto, ordina di più e chiede di meno."

Cosa cambia: menu tradotto in 14 lingue, foto piatto uniformi generate dalle tue foto,
assistente che consiglia abbinamenti e fa upselling mentre tu sei in cucina, pulsanti che chiudono l'ordine.

### 3.4 Margine e food cost
> "Ti dico quali piatti ti fanno guadagnare e quali ti stanno mangiando il margine. Senza Excel."

Cosa cambia: menu engineering a quadranti (star / plowhorse / puzzle / dog), food cost per piatto,
incasso live, piatti più venduti, valorizzazione del magazzino.

### 3.5 Magazzino e fornitori
> "Alla domenica sera ti dice cosa ordinare, diviso per fornitore, con quanto ti costa."

Cosa cambia: giacenze con soglia minima, consumo ultimi 30 giorni, stima dei giorni-alla-rottura,
lista di riordino automatica per fornitore, import di una fattura incollandola come testo.

### 3.6 Continuità del servizio
> "Il sabato sera cade la linea. Con un sistema cloud tu chiudi. Con Tako non te ne accorgi."

Cosa cambia: database, ordini, conti, menu, cucina e dashboard girano tutti sul Mac del locale.
Il QR punta al Mac in LAN, non a internet. Puoi anche usare il Mac come hotspot per la sala.

### 3.7 Dati e privacy
> "I dati dei tuoi clienti e i tuoi numeri stanno nel tuo locale. Non li vede nessun altro, io compreso."

Cosa cambia: niente profilazione di terzi, GDPR più semplice, nessun lock-in su un cloud altrui.

### 3.8 Controllo a distanza
> "Sei a casa e vuoi sapere come è andata? Scrivi su WhatsApp e te lo dice. E può anche agire."

Cosa cambia: copilota AI con oltre 40 azioni reali, sia in dashboard che via WhatsApp, con conferma
esplicita per tutto ciò che modifica qualcosa.

### 3.9 Formazione dello staff
> "Chi sa usare WhatsApp sa usare Tako. PIN a quattro cifre e tre schermate per ruolo."

Cosa cambia: ruoli separati (cameriere / cuoco / cassa / titolare), interfaccia grande e touch,
cheatsheet di una pagina per ruolo che lasci stampato in locale.

### 3.10 Recensioni e clienti che tornano
> "A fine cena gli chiedi la recensione mentre è ancora seduto e contento, non tre giorni dopo."

Cosa cambia: CTA recensione a fine esperienza (link Google tuo), punti fedeltà gestibili anche a voce.

---

## PARTE 4 — La demo di 8 minuti (l'ordine conta)

Non far vedere le impostazioni. Non far vedere il magazzino per primo. Fai vedere **il giro dei soldi**.

1. **(1 min) Metti il QR sul tavolo davanti a lui e digli: "inquadralo tu."**
   Deve essere lui a farlo col suo telefono. Il momento in cui il menu si apre sul *suo* telefono
   senza scaricare niente è il momento in cui vendi.
2. **(1 min) Fagli cambiare lingua.** Meglio se sceglie una lingua che non conosce. Poi torna in italiano.
3. **(1 min) Fagli ordinare due piatti.** Carrello, invio ordine.
4. **(1 min) Giri il Mac: l'ordine è già in cucina**, sul KDS, con il timer che parte. Fai "pronto".
5. **(1 min) Cassa:** apri il conto del tavolo, mostra il totale, applica uno sconto, chiudi.
6. **(1 min) Il colpo:** *stacca il Wi-Fi / spegni la linea* e rifai un ordine dal telefono.
   Funziona tutto uguale. Questa è la scena che si ricorda.
7. **(1 min) Copilota:** scrivi "quanto ho incassato oggi" e "metti fuori menu la carbonara".
   Fagli vedere la card di conferma prima che tocchi qualcosa.
8. **(1 min) Chiudi la demo e stai zitto.** Lascialo parlare per primo. Chi parla per primo dopo la demo, perde.

**Se qualcosa si inceppa:** non ti scusare tre volte e non spiegare il bug. Una frase:
*"Questo lo sistemo, non è nella parte che ti installo."* e vai avanti. Poi segnatelo davvero.

---

## PARTE 5 — Obiezioni: risposta pronta

| Obiezione | Cosa rispondi |
|---|---|
| **"Quanto costa?"** | Non rispondere subito con il numero secco. *"Dipende da quanto è grande il locale, ma ti do l'ordine di grandezza: [vedi Parte 6]. Prima però dimmi quanto spendi oggi tra POS, gestionale e sito, così vediamo se ha senso."* |
| **"I miei camerieri non ce la fanno."** | *"Tre schermate e un PIN. Ti lascio una pagina stampata per ruolo e sto qui io per il primo servizio. Se dopo un servizio il tuo staff non lo usa, non lo installiamo."* |
| **"Se salta internet?"** | *"È il motivo per cui l'ho fatto così. Gira sul Mac qui dentro. Guarda —"* e stacchi la linea davanti a lui. **Non spiegarlo: fallo.** |
| **"Il QR ai miei clienti non piace."** | *"Il QR è in più, non al posto. Il cameriere prende la comanda dal tablet esattamente come fa oggi col blocchetto, e finisce nello stesso posto. Chi vuole ordinare da solo lo fa, chi non vuole viene servito come sempre."* |
| **"Ho già un POS / gestionale."** | *"Non te lo tolgo. Il registratore fiscale resta il tuo. Tako fa la parte dove perdi tempo: sala, cucina, ordini, magazzino."* |
| **"E se si rompe il Mac?"** | *"I dati sono sul Mac e c'è il backup del database. Se il Mac muore, si reinstalla e si ripristina. Ma sii onesto: è un rischio che c'è, ed è il motivo per cui il Mac deve essere solo per questo, sempre acceso e attaccato alla corrente."* |
| **"Devo comprare un Mac?"** | *"Serve un Mac nel locale, sempre acceso durante il servizio. Se ce l'hai già, usiamo quello. Se no è una spesa una tantum, non un canone."* — **non promettere che lo fornisci tu** se non hai deciso di farlo. |
| **"Fa lo scontrino fiscale?"** | *"No, e non te lo racconto diverso. Lo scontrino fiscale resta il tuo registratore. Tako stampa la comanda in cucina e la nota di cortesia per il cliente."* |
| **"Si può pagare dal telefono?"** | *"Non ancora. Il pagamento lo registri in cassa come fai oggi, contanti o POS."* |
| **"Chi mi assiste se ho un problema alle 21 di sabato?"** | Rispondi solo quello che sei disposto a fare davvero. Un livello onesto: *"Il mio numero diretto su WhatsApp negli orari di servizio. Non ho un call center e non te lo invento."* |
| **"Fammi pensare."** | *"Certo. Facciamo così: ti lascio installato il menu del tuo locale su un QR di prova, senza impegno. Se tra una settimana non l'hai usato, ci siamo risparmiati entrambi del tempo."* — dai un passo piccolo, non un contratto. |
| **"Ce l'ha già il mio vicino?"** | Non mentire mai su questo. Se non hai clienti, dì: *"Sei tra i primi. È il motivo per cui il prezzo è quello che ti sto facendo, e per cui vengo io di persona a installarlo."* |

---

## PARTE 6 — Il prezzo (da confermare da te, poi non si cambia)

⚠️ **Nessuna decisione di prezzo è ancora registrata nel brain.** Domani devi uscire con **un numero
in bocca**: se esiti sul prezzo, il ristoratore capisce che stai improvvisando e non firma.

**Proposta raccomandata — da confermare stasera:**

| Voce | Prezzo di listino | Prezzo "primi locali" |
|---|---|---|
| **Attivazione** (installazione in loco, caricamento menu, QR, formazione staff, primo servizio con te presente) | **490 €** una tantum | **190 €** |
| **Canone** (aggiornamenti, assistenza WhatsApp, funzioni AI) | **89 €/mese** | **59 €/mese**, bloccato per 12 mesi |
| Mac | non incluso — se ce l'ha, si usa il suo | idem |

**Come lo presenti — sempre in questo ordine:**

1. **Prima il suo costo attuale:** *"Quanto paghi oggi di POS? E il sito del menu? E il gestionale?"*
   Fai la somma su carta davanti a lui.
2. **Poi il tuo:** *"Tako sta qui sotto, e in più funziona quando cade la linea."*
3. **Poi il rapporto al coperto:** *"59 € al mese su 40 coperti al giorno sono 5 centesimi a coperto.
   Il tovagliolo ti costa di più."*
4. **Poi la garanzia:** *"Se dopo il primo mese il tuo staff non lo usa, smetti e non paghi il secondo."*
   — offrila solo se sei disposto a rispettarla.

**Cosa non fare:** non scontare al primo "eh, è caro". Chiedi *"caro rispetto a cosa?"* e ascolta.
Nove volte su dieci sotto c'è un dubbio diverso dal prezzo (paura di non saperlo usare, paura di piantarsi).

---

## PARTE 7 — Cosa NON devi promettere (leggilo due volte)

Se prometti una di queste, domani vendi e tra un mese hai un cliente arrabbiato che parla male di te
nella stessa via.

- ❌ **Scontrino fiscale, registratore telematico, corrispettivi, SDI.** Tako non ha nessuna funzione fiscale.
  Lo scontrino che stampa è **di cortesia**.
- ❌ **Pagamenti online / dal telefono del cliente.** Non esistono. I pagamenti si **registrano** in cassa.
- ❌ **Integrazioni con Glovo, Deliveroo, TheFork, Just Eat.** Non ci sono.
- ❌ **Import del menu da foto o PDF con OCR.** Il testo del menu va incollato: portati il menu del locale
  già in formato testo, o mettilo in conto nel tempo di installazione.
- ❌ **App scaricabile dallo store per il cliente.** È una pagina web (PWA). È un vantaggio, ma non chiamarla app.
- ❌ **Account cliente con storico personale.** Il cliente ordina in modo anonimo dalla sessione del tavolo.
- ❌ **Report settimanali via email, export CSV, confronto settimana-su-settimana.** Non ci sono ancora.
- ❌ **Marketing via WhatsApp/SMS ai clienti finali.** Non c'è.
- ❌ **Che funziona senza il Mac acceso.** Tako *è* quel Mac. Se si spegne o va in stop, il servizio si ferma.
- ❌ **Che le funzioni AI vanno offline.** Assistente cliente, copilota, traduzioni, foto AI, import magazzino:
  **serve internet**. Il resto no.
- ⚠️ **WhatsApp copilota:** è spento di default, va configurato e **non è ancora collaudato sul campo
  end-to-end**. Mostralo come "c'è", non come "te lo accendo domani".
- ⚠️ **Scarico automatico del magazzino da ricetta:** spento di default, è una **stima molto utile**,
  non contabilità di magazzino certificata. Dillo con queste parole.
- ⚠️ **App macOS non firmata/notarizzata:** al primo avvio può servire uno sblocco manuale. Lo fai tu
  in installazione, ma non far scaricare il file a lui da solo.
- ⚠️ **`tako.local` può non funzionare su Android vecchi (pre-2021) o reti mal configurate** → si usa
  il fallback su IP diretto, che richiede un IP stabile del Mac.

### Cose da sistemare prima di installare a un cliente pagante

Note tecniche interne — non le dici al ristoratore, ma **condizionano cosa puoi accendere domani**:

- **La comanda dello staff non gestisce le varianti**: un cameriere che batte "Vino della casa — Litro"
  addebita il prezzo base. → In demo **usa il percorso cliente** per le varianti, o non mostrare varianti dal tablet.
- **Asporto battuto al banco senza conto** → cibo preparato e non fatturato.
- **`/api/setup/*` senza autenticazione**: chiunque sulla LAN può riscrivere la password del titolare.
  → Non installare su una rete Wi-Fi aperta agli ospiti finché non è chiuso.
- **Split conto su LAN instabile** può addebitare due volte la stessa quota.
- **Coperto e default** ancora da sistemare.

Riferimento completo: `docs/PIANO-REVISIONE-FULLSTACK.md` (ondata 0 — P0).

---

## PARTE 8 — La visita: come si svolge

**Quando andare:** **15:00–17:30**, tra pranzo e cena. Mai durante il servizio, mai alle 12:30, mai
alle 20:00. Se arrivi durante il servizio bruci il locale.

**Chi cercare:** il titolare o chi gestisce. Se non c'è: *"A che ora lo trovo? Torno io."*
Non lasciare un volantino e basta, e non lasciare il numero a un cameriere sperando che richiami.

**I primi 20 secondi** (in piedi, senza tirare fuori niente):
> "Buongiorno, sono Manuel, sono qui in zona. Non le vendo niente adesso: ho fatto un sistema
> per la sala e la cucina, gira qui dentro senza internet, e vorrei farglielo vedere in cinque minuti
> quando ha un momento. È lei che gestisce?"

**Poi tre domande, e ascolti:**
1. *"Come prendete gli ordini adesso?"*
2. *"Cosa vi fa perdere più tempo la sera che siete pieni?"*
3. *"Che internet avete qui? Regge?"*

Le risposte ti dicono **quali argomenti della Parte 3 usare** e quali saltare. Se dice
"gli ordini a mano, e la linea fa schifo", hai già vinto: parla solo di quello.

**Chiusura — chiedi sempre un passo, mai "che ne pensa":**
- Passo forte: *"Le va che vengo giovedì pomeriggio e gliela installo per una settimana di prova?"*
- Passo medio: *"Le carico il suo menu e le porto il QR del suo locale la prossima settimana. Zero impegno."*
- Passo minimo: *"Le mando il video su WhatsApp. Qual è il suo numero?"* — e **mandaglielo davvero entro sera**.

**Dopo ogni visita, 60 secondi sul blocco:** nome locale, nome persona, coperti, come prendono
gli ordini oggi, cosa paga oggi, obiezione principale, prossimo passo con data.

---

## PARTE 9 — Amministrativo: cosa puoi e non puoi fare domani

- **Se non hai ancora la P.IVA aperta: domani non incassi.** Non prendere caparre, non prendere
  bonifici, non prendere contanti. Raccogli **impegni** ("ci sto, quando apri mi fatturi") e
  installazioni pilota gratuite.
- Frase pronta se ti chiedono di pagare subito: *"Partiamo con una settimana di prova, poi le faccio
  fattura regolare dal primo mese vero."* — è vero ed è anche una tecnica di chiusura migliore.
- Documenti che esistono già in bozza e che ti servono quando si passa ai soldi:
  `docs/vendita/contratto-licenza-BOZZA.md`, `docs/vendita/dpa-BOZZA.md` (privacy/GDPR),
  `docs/vendita/disclaimer-fiscale.md`. **Sono bozze non riviste da un legale**: usale come traccia,
  non farle firmare come definitive.
- Per l'installazione vera: `docs/vendita/runbook-installazione.md` (45–75 min) e
  `docs/vendita/checklist-install-day.md`. Da leggere **prima** di fissare la prima installazione.

---

## PARTE 10 — Errori da non fare domani

1. **Parlare di funzioni invece che del suo problema.** Lui non compra il KDS, compra "non sbaglio più gli ordini".
2. **Fare la demo delle impostazioni.** Fai la demo del giro dei soldi.
3. **Dire "intelligenza artificiale" più di una volta.** Metà dei ristoratori la sente come fumo.
4. **Promettere il fiscale o i pagamenti** per non perdere il cliente. Lo perdi dopo, peggio, e parlando male di te.
5. **Scontare al primo dubbio.**
6. **Uscire senza un prossimo passo con una data.**
7. **Citare clienti che non hai.** Se non hai referenze, la tua leva è "sei tra i primi, quindi ti seguo io di persona".
8. **Restare più di 25 minuti** se non stanno arrivando domande vere. Saluta bene, torna un'altra volta.

---

## PARTE 11 — Frasi da mandare a memoria

- *"Il cameriere smette di fare il postino."*
- *"Se salta internet, tu continui a lavorare."* (e poi lo fai vedere)
- *"I dati dei tuoi clienti restano nel tuo locale."*
- *"Non ti tolgo il registratore fiscale. Ti tolgo i foglietti."*
- *"Cinque centesimi a coperto. Il tovagliolo costa di più."*
- *"Se dopo un servizio il tuo staff non lo usa, non lo installiamo."*
- *"Non ti vendo niente adesso. Voglio solo fartelo vedere cinque minuti."*

---

## Appendice A — Prompt riutilizzabile (per generare/aggiornare questo kit)

Da usare in una nuova sessione quando il prodotto cambia o quando serve una variante del pitch
(per un tipo di locale specifico, per una call, per un video).

```
RUOLO
Sei un consulente di vendita B2B specializzato in software per la ristorazione italiana
indipendente, con esperienza diretta di vendita porta a porta a titolari di ristoranti.
Scrivi per una sola persona: Manuel, fondatore e unico venditore di Tako.

OBIETTIVO
Produrre il materiale che rende Manuel operativo nella vendita di Tako ai ristoratori:
non un documento di marketing, ma un copione usabile in piedi, in un locale, senza schermo.

CONTESTO — FONTI DI VERITÀ (leggile prima di scrivere, in quest'ordine)
1. ~/Projects/Tako/docs/tako-funzionalita-ristoratori.md  → cosa fa e cosa NON fa, oggi
2. ~/Projects/Tako/docs/PIANO-REVISIONE-FULLSTACK.md      → bug P0 aperti = cosa non promettere
3. ~/Projects/Tako/docs/vendita/                          → runbook, contratti, cheatsheet
4. ~/Documents/brain/TAKO-DOSSIER.md + decisioni/*tako*   → stato reale e decisioni prese
5. git log del repo + versione installata in /Applications → distanza tra codice e demo

REGOLE NON NEGOZIABILI
- Zero invenzioni. Nessun cliente, testimonianza, numero, percentuale o case study che non
  sia verificabile nelle fonti. Se una prova sociale manca, dillo e proponi come sostituirla.
- Ogni promessa deve essere sostenuta dal codice reale. Ogni limite noto va scritto
  esplicitamente in una sezione "cosa NON promettere".
- I bug P0 aperti si traducono in vincoli operativi concreti ("non accendere X", "in demo
  usa il percorso Y"), non in note tecniche.
- Italiano parlato di un ristoratore. Niente anglicismi gratuiti, niente gergo tech,
  niente "soluzione", "piattaforma", "leverage". Dare del tu al lettore.
- Ogni argomento di vendita deve avere: la frase da dire a voce + il beneficio concreto.
- Ogni obiezione deve avere una risposta pronunciabile in meno di 15 secondi.
- Segnala esplicitamente le decisioni che spettano a Manuel (prezzo, garanzie, livello di
  assistenza) invece di deciderle al posto suo: proponi un default e chiedi conferma.

STRUTTURA RICHIESTA
0. Preparazione da fare prima di uscire (incluso lo stato reale della demo)
1. Pitch da 30 secondi, a memoria
2. Quando Tako serve / quando NON serve (per qualificare in 60 secondi)
3. Aree di beneficio, ognuna con frase + sostanza
4. Copione della demo, minuto per minuto, nell'ordine che converte
5. Tabella obiezioni → risposte
6. Prezzo: proposta, come presentarlo, cosa non fare
7. Cosa NON promettere (limiti reali) + vincoli dai bug aperti
8. Come si svolge la visita: orario, apertura, domande, chiusura
9. Vincoli amministrativi (fatturazione, contratti, privacy)
10. Errori da non fare
11. Frasi da mandare a memoria

FORMATO
Markdown, tabelle dove il confronto aiuta, frasi da pronunciare sempre in corsivo o citazione.
Deve essere leggibile su un telefono in piedi davanti a un locale.

VERIFICA PRIMA DI CONSEGNARE
- Ogni affermazione sul prodotto è rintracciabile in una fonte? Altrimenti eliminala.
- C'è qualcosa che, se detto domani, creerebbe un cliente arrabbiato tra un mese?
- Manuel può uscire di casa con solo questo documento e fare la visita? Se no, cosa manca?
```

---

## Appendice B — Materiale esistente e suo stato

| Documento | Stato | Nota |
|---|---|---|
| `docs/tako-funzionalita-ristoratori.md` | ✅ affidabile | Fonte di verità su cosa fa e non fa |
| `docs/vendita/runbook-installazione.md` | ✅ affidabile | Da leggere prima della prima installazione |
| `docs/vendita/cheatsheet-staff.md` | ✅ affidabile | **Stampalo**: lo lasci in locale dopo l'installazione |
| `docs/vendita/piano-b-carta.md` | ✅ affidabile | Cosa fare se il sistema si ferma durante un servizio |
| `docs/vendita/contratto-licenza-BOZZA.md`, `dpa-BOZZA.md` | ⚠️ bozze | Non riviste da un legale |
| `brain/wiki/marketing-tako.md` | ❌ **non usare com'è** | Datato 2026-05-02: parla di "mini PC" (ora è un Mac), contiene **testimonianze inventate** (Roberto di Crema, Giulia di Bologna, Marco di Pavia) e "4 ristoranti in beta" che non esistono. Le strutture (persona, canali, pricing rationale) restano valide; **i contenuti pronti no**. |
