# Tako — Cosa fa, spiegato al ristoratore

> Documento pensato per il gestore di un ristorante. Niente gergo tecnico: per ogni funzione
> trovi **cosa fa** e **cosa ci guadagni tu**. In fondo c'è una sezione onesta su **cosa Tako
> NON fa (ancora)**, così sai esattamente cosa puoi promettere e cosa no.

---

## Cos'è Tako in 3 righe

Tako è il **sistema operativo del tuo ristorante**: prende gli ordini, li manda in cucina,
gestisce tavoli, conti, prenotazioni e magazzino, e fa ordinare i clienti dal loro telefono
inquadrando un QR. Il cuore gira **in locale su un Mac dentro il locale**, quindi ordini, conti,
menu e cucina **funzionano anche senza internet**. Ci parli in linguaggio naturale (dashboard o
WhatsApp) e lui esegue: è un POS con un copilota AI dentro.

---

## 1. Menu digitale + QR al tavolo

**Cosa fa**
- Ogni tavolo ha un QR. Il cliente lo inquadra e si apre il **menu sul suo telefono**, senza
  scaricare nessuna app (è una pagina web / PWA).
- Dal telefono il cliente **sfoglia il menu, filtra per allergeni, mette i piatti nel carrello
  e invia l'ordine**, che arriva dritto in cucina.
- Menu **multilingua fino a 14 lingue**: italiano, inglese, spagnolo, tedesco, francese,
  portoghese, olandese, polacco, russo, turco, arabo, cinese, giapponese, coreano. Il cliente
  sceglie la sua lingua e vede nomi e descrizioni tradotti.
- **Descrizioni piatto generate con AI** e **traduzioni assistite dall'AI** (le scrivi/generi
  una volta, poi restano salvate).
- **Foto piatti con AI** in stile professionale coerente (vedi sezione dedicata).
- Varianti di piatto (es. taglia/porzione), sezioni ordinabili, disponibilità on/off del singolo
  piatto in tempo reale.

**Cosa ci guadagni**
- I clienti ordinano **da soli**: meno giri del cameriere per prendere la comanda, meno errori di
  trascrizione, tavoli serviti prima.
- Un turista legge il menu **nella sua lingua** e ordina senza incertezze → scontrino medio più
  alto, meno "cosa c'è dentro?".
- Cambi un prezzo o esaurisci un piatto? Lo togli e **sparisce all'istante** da tutti i telefoni,
  senza ristampare nulla.

---

## 2. Assistente AI per il cliente (nella sua lingua)

**Cosa fa**
- Dentro il menu il cliente ha una **chat con un assistente AI** che risponde **nella lingua del
  cliente**: consigli sui piatti, ingredienti, allergeni, abbinamenti.
- L'assistente non solo risponde: mostra **pulsanti che fanno agire** — *Invia ordine*,
  *Vedi carrello*, *Chiama il cameriere*, *Prenota*, *Segui l'ordine*.

**Cosa ci guadagni**
- È come avere un cameriere che parla tutte le lingue e non è mai occupato: **suggerisce, fa
  upselling e chiude l'ordine** al posto tuo.
- Il cliente che ha un dubbio non aspetta e non rinuncia: chiede e ordina subito.

---

## 3. Presa ordini, cucina (KDS), cassa, tavoli e sale

**Cosa fa**
- **Ordini live**: tutti gli ordini (dal cliente o presi dal cameriere) arrivano in una schermata
  in tempo reale, con possibilità di annullo.
- **Cucina — KDS** (Kitchen Display System): i ticket compaiono su uno schermo in cucina con
  **timer** (avvisa se un tavolo aspetta troppo), avanzamento per piatto e "bump" del ticket
  pronto. Modalità compatta per schermi piccoli.
- **Cassa e conti**: apri conti, applichi sconti, chiudi il conto con registrazione del pagamento.
  I **prezzi sono sempre ricalcolati dal database del locale**, mai presi dal telefono del cliente
  (nessuno può "barare" sul totale).
- **Tavoli e sale**: pianta della sala in 2D con tavoli disegnati, forme diverse, trascinabili;
  stato del tavolo (libero/occupato), coperto, food cost.
- **Realtime tra tutti i dispositivi**: quello che succede su un tablet si aggiorna subito sugli
  altri e sul telefono del cliente.

**Cosa ci guadagni**
- La cucina lavora su **ticket ordinati e cronometrati**, non su bigliettini: meno confusione nelle
  ore di punta, meno piatti dimenticati.
- Il conto è **sempre corretto** e coerente su ogni postazione. Chiusure più veloci.
- Vedi la sala a colpo d'occhio e sai dove sei indietro.

---

## 4. Prenotazioni e asporto

**Cosa fa**
- **Prenotazioni**: crea/modifica/annulla prenotazioni, assegnale a un tavolo, cambia stato
  (confermata, seduta, no-show). Il cliente può richiedere una prenotazione dal menu (se attivi
  la funzione).
- **Asporto**: ordini senza tavolo, con nome cliente, gestiti come conto a sé ed etichettati
  "Asporto · Nome" in cassa. Il cliente asporto segue lo stato del suo ordine dal telefono.

**Cosa ci guadagni**
- Prenotazioni e asporto **nello stesso sistema** degli ordini in sala: un unico posto dove
  guardi, niente quaderno separato.

---

## 5. Copilota AI per il ristoratore (dashboard + WhatsApp)

**Cosa fa**
- Nella dashboard hai un **copilota AI** a cui parli in **linguaggio naturale**: "quanto ho
  incassato oggi?", "crea il tavolo 12", "metti fuori menu la carbonara", "chi è di turno?",
  "quali piatti stanno finendo?", "fammi la lista della spesa per fornitore".
- Sa fare oltre **40 azioni reali** sul sistema, tra cui: incasso di oggi e per data, statistiche,
  stato tavoli, ordini attivi, conti aperti, apri/chiudi conto, applica sconto, crea/modifica/
  elimina piatti e sezioni, imposta disponibilità, genera descrizioni e traduzioni, imposta foto,
  **menu engineering** (analisi dei piatti tipo matrice stelle/cani), crea tavoli e sale, rigenera
  QR, prenotazioni del giorno, personale in turno, timbrature, gestione staff, scorte basse, lista
  di riordino, punti fedeltà, food cost e coperto, ricette.
- **Anti-invenzione**: se non ha il dato non se lo inventa. Ogni azione che **modifica** qualcosa
  (chiudere un conto, cancellare un piatto) passa da una **card di conferma** — non fa danni da solo.
- **Comandi anche da WhatsApp**: scrivi al numero collegato e il copilota ti risponde e agisce da
  telefono, con **le stesse regole** (solo numeri autorizzati; le modifiche richiedono un "SÌ"
  esplicito).

**Cosa ci guadagni**
- Gestisci il locale **parlando**, senza cercare la voce giusta in venti menu. Chiedi il briefing
  della giornata e ce l'hai in un secondo.
- Da WhatsApp controlli e comandi il ristorante **anche quando non sei lì**.

---

## 6. Inventario / magazzino (potente)

**Cosa fa**
- **Giacenze** per articolo, con unità di misura, **soglia minima**, fornitore e costo unitario.
- **Movimenti** di magazzino (carico, scarico, sprechi) con storico.
- **Cruscotto magazzino**: **valorizzazione** del magazzino (quanto vale quello che hai a
  scaffale), conteggi, **consumo degli ultimi 30 giorni** e stima dei **giorni-alla-rottura**
  (quando finirai un articolo al ritmo attuale).
- **Avvisi scorte basse** e **lista di riordino automatica raggruppata per fornitore**, con
  quantità suggerita per tornare al livello obiettivo e **costo stimato dell'ordine**.
- **Import da testo con AI**: incolli una fattura/lista fornitore come testo e l'AI la trasforma in
  articoli pronti (nome, unità, quantità, costo, fornitore) da confermare.
- **Scarico automatico da ricetta**: colleghi gli ingredienti ai piatti (ricetta) e, se attivi la
  funzione, alla conferma di un ordine il magazzino **si scala da solo**.

**Cosa ci guadagni**
- Sai sempre **cosa sta finendo e quando**, e con un clic hai la **spesa già divisa per fornitore**
  con il costo stimato: meno rotture di stock, meno ordini a naso.
- Il valore del magazzino è un numero, non una sensazione: utile per conti e food cost.
- Caricare gli articoli da una fattura diventa un copia-incolla invece di un'ora di data entry.

> Nota onesta: lo **scarico automatico da ricetta** è **spento di default** e va attivato. È pensato
> per non bloccare mai un ordine, quindi in casi limite (ricetta incompleta, movimenti concomitanti)
> può scostarsi dal reale: trattalo come una stima molto utile, non come contabilità di magazzino
> certificata. La conta fisica periodica resta buona pratica.

---

## 7. Fedeltà a punti, richiesta recensioni, stampa comande

**Cosa fa**
- **Fedeltà a punti**: accrediti, controlli il saldo e fai riscattare punti ai clienti (gestibile
  anche a voce dal copilota).
- **Richiesta recensioni**: se attivi la funzione e imposti il link (es. Google), il cliente vede
  una **CTA per lasciare la recensione** a fine esperienza.
- **Stampa termica ESC/POS**: **comanda di cucina** (testo grande, divisa per stazione) e
  **scontrino / nota conto di cortesia**, con **taglio carta** e **apertura cassetto**.

**Cosa ci guadagni**
- Fai tornare i clienti (punti) e **raccogli più recensioni** senza rincorrere nessuno: più
  recensioni = più visibilità.
- La cucina ha la sua comanda stampata leggibile e la cassa il suo scontrino, come sei abituato.

> Nota: lo **scontrino è di cortesia, NON fiscale**. Tako non fa scontrino fiscale / registratore
> telematico (vedi limiti).

---

## 8. Foto dei piatti con AI (stile professionale coerente)

**Cosa fa**
- Carichi una foto qualsiasi del piatto (anche col telefono) e Tako la **trasforma in una foto da
  menù professionale**: luce morbida, sfondo neutro pulito, **stile identico per tutti i piatti**.
- Puoi impostare un'**immagine di riferimento** per il tuo locale: da lì tutti i piatti vengono
  uniformati a quello stile/mood.
- Due livelli di qualità: **base** e **Pro** (qualità massima). Il Pro si sblocca con un codice
  fornito da Manuel.

**Cosa ci guadagni**
- Menu con **foto belle e coerenti** senza servizio fotografico: i piatti con foto professionale
  vendono di più, e il menu sembra curato ovunque.

---

## 9. Funziona anche con internet pessimo

Questo è il punto forte di Tako per un ristorante vero.

**Cosa fa**
- Il **cuore gira in locale sul Mac** del locale (database, ordini, conti, menu, cucina,
  dashboard). Non è un servizio cloud che cade se salta la linea.
- Il **QR del tavolo punta al Mac in LAN** (nome `tako.local` sulla rete), non a internet: il menu
  si apre anche a linea staccata.
- Se `tako.local` non funziona su qualche telefono, c'è il **fallback su IP diretto** del Mac.
- Uno **stato "offline" chiaro** su dashboard e telefono al posto di errori/caricamenti infiniti.
- Le funzioni che richiedono internet **degradano in modo pulito**: se manca la rete restano
  semplicemente non disponibili, **senza bloccare il servizio**. Nessuna di queste è nel percorso
  critico "prendo un ordine → va in cucina".

**Cosa continua a funzionare senza internet**: ordini, conti, menu al tavolo, cucina/KDS, dashboard
staff, realtime tra i dispositivi in sala.
**Cosa si mette in pausa senza internet**: WhatsApp, foto AI, report/AI, auto-update dell'app.

**Cosa ci guadagni**
- Il servizio **non si ferma** quando la connessione del locale fa i capricci. Puoi persino usare il
  **Mac come hotspot** per i tavoli quando il wifi del locale è inaffidabile.

> Guida tecnica completa per l'installatore: `docs/setup-rete-ristorante.md`.

---

## 10. Multi-dispositivo in LAN, in tempo reale

**Cosa fa**
- La dashboard gira sul **Mac** e su **tablet** collegati alla stessa rete (cameriere in sala,
  cuoco al KDS, cassa). È responsive: funziona anche su schermi mobili.
- Ruoli diversi: **owner** (tutto + copilota), **cameriere** (sala/ordini), **cuoco** (KDS),
  **cassiere** (cassa/conti). Accesso con **PIN** per lo staff.
- Tutto si sincronizza **in tempo reale** passando dal Mac, non dal cloud.

**Cosa ci guadagni**
- Metti un tablet in sala, uno in cucina, uno in cassa: **tutti vedono la stessa cosa aggiornata**,
  senza pagare un server esterno e senza dipendere da internet.

---

## Cosa Tako NON fa (ancora) — i limiti, detti chiari

Questa sezione serve a te per **non promettere ciò che non c'è**.

- **Nessun pagamento online/digitale integrato.** Niente Stripe, carte, pagamento dal telefono del
  cliente. I pagamenti si **registrano** a mano in cassa (contanti/POS esterno). È una scelta di
  prodotto, non un bug.
- **Nessuna funzione fiscale.** Niente scontrino fiscale, registratore telematico (RT),
  corrispettivi o SDI. Lo scontrino che stampa è **di cortesia**. Per il fiscale serve il tuo
  sistema attuale.
- **Serve un Mac sempre acceso nel locale.** Tako È quel Mac. Se il Mac si spegne o va in stop,
  il sistema si ferma: va tenuto **acceso, sveglio e alimentato** durante il servizio (meglio via
  cavo Ethernet).
- **Le funzioni AI richiedono internet + chiave attiva.** Assistente cliente, copilota owner,
  descrizioni/traduzioni AI, import magazzino da testo, foto AI: se manca internet o la chiave non
  è configurata, **non funzionano** (ma il resto sì). Le **foto Pro** richiedono un codice di Manuel.
- **mDNS (`tako.local`) può non funzionare su Android vecchi (pre-2021) o reti mal configurate.**
  In quei casi si usa il fallback su IP diretto; richiede un IP stabile del Mac (config in fase di
  installazione).
- **WhatsApp copilota è opzionale e va configurato.** È **spento di default**, richiede una prima
  scansione del QR e non è ancora collaudato sul campo end-to-end.
- **Scarico automatico del magazzino: spento di default e "best-effort".** Va attivato e le ricette
  vanno compilate; è una stima ottima ma non una contabilità di magazzino a prova di revisore.
- **Nessun account cliente / login cliente.** Il cliente ordina in modo anonimo dalla sessione del
  tavolo; non c'è "profilo cliente" con storico personale.
- **Niente marketing via WhatsApp/SMS** (invii promozionali) e **nessun report settimanale via
  email** automatico al momento.
- **Analitiche di base.** Ci sono incassi, piatti top, scansioni per ora, menu engineering; **non**
  ci sono ancora confronto settimana-su-settimana, tempo medio di permanenza al tavolo, export CSV.
- **Alcuni dettagli operativi ancora grezzi:** l'**upload del logo** del ristorante e il **riordino
  drag&drop** di sezioni/piatti non sono ancora cablati; la **chiamata cameriere** avvisa in tempo
  reale ma non viene archiviata; l'assegnazione fissa cameriere↔tavolo è prevista ma non attiva.
- **Installazione dell'app macOS non ancora firmata/notarizzata:** al primo avvio macOS può chiedere
  uno sblocco manuale (Gatekeeper).

---

## Requisiti (sintetici)

- **Un Mac** nel locale, acceso durante il servizio (idealmente collegato al router via **cavo
  Ethernet**), con l'app Tako installata. È il server: database, backend, menu cliente e dashboard
  girano tutti lì.
- **Una rete wifi in sala** che porti i telefoni dei clienti fino al Mac. Consigliato un **SSID
  dedicato "Tako"** senza *client isolation*, sulla stessa rete/VLAN del Mac; in alternativa il Mac
  come hotspot.
- **IP stabile del Mac** (DHCP reservation o IP statico) perché il QR e i fallback restino validi
  nel tempo.
- **Internet solo per le funzioni extra** (AI, WhatsApp, foto, report, auto-update): opzionale per
  il core, che gira comunque in locale.
- **Tablet** aggiuntivi (opzionali) per sala/cucina/cassa, sulla stessa rete del Mac.

> Dettagli e collaudo passo-passo per chi installa: `docs/setup-rete-ristorante.md`.
